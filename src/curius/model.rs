use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

pub type UserId = i64;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Content {
    pub id: i64,
    pub link: String,
    pub title: String,
    pub favorite: bool,
    pub snippet: Option<String>,
    pub to_read: Option<bool>,
    pub created_by: Option<UserId>,
    pub created_date: String,
    pub modified_date: String,
    pub last_crawled: Option<String>,
    pub metadata: Option<Value>,
    #[serde(default)]
    pub highlights: Vec<Highlight>,
    pub user_ids: Option<Vec<UserId>>,

    // Field not in API response but added after post processing
    pub saved_by: Option<Vec<FollowWithOrder>>,
    // TODO: potentially, all highlights
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Comment {
    pub id: i64,
    pub user_id: UserId,
    pub user: Option<User>,
    pub parent_id: Option<i64>,
    pub text: String,
    pub created_date: DateTime<Utc>,
    pub modified_date: DateTime<Utc>,
    pub replies: Option<Vec<Comment>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct User {
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    pub user_link: String,
    pub last_online: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Highlight {
    id: i64,
    user_id: UserId,
    link_id: i64,
    highlight: String,
    created_date: DateTime<Utc>,
    left_context: String,
    right_context: String,
    raw_highlight: String,
    #[serde(rename = "comment_ids", default)]
    comment_ids: Vec<Option<i64>>,
    comment: Option<Comment>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct LinkResponse {
    pub user_saved: Vec<Content>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct FollowingUser {
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    pub user_link: String,
    pub last_online: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct FollowWithOrder {
    pub following_user: FollowingUser,
    pub order: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct UserProfile {
    pub id: i64,
    pub first_name: String,
    pub last_name: String,
    pub user_link: String,
    pub major: Option<String>,
    pub interests: Option<String>,
    pub expertise: Option<String>,
    pub school: Option<String>,
    pub github: Option<String>,
    pub twitter: Option<String>,
    pub website: Option<String>,
    pub created_date: DateTime<Utc>,
    pub modified_date: DateTime<Utc>,
    pub last_online: DateTime<Utc>,
    pub last_checked_notifications: DateTime<Utc>,
    pub views: i64,
    pub num_followers: i64,
    pub followed: Option<bool>,
    pub following_me: Option<bool>,
    #[serde(default)]
    pub recent_users: Vec<FollowingUser>,
    #[serde(default)]
    pub following_users: Vec<FollowingUser>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct UserResponse {
    pub user: UserProfile,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AllUsersResponse {
    pub users: Vec<User>,
}

impl Into<FollowingUser> for UserProfile {
    fn into(self) -> FollowingUser {
        FollowingUser {
            id: self.id,
            first_name: self.first_name,
            last_name: self.last_name,
            user_link: self.user_link,
            last_online: self.last_online,
        }
    }
}
