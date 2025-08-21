use deadpool_redis::Pool;
use reqwest_middleware::ClientWithMiddleware;
use serde::{Serialize, de::DeserializeOwned};
use std::fmt::Debug;

/// Context object containing HTTP client and Redis connection
#[derive(Clone)]
pub struct Context {
    pub http_client: ClientWithMiddleware,
    // pub redis_conn: MultiplexedConnection,
    pub redis_pool: Pool,
}

impl Context {
    /// Get a cached value from Redis with automatic deserialization
    #[tracing::instrument(skip(self))]
    pub async fn get_cached<T: DeserializeOwned + Debug>(
        &self,
        cache_key: &str,
    ) -> eyre::Result<Option<T>> {
        tracing::debug!(cache_key = %cache_key, "Attempting to get cached value");

        let mut conn = self.redis_pool.get().await?;

        match redis::cmd("GET")
            .arg(cache_key)
            .query_async::<String>(&mut conn)
            .await
        {
            Ok(cached_data) => {
                match serde_json::from_str::<T>(&cached_data) {
                    Ok(deserialized) => {
                        tracing::debug!(cache_key = %cache_key, "Cache hit - successfully retrieved and deserialized");
                        Ok(Some(deserialized))
                    }
                    Err(e) => {
                        tracing::warn!(cache_key = %cache_key, error = %e, "Cache hit but failed to deserialize - removing corrupted cache entry");
                        // Remove corrupted cache entry
                        let _ = redis::cmd("DEL").arg(cache_key).exec_async(&mut conn).await;
                        Ok(None)
                    }
                }
            }
            Err(e) => {
                if e.to_string().contains("nil") {
                    tracing::debug!(cache_key = %cache_key, "Cache miss");
                    Ok(None)
                } else {
                    tracing::error!(cache_key = %cache_key, error = %e, "Redis error during cache retrieval");
                    Err(eyre::eyre!("Redis error: {}", e))
                }
            }
        }
    }

    /// Fetch raw values for a chunk of keys from Redis
    #[tracing::instrument(skip(pool))]
    async fn fetch_chunk_values(
        pool: &Pool,
        chunk_keys: &[String],
    ) -> eyre::Result<Vec<Option<String>>> {
        let mut conn = pool.get().await?;

        let raw_values: Vec<Option<String>> = redis::cmd("MGET")
            .arg(chunk_keys)
            .query_async(&mut conn)
            .await
            .map_err(|e| eyre::eyre!("Redis MGET error: {}", e))?;

        Ok(raw_values)
    }

    /// Get multiple cached values from Redis using MGET with automatic deserialization.
    /// Keys are fetched in chunks of at most 100 per request to avoid oversized payloads.
    /// Requests are made in parallel using async tasks.
    #[tracing::instrument(skip(self, cache_keys))]
    pub async fn mget_cached<T: DeserializeOwned + Debug>(
        &self,
        cache_keys: &[String],
    ) -> eyre::Result<Vec<Option<T>>> {
        tracing::debug!(keys = cache_keys.len(), "Attempting MGET for cached values");

        if cache_keys.is_empty() {
            return Ok(Vec::new());
        }

        // Prepare result vector with None placeholders without requiring T: Clone
        let mut results: Vec<Option<T>> = Vec::with_capacity(cache_keys.len());
        results.resize_with(cache_keys.len(), || None);

        const CHUNK_SIZE: usize = 10;

        // Create futures for each chunk to be executed in parallel
        let mut chunk_futures = Vec::new();

        for (chunk_index, chunk) in cache_keys.chunks(CHUNK_SIZE).enumerate() {
            let start = chunk_index * CHUNK_SIZE;
            let chunk_keys: Vec<String> = chunk.to_vec();

            let pool = self.redis_pool.clone();
            let chunk_future = tokio::spawn(async move {
                tracing::debug!("Fetching chunk of keys in parallel");
                let raw_values = Self::fetch_chunk_values(&pool, &chunk_keys).await?;
                Ok::<_, eyre::Error>((start, chunk_keys, raw_values))
            });

            chunk_futures.push(chunk_future);
        }

        // Execute all chunk requests in parallel
        let chunk_results = futures::future::join_all(chunk_futures).await;

        // Process results from all chunks
        for chunk_result in chunk_results {
            match chunk_result {
                Ok(Ok((start, chunk_keys, raw_values))) => {
                    // Map chunk results back into the full results vector
                    for (offset, raw_opt) in raw_values.into_iter().enumerate() {
                        let global_idx = start + offset;
                        match raw_opt {
                            Some(raw) => match serde_json::from_str::<T>(&raw) {
                                Ok(deserialized) => results[global_idx] = Some(deserialized),
                                Err(e) => {
                                    let key = &chunk_keys[offset];
                                    tracing::warn!(cache_key = %key, error = %e, "MGET hit but failed to deserialize - removing corrupted cache entry");
                                    // Best-effort delete of corrupted cache entry
                                    let mut conn = self.redis_pool.get().await?;
                                    let _ = redis::cmd("DEL").arg(key).exec_async(&mut conn).await;
                                    results[global_idx] = None;
                                }
                            },
                            None => results[global_idx] = None,
                        }
                    }
                }
                Ok(Err(e)) => {
                    tracing::error!(error = %e, "Failed to fetch chunk");
                    return Err(e);
                }
                Err(e) => {
                    tracing::error!(error = %e, "Task panicked while fetching chunk");
                    return Err(eyre::eyre!("Task panicked: {}", e));
                }
            }
        }

        Ok(results)
    }

    /// Set a value in Redis cache with TTL
    #[tracing::instrument(skip(self, value))]
    pub async fn set_cached<T: Serialize + Debug>(
        &self,
        cache_key: &str,
        value: &T,
        ttl_seconds: u64,
    ) -> eyre::Result<()> {
        tracing::debug!(cache_key = %cache_key, ttl_seconds = %ttl_seconds, "Setting cached value");

        let serialized = serde_json::to_string(value)
            .map_err(|e| eyre::eyre!("Failed to serialize value for caching: {}", e))?;

        let mut conn = self.redis_pool.get().await?;

        redis::cmd("SETEX")
            .arg(cache_key)
            .arg(ttl_seconds)
            .arg(&serialized)
            .exec_async(&mut conn)
            .await
            .map_err(|e| {
                tracing::error!(cache_key = %cache_key, error = %e, "Failed to set cache value");
                eyre::eyre!("Failed to cache value: {}", e)
            })?;

        tracing::debug!(cache_key = %cache_key, "Successfully cached value");
        Ok(())
    }

    /// Get cached value or compute and cache it if not found
    #[tracing::instrument(skip(self, compute_fn))]
    pub async fn get_or_set_cached<T, F, Fut>(
        &self,
        cache_key: &str,
        ttl_seconds: u64,
        compute_fn: F,
    ) -> eyre::Result<T>
    where
        T: Serialize + DeserializeOwned + Debug + Clone,
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = eyre::Result<T>>,
    {
        tracing::debug!(cache_key = %cache_key, "Checking cache or computing value");

        // Try to get from cache first
        if let Some(cached_value) = self.get_cached(cache_key).await? {
            tracing::debug!(cache_key = %cache_key, "Returning cached value");
            return Ok(cached_value);
        }

        // Cache miss - compute the value
        tracing::debug!(cache_key = %cache_key, "Cache miss - computing value");
        let computed_value = compute_fn().await?;

        // Cache the computed value
        self.set_cached(cache_key, &computed_value, ttl_seconds)
            .await?;

        tracing::debug!(cache_key = %cache_key, "Cached computed value");
        Ok(computed_value)
    }
}
