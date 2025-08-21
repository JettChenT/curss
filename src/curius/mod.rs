// Curius API Client

pub mod model;

// Base URL for the Curius API
const BASE_URL: &str = "https://curius.app/api/";
// const BASE_URL: &str = "http://localhost:777/api/";

// Redis cache TTL: 6 hours = 21600 seconds
const CACHE_TTL_SECONDS: u64 = 21600;

use eyre::{Result, eyre};
use redis::Client as RedisClient;
use redis::aio::MultiplexedConnection;
use reqwest::Response;
use reqwest_middleware::ClientWithMiddleware;
use serde::de::DeserializeOwned;

use serde_path_to_error;
use std::collections::HashMap;

use crate::curius::model::{FollowWithOrder, FollowingUser, UserProfile};

/// Context object containing HTTP client and Redis connection
#[derive(Clone)]
pub struct Context {
    pub http_client: ClientWithMiddleware,
    pub redis_client: redis::Client,
    pub redis_conn: MultiplexedConnection,
}

impl Context {
    /// Get a Redis connection from the client
    pub async fn get_redis_connection(&self) -> Result<MultiplexedConnection> {
        Ok(self.redis_conn.clone())
    }
}

/// Convenience function to parse JSON response with detailed path-to-error diagnostics
async fn parse_json_response<T: DeserializeOwned>(response: Response) -> Result<T> {
    if !response.status().is_success() {
        return Err(eyre!(
            "HTTP request failed with status: {}",
            response.status()
        ));
    }

    let response_text = response
        .text()
        .await
        .map_err(|e| eyre!("Failed to read response text: {}", e))?;
    let jd = &mut serde_json::Deserializer::from_str(&response_text);
    let result: Result<T, _> = serde_path_to_error::deserialize(jd);

    match result {
        Ok(value) => Ok(value),
        Err(err) => {
            let path = err.path().to_string();
            Err(eyre!(
                "JSON deserialization failed at path '{}': {}",
                path,
                err
            ))
        }
    }
}

pub async fn get_content(context: &Context, user_id: i64) -> Result<model::LinkResponse> {
    let cache_key = format!("content:{}", user_id);

    // Try to get from Redis cache first
    let mut redis_conn = context.get_redis_connection().await?;

    if let Ok(cached_data) = redis::cmd("GET")
        .arg(&cache_key)
        .query_async::<String>(&mut redis_conn)
        .await
    {
        if let Ok(cached_response) = serde_json::from_str::<model::LinkResponse>(&cached_data) {
            return Ok(cached_response);
        }
    }

    // Cache miss - make API call
    let url = format!("{BASE_URL}users/{user_id}/links?page=0");
    let response = context
        .http_client
        .get(&url)
        .send()
        .await
        .map_err(|e| eyre!("Failed to send request: {:?}", e))?;

    let result = parse_json_response(response).await?;

    // Store in Redis cache
    let serialized =
        serde_json::to_string(&result).map_err(|e| eyre!("Failed to serialize response: {}", e))?;

    let _ = redis::cmd("SETEX")
        .arg(&cache_key)
        .arg(CACHE_TTL_SECONDS)
        .arg(&serialized)
        .exec_async(&mut redis_conn)
        .await?;

    Ok(result)
}

pub async fn get_user_profile(context: &Context, user_handle: &str) -> Result<model::UserResponse> {
    let cache_key = format!("profile:{}", user_handle);

    // Try to get from Redis cache first
    let mut redis_conn = context.get_redis_connection().await?;

    if let Ok(cached_data) = redis::cmd("GET")
        .arg(&cache_key)
        .query_async::<String>(&mut redis_conn)
        .await
    {
        if let Ok(cached_response) = serde_json::from_str::<model::UserResponse>(&cached_data) {
            return Ok(cached_response);
        }
    }

    // Cache miss - make API call
    let url = format!("{BASE_URL}users/{user_handle}");
    let response = context
        .http_client
        .get(&url)
        .send()
        .await
        .map_err(|e| eyre!("Failed to send request: {:?}", e))?;

    let result = parse_json_response(response).await?;

    // Store in Redis cache
    let serialized =
        serde_json::to_string(&result).map_err(|e| eyre!("Failed to serialize response: {}", e))?;

    let _ = redis::cmd("SETEX")
        .arg(&cache_key)
        .arg(CACHE_TTL_SECONDS)
        .arg(&serialized)
        .exec_async(&mut redis_conn)
        .await?;

    Ok(result)
}

pub async fn get_follow_list(
    context: &Context,
    initial_user: UserProfile,
    order: i64,
) -> Result<Vec<FollowWithOrder>> {
    let mut result: Vec<FollowWithOrder> = vec![FollowWithOrder {
        following_user: FollowingUser {
            id: initial_user.id,
            first_name: initial_user.first_name,
            last_name: initial_user.last_name,
            user_link: initial_user.user_link,
            last_online: initial_user.last_online,
        },
        order: 0,
    }];
    if order == 0 {
        return Ok(result);
    }
    let tasks = initial_user
        .following_users
        .iter()
        .map(async |user| {
            let user_detail = get_user_profile(context, &user.user_link).await?;
            let mut follow_list = get_follow_list(context, user_detail.user, order - 1).await?;
            follow_list.iter_mut().for_each(|follow| {
                follow.order += 1;
            });
            Ok::<Vec<FollowWithOrder>, eyre::Report>(follow_list)
        })
        .collect::<Vec<_>>();

    let follow_lists = futures::future::join_all(tasks).await;
    follow_lists
        .into_iter()
        .for_each(|follow_list| match follow_list {
            Ok(follow_list) => {
                result.extend(follow_list);
            }
            Err(e) => {
                eprintln!("Error: {}", e);
            }
        });

    // Deduplicate by FollowingUser's ID, keeping the record with the lowest order
    let mut user_map: HashMap<i64, FollowWithOrder> = HashMap::new();

    for follow in result {
        let user_id = follow.following_user.id;
        user_map
            .entry(user_id)
            .and_modify(|existing| {
                if follow.order < existing.order {
                    *existing = follow.clone();
                }
            })
            .or_insert(follow);
    }

    Ok(user_map.into_iter().map(|(_, follow)| follow).collect())
}

pub async fn fetch_feed(context: &Context, user_id: Vec<i64>) -> Result<Vec<model::Content>> {
    let tasks = user_id.iter().map(async |user_id| {
        let link_response = get_content(context, *user_id).await?;
        Ok::<Vec<model::Content>, eyre::Report>(link_response.user_saved)
    });
    let contents = futures::future::join_all(tasks).await;

    // Flatten all content vectors and collect errors
    let mut all_content = Vec::new();
    for result in contents {
        match result {
            Ok(content_vec) => all_content.extend(content_vec),
            Err(e) => return Err(e),
        }
    }

    // Sort by created_date (newest first)
    all_content.sort_by(|a, b| b.created_date.cmp(&a.created_date));

    // Deduplicate by ID
    all_content.dedup_by_key(|content| content.id);

    Ok(all_content)
}
