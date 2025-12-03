"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import type { Content } from "@/lib/types";

export type UseFeedParams = {
  user_handle: string | undefined;
  order: number;
  limit?: number;
};

async function getFeed(params: {
  user_handle: string;
  order: number;
  limit?: number;
}): Promise<Content[]> {
  const searchParams = new URLSearchParams({
    user_handle: params.user_handle,
    order: String(params.order),
    ...(params.limit ? { limit: String(params.limit) } : {}),
  });
  const res = await fetch(`/api/feed?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch feed");
  return res.json();
}

export function useFeed(params: UseFeedParams) {
  const { user_handle, order, limit } = params;
  return useQuery<Content[]>({
    queryKey: ["feed", user_handle, order, limit],
    queryFn: () =>
      getFeed({
        user_handle: user_handle!,
        order,
        limit,
      }),
    enabled: Boolean(user_handle),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}

