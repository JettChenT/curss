use redis::aio::MultiplexedConnection;
use reqwest_middleware::ClientWithMiddleware;

/// Context object containing HTTP client and Redis connection
#[derive(Clone)]
pub struct Context {
    pub http_client: ClientWithMiddleware,
    pub redis_client: redis::Client,
    pub redis_conn: MultiplexedConnection,
}
