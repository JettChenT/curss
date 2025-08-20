mod curius;

#[tokio::main]
async fn main() {
    // Test user profile endpoint
    println!("=== Testing User Profile Endpoint ===");
    match curius::get_user_profile("justin-wang").await {
        Ok(response) => {
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
        }
        Err(e) => {
            println!("Error fetching user profile: {}", e);
        }
    }

    println!("\n=== Testing Content Endpoint ===");
    match curius::get_content(1578).await {
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
}
