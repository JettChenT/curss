import { useMemo } from "react";
import Fuse from "fuse.js";
import type { User } from "../bindings/User";
import { useAllUsers } from "./use-all-users";

export type UseSearchUsersOptions = {
  limit?: number;
};

export type UseSearchUsersResult = {
  results: Array<User>;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  total: number;
};

export function useSearchUsers(
  query: string,
  options?: UseSearchUsersOptions
): UseSearchUsersResult {
  const { data, isLoading, isError, error } = useAllUsers();

  const users = data?.users ?? [];

  const fuse = useMemo(() => {
    return new Fuse<User>(users, {
      includeScore: false,
      ignoreLocation: true,
      threshold: 0.4,
      keys: ["firstName", "lastName", "userLink"],
    });
  }, [users]);

  const trimmedQuery = query?.trim() ?? "";
  const results: Array<User> = useMemo(() => {
    const limit = options?.limit ?? 20;
    if (!trimmedQuery) return users.slice(0, limit);
    return fuse.search(trimmedQuery, { limit }).map((m) => m.item);
  }, [fuse, users, trimmedQuery, options?.limit]);

  return {
    results,
    isLoading,
    isError,
    error,
    total: users.length,
  };
}


