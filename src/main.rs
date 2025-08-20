mod curius;

use reqwest::Client;
use reqwest_middleware::{ClientBuilder, ClientWithMiddleware};
use reqwest_retry::{RetryTransientMiddleware, policies::ExponentialBackoff};

#[tokio::main]
async fn main() -> eyre::Result<()> {
    // Create a shared HTTP client
    let retry_policy = ExponentialBackoff::builder().build_with_max_retries(5);
    let client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(retry_policy))
        .build();

    // Test user profile endpoint
    println!("=== Testing User Profile Endpoint ===");
    let response = curius::get_user_profile(&client, "jett-chen").await?;
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
    match curius::get_content(&client, user.id).await {
        Ok(response) => {
            println!("Successfully fetched {} items\n", response.user_saved.len());

            for (i, content) in response.user_saved.iter().enumerate() {
                println!("=== Item {} ===", i + 1);
                println!("Title: {}", content.title);
                println!("Link: {}", content.link);
                println!("Snippet: {}", content.snippet);
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

    let follow_list = curius::get_follow_list(&client, user.clone(), 2).await?;
    follow_list.iter().for_each(|f| {
        println!("{} -- {}", f.following_user.user_link, f.order);
    });
    println!("Total Following: {}", follow_list.len());

    Ok(())
}
