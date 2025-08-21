mod curius;

use dotenvy;
use redis::Client as RedisClient;
use reqwest_middleware::ClientBuilder;
use reqwest_retry::{RetryTransientMiddleware, policies::ExponentialBackoff};

#[tokio::main]
async fn main() -> eyre::Result<()> {
    // Load environment variables from .env file
    dotenvy::dotenv().ok();

    // Create a shared HTTP client
    let retry_policy = ExponentialBackoff::builder().build_with_max_retries(5);
    let http_client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(retry_policy))
        .build();

    // Create Redis client from environment
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let redis_client = RedisClient::open(redis_url)
        .map_err(|e| eyre::eyre!("Failed to create Redis client: {}", e))?;
    let mut redis_conn = redis_client.get_multiplexed_async_connection().await?;

    // Create context with both clients
    let context = curius::Context {
        http_client,
        redis_client,
        redis_conn: redis_conn,
    };

    // Test user profile endpoint
    println!("=== Testing User Profile Endpoint ===");
    let response = curius::get_user_profile(&context, "jett-chen").await?;
    let user = &response.user;

    println!("Successfully fetched user profile:");
    println!("Name: {} {}", user.first_name, user.last_name);
    println!("User Link: {}", user.user_link);
    println!("School: {}", user.school.as_deref().unwrap_or("N/A"));
    println!("Twitter: {}", user.twitter.as_deref().unwrap_or("N/A"));
    println!("Website: {}", user.website.as_deref().unwrap_or("N/A"));
    println!("Views: {}", user.views);
    println!("Followers: {}", user.num_followers);
    println!("Following: {} users", user.following_users.len());
    println!("Recent Users: {} users", user.recent_users.len());
    println!("Last Online: {}", user.last_online);

    println!("\n=== Testing Content Endpoint ===");
    match curius::get_content(&context, user.id).await {
        Ok(response) => {
            println!("Successfully fetched {} items\n", response.user_saved.len());

            for (i, content) in response.user_saved.iter().enumerate() {
                println!("=== Item {} ===", i + 1);
                println!("Title: {}", content.title);
                println!("Link: {}", content.link);
                if let Some(snippet) = &content.snippet {
                    println!("Snippet: {}", snippet);
                }
                println!("Favorite: {}", content.favorite);
                println!("Created: {}", content.created_date);
                if let Some(to_read) = content.to_read {
                    println!("To Read: {}", to_read);
                }
                if let Some(crawled) = &content.last_crawled {
                    println!("Last Crawled: {}", crawled);
                }
                if !content.highlights.is_empty() {
                    println!("Highlights: {} found", content.highlights.len());
                }
                println!();
            }
        }
        Err(e) => {
            println!("Error fetching content: {}", e);
        }
    }

    let follow_list = curius::get_follow_list(&context, user.clone(), 2).await?;
    follow_list.iter().for_each(|f| {
        println!("{} -- {}", f.following_user.user_link, f.order);
    });
    println!("Total Following: {}", follow_list.len());

    // Create user IDs from the follow list
    let mut user_ids: Vec<i64> = follow_list.iter().map(|f| f.following_user.id).collect();

    // Add current user ID to the list
    user_ids.push(user.id);

    println!("Total unique user IDs for feed: {}", user_ids.len());

    println!("\n=== Testing Feed Fetch ===");
    if user_ids.is_empty() {
        println!("No user IDs found, skipping feed fetch");
    } else {
        match curius::fetch_feed(&context, user_ids).await {
            Ok(feed_content) => {
                let total_items = feed_content.len();
                let items_to_show = feed_content.iter().take(100).collect::<Vec<_>>();

                println!("Successfully fetched {} total items from feed", total_items);
                println!(
                    "Showing the most recent {} items (sorted by timestamp, deduplicated):",
                    items_to_show.len()
                );

                for (i, content) in items_to_show.iter().enumerate() {
                    println!("=== Feed Item {} ===", i + 1);
                    println!("Title: {}", content.title);
                    println!("Link: {}", content.link);
                    println!("Created: {}", content.created_date);
                    println!("ID: {}", content.id);
                    println!();
                }
            }
            Err(e) => {
                println!("Error fetching feed: {}", e);
            }
        }
    }

    Ok(())
}
