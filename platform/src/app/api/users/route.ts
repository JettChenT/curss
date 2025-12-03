import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { usersTable } from "@/db/schema";

export async function GET() {
  const users = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      userLink: usersTable.userLink,
      lastOnline: usersTable.lastOnline,
      numFollowers: usersTable.numFollowers,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.numFollowers));

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      lastOnline: u.lastOnline.toISOString(),
    })),
  });
}

