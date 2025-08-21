// Curius API Client

pub mod model;
mod rss;

// Base URL for the Curius API
const BASE_URL: &str = "https://curius.app/api/";
// const BASE_URL: &str = "http://localhost:777/api/";

// Redis cache TTL: 6 hours = 21600 seconds
const CACHE_TTL_SECONDS: u64 = 21600;

use eyre::{Result, eyre};
use reqwest::Response;
use serde::de::DeserializeOwned;

use serde_path_to_error;
use std::collections::HashMap;

use crate::context::Context;
use crate::curius::model::{FollowWithOrder, FollowingUser, UserProfile};

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

#[tracing::instrument(skip(context))]
pub async fn get_content(context: &Context, user_id: i64) -> Result<model::LinkResponse> {
    let cache_key = format!("content:{}", user_id);

    context
        .get_or_set_cached(&cache_key, CACHE_TTL_SECONDS, || async {
            let url = format!("{BASE_URL}users/{user_id}/links?page=0");
            let response = context
                .http_client
                .get(&url)
                .send()
                .await
                .map_err(|e| eyre!("Failed to send request: {:?}", e))?;

            parse_json_response(response).await
        })
        .await
}

#[tracing::instrument(skip(context))]
pub async fn get_user_profile(context: &Context, user_handle: &str) -> Result<model::UserResponse> {
    let cache_key = format!("profile:{}", user_handle);

    context
        .get_or_set_cached(&cache_key, CACHE_TTL_SECONDS, || async {
            let url = format!("{BASE_URL}users/{user_handle}");
            let response = context
                .http_client
                .get(&url)
                .send()
                .await
                .map_err(|e| eyre!("Failed to send request: {:?}", e))?;

            parse_json_response(response).await
        })
        .await
}

#[tracing::instrument(skip(context))]
pub async fn get_follow_list(
    context: &Context,
    initial_user: UserProfile,
    order: i64,
) -> Result<Vec<FollowWithOrder>> {
    let cache_key = format!("follow_list:{}:{}", initial_user.id, order);

    context
        .get_or_set_cached(&cache_key, CACHE_TTL_SECONDS, || async {
            compute_follow_list(context, initial_user, order).await
        })
        .await
}

#[tracing::instrument(skip(context))]
async fn compute_follow_list(
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

    let final_result = user_map
        .into_iter()
        .map(|(_, follow)| follow)
        .collect::<Vec<FollowWithOrder>>();

    Ok(final_result)
}

#[tracing::instrument(skip(context))]
pub async fn fetch_feed(
    context: &Context,
    user_id: Vec<i64>,
    limit: usize,
) -> Result<Vec<model::Content>> {
    // Build cache keys for all user IDs
    let cache_keys: Vec<String> = user_id.iter().map(|id| format!("content:{}", id)).collect();

    // Try batch get from cache using MGET
    let cached: Vec<Option<model::LinkResponse>> = context.mget_cached(&cache_keys).await?;

    // Split into hits and misses, preserving association to user_id
    let mut link_responses: Vec<model::LinkResponse> = Vec::new();
    let mut missing_user_ids: Vec<i64> = Vec::new();
    for (idx, maybe_resp) in cached.into_iter().enumerate() {
        match maybe_resp {
            Some(resp) => link_responses.push(resp),
            None => missing_user_ids.push(user_id[idx]),
        }
    }

    // Fetch misses in parallel (each will populate cache via get_content)
    if !missing_user_ids.is_empty() {
        let fetch_tasks = missing_user_ids
            .iter()
            .map(|uid| async move { get_content(context, *uid).await });
        let fetched = futures::future::join_all(fetch_tasks).await;
        for item in fetched {
            match item {
                Ok(resp) => link_responses.push(resp),
                Err(e) => return Err(e),
            }
        }
    }

    // Flatten all content vectors
    let mut all_content: Vec<model::Content> = Vec::new();
    for lr in link_responses {
        all_content.extend(lr.user_saved);
    }

    // Sort by created_date (newest first)
    all_content.sort_by(|a, b| b.created_date.cmp(&a.created_date));

    // Deduplicate by ID
    all_content.dedup_by_key(|content| content.id);

    // Apply limit to get the most recent n items
    let limited_content = if all_content.len() > limit {
        all_content.into_iter().take(limit).collect()
    } else {
        all_content
    };

    Ok(limited_content)
}
