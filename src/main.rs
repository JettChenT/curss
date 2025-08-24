mod conf;
mod context;
mod curius;
mod routes;
mod telemetry;

use axum::{Router, routing::get};
use context::Context;
use dotenvy;

use deadpool_redis::{
    Config as RedisConfig, Pool as RedisPool, PoolConfig, Runtime as RedisRuntime,
    redis::{FromRedisValue, cmd},
};
use redis::Client as RedisClient;
use reqwest_middleware::ClientBuilder;
use reqwest_retry::{RetryTransientMiddleware, policies::ExponentialBackoff};
use reqwest_tracing::TracingMiddleware as ReqwestTracingMiddleware;
use routes::{get_all_users, get_feed, get_follow_list};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

#[tracing::instrument]
async fn foo() {
    tracing::info!("starting foo");
    tracing::info!(
        monotonic_counter.foo = 1_u64,
        key_1 = "bar",
        key_2 = 10,
        "handle foo",
    );

    tracing::info!(histogram.baz = 10, "histogram example",);
}

#[tracing::instrument]
async fn server() -> eyre::Result<()> {
    tracing::info!("starting server");
    // Create a shared HTTP client with tracing enabled
    let retry_policy = ExponentialBackoff::builder().build_with_max_retries(5);
    let http_client = ClientBuilder::new(reqwest::Client::new())
        .with(RetryTransientMiddleware::new_with_policy(retry_policy))
        .with(ReqwestTracingMiddleware::default())
        .build();

    tracing::info!("HTTP client configured with tracing and retry policy");

    // Create Redis client from environment
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".to_string());
    let mut pool_config = PoolConfig::default();
    pool_config.max_size *= 4; // 16x cpu
    let mut redis_cfg = RedisConfig::from_url(redis_url);
    redis_cfg.pool = Some(pool_config);
    let redis_pool = redis_cfg.create_pool(Some(RedisRuntime::Tokio1))?;

    // Create context with clients
    let context = Context {
        http_client,
        redis_pool,
    };

    let app = Router::new()
        .route(
            "/",
            get(|| async {
                tracing::info!("Health check endpoint called");
                "Hello, World!"
            }),
        )
        .route("/all-users", get(get_all_users))
        .route("/follow-list", get(get_follow_list))
        .route("/feed", get(get_feed))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(context);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("Server listening on 0.0.0.0:3000");
    axum::serve(listener, app).await?;

    Ok(())
}

#[tokio::main]
async fn main() -> eyre::Result<()> {
    // Load environment variables from .env file
    dotenvy::dotenv().ok();

    // Initialize OpenTelemetry tracing
    let _guard = telemetry::init_tracing_subscriber();

    foo().await;
    server().await?;

    Ok(())
}
