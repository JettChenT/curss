// Curius API Client

pub mod model;

// Base URL for the Curius API
const BASE_URL: &str = "https://curius.app/api/";
// const BASE_URL: &str = "http://localhost:777/api/";
use eyre::{Result, eyre};
use reqwest::{Client, Response};
use reqwest_middleware::ClientWithMiddleware;
use serde::de::DeserializeOwned;
use serde_path_to_error;
use std::collections::HashMap;

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

pub async fn get_content(
    client: &ClientWithMiddleware,
    user_id: i64,
) -> Result<model::LinkResponse> {
    let url = format!("{BASE_URL}users/{user_id}/links?page=0");

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| eyre!("Failed to send request: {:?}", e))?;
    parse_json_response(response).await
}

pub async fn get_user_profile(
    client: &ClientWithMiddleware,
    user_handle: &str,
) -> Result<model::UserResponse> {
    let url = format!("{BASE_URL}users/{user_handle}");

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| eyre!("Failed to send request: {:?}", e))?;
    parse_json_response(response).await
}

pub async fn get_follow_list(
    client: &ClientWithMiddleware,
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
            let user_detail = get_user_profile(client, &user.user_link).await?;
            let mut follow_list = get_follow_list(client, user_detail.user, order - 1).await?;
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
