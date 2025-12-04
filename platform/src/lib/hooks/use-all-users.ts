"use client";

import { useQuery } from "@tanstack/react-query";
import type { AllUsersResponse } from "@/lib/types";

async function getAllUsers(): Promise<AllUsersResponse> {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}

export function useAllUsers() {
  return useQuery<AllUsersResponse>({
    queryKey: ["allUsers"],
    queryFn: getAllUsers,
  });
}
