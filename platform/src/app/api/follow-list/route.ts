import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usersTable, followsTable } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userHandle = searchParams.get("user_handle");
  const order = parseInt(searchParams.get("order") ?? "1", 10);

  if (!userHandle) {
    return NextResponse.json(
      { error: "user_handle is required" },
      { status: 400 },
    );
  }

  // Find user by handle
  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.userLink, userHandle))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get 1st degree follows
  const firstDegreeFollows = await db
    .select({ followingId: followsTable.followingId })
    .from(followsTable)
    .where(eq(followsTable.followerId, user.id));

  const firstDegreeIds = firstDegreeFollows.map((f) => f.followingId);

  if (firstDegreeIds.length === 0) {
    return NextResponse.json([]);
  }

  // Get user details for 1st degree
  const firstDegreeUsers = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      userLink: usersTable.userLink,
      lastOnline: usersTable.lastOnline,
      numFollowers: usersTable.numFollowers,
    })
    .from(usersTable)
    .where(inArray(usersTable.id, firstDegreeIds));

  const result: Array<{
    followingUser: {
      id: number;
      firstName: string;
      lastName: string;
      userLink: string;
      lastOnline: string;
      numFollowers: number;
    };
    order: number;
  }> = firstDegreeUsers.map((u) => ({
    followingUser: {
      ...u,
      lastOnline: u.lastOnline.toISOString(),
    },
    order: 1,
  }));

  // If order >= 2, get 2nd degree follows
  if (order >= 2) {
    const secondDegreeFollows = await db
      .select({ followingId: followsTable.followingId })
      .from(followsTable)
      .where(inArray(followsTable.followerId, firstDegreeIds));

    const secondDegreeIds = [
      ...new Set(secondDegreeFollows.map((f) => f.followingId)),
    ].filter((id) => id !== user.id && !firstDegreeIds.includes(id));

    if (secondDegreeIds.length > 0) {
      const secondDegreeUsers = await db
        .select({
          id: usersTable.id,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          userLink: usersTable.userLink,
          lastOnline: usersTable.lastOnline,
          numFollowers: usersTable.numFollowers,
        })
        .from(usersTable)
        .where(inArray(usersTable.id, secondDegreeIds));

      for (const u of secondDegreeUsers) {
        result.push({
          followingUser: {
            ...u,
            lastOnline: u.lastOnline.toISOString(),
          },
          order: 2,
        });
      }
    }
  }

  return NextResponse.json(result);
}
