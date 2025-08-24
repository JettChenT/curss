import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { getFeed } from "../api";
import type { Content } from "../bindings/Content";

export type UseFeedParams = {
  user_handle: string | undefined;
  order: number | string | bigint;
  limit?: number;
};

export function useFeed(params: UseFeedParams) {
  const { user_handle, order, limit } = params;
  return useQuery<Array<Content>>({
    queryKey: ["feed", user_handle, order, limit],
    queryFn: () =>
      getFeed({
        user_handle: user_handle!,
        order,
        limit,
        format: "json",
      }),
    enabled: Boolean(user_handle),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
}


