import { Schema, Effect } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";

const opt = <T extends Schema.Schema.All>(x: T) =>
  Schema.optional(Schema.NullOr(x));

// MARK: Base types
export const UserModel = Schema.Struct({
  id: Schema.Int,
  firstName: Schema.String,
  lastName: Schema.String,
  userLink: Schema.String,
  lastOnline: Schema.Date,
});

export const FollowingUser = Schema.Struct({
  id: Schema.Int,
  firstName: Schema.String,
  lastName: Schema.String,
  userLink: Schema.String,
  lastOnline: Schema.Date,
});

// Comment type - recursive type using suspend for self-reference
export const Comment = Schema.Struct({
  id: Schema.Int,
  userId: Schema.Int,
  user: opt(UserModel),
  parentId: opt(Schema.Int),
  text: Schema.String,
  createdDate: Schema.Date,
  modifiedDate: Schema.Date,
  replies: Schema.Any,
});

// Highlight depends on Comment
export const Highlight = Schema.Struct({
  id: Schema.Int,
  userId: Schema.Int,
  linkId: Schema.Int,
  highlight: Schema.String,
  createdDate: Schema.Date,
  leftContext: Schema.String,
  rightContext: Schema.String,
  rawHighlight: Schema.String,
  commentIds: opt(Schema.Array(Schema.NullOr(Schema.Int))),
  comment: opt(Comment),
});

// FollowWithOrder depends on FollowingUser
export const FollowWithOrder = Schema.Struct({
  followingUser: FollowingUser,
  order: Schema.Int,
});

// Content depends on Highlight and FollowWithOrder
export const Content = Schema.Struct({
  id: Schema.Int,
  link: Schema.String,
  title: Schema.String,
  favorite: Schema.Boolean,
  snippet: opt(Schema.String),
  toRead: opt(Schema.Boolean),
  createdBy: opt(Schema.Int),
  createdDate: Schema.String, // String date in Rust
  modifiedDate: Schema.String, // String date in Rust
  lastCrawled: opt(Schema.String),
  metadata: opt(Schema.Any), // serde_json::Value
  highlights: Schema.Array(Highlight),
  userIds: opt(Schema.Array(Schema.Int)),
  savedBy: opt(Schema.Array(FollowWithOrder)),
});

// UserProfile depends on FollowingUser
export const UserProfile = Schema.Struct({
  id: Schema.Int,
  firstName: Schema.String,
  lastName: Schema.String,
  userLink: Schema.String,
  major: opt(Schema.String),
  interests: opt(Schema.String),
  expertise: opt(Schema.String),
  school: opt(Schema.String),
  github: opt(Schema.String),
  twitter: opt(Schema.String),
  website: opt(Schema.String),
  createdDate: Schema.Date,
  modifiedDate: Schema.Date,
  lastOnline: Schema.Date,
  lastCheckedNotifications: Schema.Date,
  views: Schema.Int,
  numFollowers: Schema.Int,
  followed: opt(Schema.Boolean),
  followingMe: opt(Schema.Boolean),
  recentUsers: Schema.Array(FollowingUser),
  followingUsers: Schema.Array(FollowingUser),
});

// Response types
export const LinkResponse = Schema.Struct({
  userSaved: Schema.Array(Content),
});

export const UserResponse = Schema.Struct({
  user: UserProfile,
});

export const AllUsersResponse = Schema.Struct({
  users: Schema.Array(UserModel),
});
// MARK: APIs

const CURIUS_BASE = "https://curius.app/api";

export class CuriusAPIService extends Effect.Service<CuriusAPIService>()(
  "CuriusAPIService",
  {
    effect: Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient;
      const getAllUsers = () =>
        Effect.gen(function* () {
          const req = HttpClientRequest.get(`${CURIUS_BASE}/users/all`);
          const res = yield* client.execute(req);
          const data =
            yield* HttpClientResponse.schemaBodyJson(AllUsersResponse)(res);
          return data;
        });
      const getUserDetail = (userLink: string) =>
        Effect.gen(function* () {
          const req = HttpClientRequest.get(`${CURIUS_BASE}/users/${userLink}`);
          const res = yield* client.execute(req);
          const data =
            yield* HttpClientResponse.schemaBodyJson(UserResponse)(res);
          return data;
        });
      const getUserLinks = (userId: number, page: number = 0) =>
        Effect.gen(function* () {
          const req = HttpClientRequest.get(
            `${CURIUS_BASE}/users/${userId}/links?page=${page}`,
          );
          const res = yield* client.execute(req);
          const data =
            yield* HttpClientResponse.schemaBodyJson(LinkResponse)(res);
          return data;
        });
      return {
        getAllUsers,
        getUserDetail,
        getUserLinks,
      };
    }),
  },
) {}
