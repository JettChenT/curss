"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { Content } from "@/lib/types";

export type UseFeedParams = {
  user_handle: string | undefined;
  order: number;
  limit?: number;
  search?: string;
};

async function getFeed(params: {
  user_handle?: string;
  order: number;
  limit?: number;
  search?: string;
}): Promise<Content[]> {
  const searchParams = new URLSearchParams({
    order: String(params.order),
    ...(params.user_handle ? { user_handle: params.user_handle } : {}),
    ...(params.limit ? { limit: String(params.limit) } : {}),
    ...(params.search ? { search: params.search } : {}),
  });
  const res = await fetch(`/api/feed?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch feed");
  return res.json();
}

export function useFeed(params: UseFeedParams) {
  const { user_handle, order, limit, search } = params;
  return useQuery<Content[]>({
    queryKey: ["feed", user_handle ?? "global", order, limit, search ?? ""],
    queryFn: () =>
      getFeed({
        user_handle,
        order,
        limit,
        search,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 10000,
  });
}
