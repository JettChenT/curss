use crate::context::Context;
use crate::curius::{
    self,
    model::{Content, FollowWithOrder},
};
use axum::response::Response;
use axum::{
    Json,
    extract::{Query, State},
};
use axum::{http::StatusCode, response::IntoResponse};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct FollowListRequest {
    user_handle: String,
    order: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FeedRequest {
    user_handle: String,
    order: i64,
    #[serde(default = "default_limit")]
    limit: usize,
}

fn default_limit() -> usize {
    50
}

pub struct AppError(eyre::Report);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Something went wrong: {}", self.0),
        )
            .into_response()
    }
}

impl<E> From<E> for AppError
where
    E: Into<eyre::Report>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}

#[tracing::instrument(skip(ctx))]
pub async fn get_follow_list(
    State(ctx): State<Context>,
    Query(req): Query<FollowListRequest>,
) -> Result<Json<Vec<FollowWithOrder>>, AppError> {
    let follow_list = get_follow_list_inner(&ctx, req).await?;
    Ok(follow_list)
}

#[tracing::instrument(skip(ctx))]
async fn get_follow_list_inner(
    ctx: &Context,
    req: FollowListRequest,
) -> Result<Json<Vec<FollowWithOrder>>, eyre::Report> {
    tracing::info!("Getting user profile");
    let user_profile = curius::get_user_profile(&ctx, &req.user_handle).await?;
    tracing::info!(user_id = %user_profile.user.id, "Retrieved user profile");

    tracing::info!("Getting follow list");
    let follow_list = curius::get_follow_list(&ctx, user_profile.user, req.order).await?;
    tracing::info!(follow_count = %follow_list.len(), "Retrieved follow list from curius");

    Ok(Json(follow_list))
}

#[tracing::instrument(skip(ctx))]
pub async fn get_feed(
    State(ctx): State<Context>,
    Query(req): Query<FeedRequest>,
) -> Result<Json<Vec<Content>>, AppError> {
    tracing::info!("Getting feed for user");
    let feed = get_feed_inner(&ctx, req).await?;
    tracing::info!(content_count = %feed.0.len(), "Retrieved feed content");
    Ok(feed)
}

#[tracing::instrument(skip(ctx))]
async fn get_feed_inner(
    ctx: &Context,
    req: FeedRequest,
) -> Result<Json<Vec<Content>>, eyre::Report> {
    // Validate limit doesn't exceed maximum allowed value
    let limit = std::cmp::min(req.limit, 500);
    tracing::info!(validated_limit = %limit, "Validated and adjusted feed limit");

    // Get user profile for the provided handle
    tracing::info!("Getting user profile");
    let user_profile = curius::get_user_profile(&ctx, &req.user_handle).await?;
    tracing::info!(user_id = %user_profile.user.id, "Retrieved user profile");

    // Get follow list to determine which users to fetch feed from
    tracing::info!("Getting follow list for feed");
    let follow_list = curius::get_follow_list(&ctx, user_profile.user, req.order).await?;
    tracing::info!(following_count = %follow_list.len(), "Retrieved follow list");

    // Extract user IDs from the follow list
    let user_ids: Vec<i64> = follow_list
        .into_iter()
        .map(|follow| follow.following_user.id)
        .collect();
    tracing::info!(user_ids_count = %user_ids.len(), "Extracted user IDs from follow list");

    // Fetch feed for these users with limit
    tracing::info!("Fetching feed content");
    let feed = curius::fetch_feed(&ctx, user_ids, limit).await?;
    tracing::info!(feed_items = %feed.len(), "Retrieved feed content from curius");

    Ok(Json(feed))
}
