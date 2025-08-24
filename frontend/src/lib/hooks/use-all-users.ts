import { useQuery } from "@tanstack/react-query";
import { getAllUsers } from "../api";
import type { AllUsersResponse } from "../api";

/**
 * Hook to fetch all users using TanStack Query
 * @returns Query result containing all users data
 */
export function useAllUsers() {
  return useQuery<AllUsersResponse>({
    queryKey: ["allUsers"],
    queryFn: getAllUsers,
  });
}
