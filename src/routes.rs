use crate::context::Context;
use crate::curius::{
    self,
    model::{AllUsersResponse, Content, FollowWithOrder},
};
use axum::response::Response;
use axum::{
    Json,
    extract::{Query, State},
};
use axum::{http::StatusCode, response::IntoResponse};
use rss::{ChannelBuilder, Item};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FollowListRequest {
    user_handle: String,
    order: i64,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct FeedRequest {
    user_handle: String,
    order: i64,
    #[serde(default = "default_limit")]
    limit: usize,
    #[serde(default)]
    format: FeedFormat,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum FeedFormat {
    #[serde(rename = "json")]
    Json,
    #[serde(rename = "rss")]
    Rss,
}

impl Default for FeedFormat {
    fn default() -> Self {
        Self::Json
    }
}

fn default_limit() -> usize {
    100
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
) -> Result<Response, AppError> {
    tracing::info!("Getting feed for user");
    let feed = get_feed_inner(&ctx, &req).await?;
    tracing::info!(content_count = %feed.len(), "Retrieved feed content");
    match &req.format {
        FeedFormat::Json => Ok(Json(feed).into_response()),
        FeedFormat::Rss => {
            let rss_feed = ChannelBuilder::default()
                .title(format!("Curius - {} - {} order feed", &req.user_handle, &req.order))
                .description(format!("The curius network feed for {} and their connections within the network(distance <= {})", &req.user_handle, &req.order))
                .link(format!("https://curius.app/{}", &req.user_handle))
                .items(feed.iter().map(|content| content.clone().to_rss_item()).collect::<Result<Vec<Item>, eyre::Report>>()?)
                .build();
            Ok(rss_feed.to_string().into_response())
        }
    }
}

#[tracing::instrument(skip(ctx))]
async fn get_feed_inner(ctx: &Context, req: &FeedRequest) -> Result<Vec<Content>, eyre::Report> {
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

    // Fetch feed for these users with limit
    tracing::info!("Fetching feed content");
    let feed = curius::fetch_feed(&ctx, follow_list, limit).await?;
    tracing::info!(feed_items = %feed.len(), "Retrieved feed content from curius");

    Ok(feed)
}

#[tracing::instrument(skip(ctx))]
pub async fn get_all_users(State(ctx): State<Context>) -> Result<Json<AllUsersResponse>, AppError> {
    let users = get_all_users_inner(&ctx).await?;
    Ok(users)
}

#[tracing::instrument(skip(ctx))]
async fn get_all_users_inner(ctx: &Context) -> Result<Json<AllUsersResponse>, eyre::Report> {
    tracing::info!("Getting all users");
    let all_users = curius::get_all_users(&ctx).await?;
    tracing::info!(user_count = %all_users.users.len(), "Retrieved all users");
    Ok(Json(all_users))
}
