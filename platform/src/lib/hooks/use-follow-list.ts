"use client";

import { useQuery } from "@tanstack/react-query";
import type { FollowWithOrder } from "@/lib/types";

export type UseFollowListParams = {
  user_handle: string | undefined;
  order: number;
};

async function getFollowList(params: {
  user_handle: string;
  order: number;
}): Promise<FollowWithOrder[]> {
  const searchParams = new URLSearchParams({
    user_handle: params.user_handle,
    order: String(params.order),
  });
  const res = await fetch(`/api/follow-list?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch follow list");
  return res.json();
}

export function useFollowList(params: UseFollowListParams) {
  const { user_handle, order } = params;
  return useQuery<FollowWithOrder[]>({
    queryKey: ["followList", user_handle, order],
    queryFn: () => getFollowList({ user_handle: user_handle!, order }),
    enabled: Boolean(user_handle),
  });
}
