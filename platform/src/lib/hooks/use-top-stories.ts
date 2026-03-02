"use client";

import { useQuery } from "@tanstack/react-query";
import type { TopStoriesPeriod, TopStoriesResponse } from "@/lib/types";

async function fetchTopStories(
  date: string,
  period: TopStoriesPeriod,
  limit: number,
): Promise<TopStoriesResponse> {
  const params = new URLSearchParams({
    date,
    period,
    limit: String(limit),
  });
  const res = await fetch(`/api/top-stories?${params}`);
  if (!res.ok) throw new Error("Failed to fetch top stories");
  return res.json();
}

export function useTopStories(
  date: string,
  period: TopStoriesPeriod = "day",
  limit = 30,
) {
  return useQuery<TopStoriesResponse>({
    queryKey: ["top-stories", date, period, limit],
    queryFn: () => fetchTopStories(date, period, limit),
    refetchInterval: 60000,
  });
}
