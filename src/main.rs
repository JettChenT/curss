mod context;
mod curius;
mod routes;

use axum::{Router, routing::get};
use context::Context;
use dotenvy;
use redis::Client as RedisClient;
use reqwest_middleware::ClientBuilder;
use reqwest_retry::{RetryTransientMiddleware, policies::ExponentialBackoff};
use routes::{get_feed, get_follow_list};

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
    let redis_conn = redis_client.get_multiplexed_async_connection().await?;

    // Create context with both clients
    let context = Context {
        http_client,
        redis_client,
        redis_conn: redis_conn,
    };

    let app = Router::new()
        .route("/", get(|| async { "Hello, World!" }))
        .route("/follow-list", get(get_follow_list))
        .route("/feed", get(get_feed))
        .with_state(context);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    axum::serve(listener, app).await?;
    Ok(())
}
