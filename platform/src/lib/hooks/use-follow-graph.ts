"use client";

import { useQuery } from "@tanstack/react-query";

export type GraphNode = {
  id: number;
  firstName: string;
  lastName: string;
  userLink: string;
  numFollowers: number;
  order: number;
};

export type GraphEdge = {
  source: number;
  target: number;
};

export type GraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type UseFollowGraphParams = {
  user_handle: string | undefined;
  order: number;
};

async function getFollowGraph(params: {
  user_handle: string;
  order: number;
}): Promise<GraphResponse> {
  const searchParams = new URLSearchParams({
    user_handle: params.user_handle,
    order: String(params.order),
  });
  const res = await fetch(`/api/follow-graph?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch follow graph");
  return res.json();
}

export function useFollowGraph(params: UseFollowGraphParams) {
  const { user_handle, order } = params;
  return useQuery<GraphResponse>({
    queryKey: ["followGraph", user_handle, order],
    queryFn: () => getFollowGraph({ user_handle: user_handle!, order }),
    enabled: Boolean(user_handle),
  });
}

