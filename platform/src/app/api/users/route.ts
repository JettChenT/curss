import { NextResponse } from "next/server";
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
    })
    .from(usersTable);

  return NextResponse.json({
    users: users.map((u) => ({
      ...u,
      lastOnline: u.lastOnline.toISOString(),
    })),
  });
}

