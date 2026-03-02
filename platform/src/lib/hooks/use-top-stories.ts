"use client";

import { useQuery } from "@tanstack/react-query";
import type { TopStoriesPeriod, TopStoriesResponse } from "@/lib/types";

type UseTopStoriesParams = {
  date: string;
  period: TopStoriesPeriod;
  limit?: number;
  customStart?: string;
  customEnd?: string;
};

async function fetchTopStories(
  params: UseTopStoriesParams,
): Promise<TopStoriesResponse> {
  const searchParams = new URLSearchParams({
    period: params.period,
    limit: String(params.limit ?? 30),
  });

  if (params.period === "custom" && params.customStart && params.customEnd) {
    searchParams.set("start", params.customStart);
    searchParams.set("end", params.customEnd);
  } else {
    searchParams.set("date", params.date);
  }

  const res = await fetch(`/api/top-stories?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch top stories");
  return res.json();
}

export function useTopStories(params: UseTopStoriesParams) {
  const { date, period, limit = 30, customStart, customEnd } = params;
  return useQuery<TopStoriesResponse>({
    queryKey: ["top-stories", date, period, limit, customStart, customEnd],
    queryFn: () => fetchTopStories(params),
    refetchInterval: 60000,
  });
}
