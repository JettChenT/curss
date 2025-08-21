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

pub async fn get_follow_list(
    State(ctx): State<Context>,
    Query(req): Query<FollowListRequest>,
) -> Result<Json<Vec<FollowWithOrder>>, AppError> {
    let follow_list = get_follow_list_inner(&ctx, req).await?;
    Ok(follow_list)
}

async fn get_follow_list_inner(
    ctx: &Context,
    req: FollowListRequest,
) -> Result<Json<Vec<FollowWithOrder>>, eyre::Report> {
    let user_profile = curius::get_user_profile(&ctx, &req.user_handle).await?;
    let follow_list = curius::get_follow_list(&ctx, user_profile.user, req.order).await?;
    Ok(Json(follow_list))
}

pub async fn get_feed(
    State(ctx): State<Context>,
    Query(req): Query<FeedRequest>,
) -> Result<Json<Vec<Content>>, AppError> {
    let feed = get_feed_inner(&ctx, req).await?;
    Ok(feed)
}

async fn get_feed_inner(
    ctx: &Context,
    req: FeedRequest,
) -> Result<Json<Vec<Content>>, eyre::Report> {
    // Validate limit doesn't exceed maximum allowed value
    let limit = std::cmp::min(req.limit, 500);

    // Get user profile for the provided handle
    let user_profile = curius::get_user_profile(&ctx, &req.user_handle).await?;

    // Get follow list to determine which users to fetch feed from
    let follow_list = curius::get_follow_list(&ctx, user_profile.user, req.order).await?;

    // Extract user IDs from the follow list
    let user_ids: Vec<i64> = follow_list
        .into_iter()
        .map(|follow| follow.following_user.id)
        .collect();

    // Fetch feed for these users with limit
    let feed = curius::fetch_feed(&ctx, user_ids, limit).await?;
    Ok(Json(feed))
}
