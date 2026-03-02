"use client";

import { useQuery } from "@tanstack/react-query";
import type { TopStoriesResponse } from "@/lib/types";

async function fetchTopStories(
  date: string,
  limit: number,
): Promise<TopStoriesResponse> {
  const params = new URLSearchParams({ date, limit: String(limit) });
  const res = await fetch(`/api/top-stories?${params}`);
  if (!res.ok) throw new Error("Failed to fetch top stories");
  return res.json();
}

export function useTopStories(date: string, limit = 30) {
  return useQuery<TopStoriesResponse>({
    queryKey: ["top-stories", date, limit],
    queryFn: () => fetchTopStories(date, limit),
    refetchInterval: 60000,
  });
}
