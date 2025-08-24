import { useQuery } from "@tanstack/react-query";
import { getFollowList } from "../api";
import type { FollowWithOrder } from "../bindings/FollowWithOrder";

export type UseFollowListParams = {
  user_handle: string | undefined;
  order: number | string | bigint;
};

export function useFollowList(params: UseFollowListParams) {
  const { user_handle, order } = params;
  return useQuery<Array<FollowWithOrder>>({
    queryKey: ["followList", user_handle, order],
    queryFn: () => getFollowList({ user_handle: user_handle!, order }),
    enabled: Boolean(user_handle),
  });
}


