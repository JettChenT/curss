import { db } from "../db";
import { usersTable } from "../../db/schema";
import { eq, inArray } from "drizzle-orm";

export const userSelectFields = {
  id: usersTable.id,
  firstName: usersTable.firstName,
  lastName: usersTable.lastName,
  userLink: usersTable.userLink,
  lastOnline: usersTable.lastOnline,
  numFollowers: usersTable.numFollowers,
  profileMetadata: usersTable.profileMetadata,
} as const;

export type DbUser = {
  id: number;
  firstName: string;
  lastName: string;
  userLink: string;
  lastOnline: Date;
  numFollowers: number;
  profileMetadata: unknown;
};

export async function getUserByHandle(handle: string): Promise<DbUser | null> {
  const [user] = await db
    .select(userSelectFields)
    .from(usersTable)
    .where(eq(usersTable.userLink, handle))
    .limit(1);

  return user ?? null;
}

export async function getUserById(id: number): Promise<DbUser | null> {
  const [user] = await db
    .select(userSelectFields)
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  return user ?? null;
}

export async function getUsersByIds(ids: number[]): Promise<DbUser[]> {
  if (ids.length === 0) return [];

  return db
    .select(userSelectFields)
    .from(usersTable)
    .where(inArray(usersTable.id, ids));
}

export async function getUsersMap(ids: number[]): Promise<Map<number, DbUser>> {
  const users = await getUsersByIds(ids);
  return new Map(users.map((u) => [u.id, u]));
}
