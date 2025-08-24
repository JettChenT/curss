import ky from "ky";
import type { FeedFormat } from "./bindings/FeedFormat";
import type { FollowWithOrder } from "./bindings/FollowWithOrder";
import type { Content } from "./bindings/Content";
import type { User } from "./bindings/User";

const RAW_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;
const API_BASE_URL = (RAW_BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const api = ky.create({
  prefixUrl: API_BASE_URL,
});

type IntegerLike = number | bigint | string;
function toStringInt(value: IntegerLike): string {
  return typeof value === "string" ? value : String(value);
}

export type AllUsersResponse = { users: Array<User> };

export async function getAllUsers(): Promise<AllUsersResponse> {
  return api.get("all-users").json<AllUsersResponse>();
}

export type FollowListQuery = {
  user_handle: string;
  order: IntegerLike;
};

export async function getFollowList(
  params: FollowListQuery
): Promise<Array<FollowWithOrder>> {
  return api
    .get("follow-list", {
      searchParams: {
        user_handle: params.user_handle,
        order: toStringInt(params.order),
      },
    })
    .json<Array<FollowWithOrder>>();
}

export type FeedQueryBase = {
  user_handle: string;
  order: IntegerLike;
  limit?: number;
  format?: FeedFormat;
};

export async function getFeed(
  params: Omit<FeedQueryBase, "format"> & { format: "json" }
): Promise<Array<Content>>;
export async function getFeed(
  params: Omit<FeedQueryBase, "format"> & { format: "rss" }
): Promise<string>;
export async function getFeed(
  params: FeedQueryBase
): Promise<Array<Content> | string> {
  const format: FeedFormat = params.format ?? "json";
  const searchParams: Record<string, string> = {
    user_handle: params.user_handle,
    order: toStringInt(params.order),
    ...(typeof params.limit === "number" ? { limit: String(params.limit) } : {}),
    format,
  };
  if (format === "rss") {
    return api.get("feed", { searchParams }).text();
  }
  return api.get("feed", { searchParams }).json<Array<Content>>();
}

export default api;
