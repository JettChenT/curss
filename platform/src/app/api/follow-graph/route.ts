import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usersTable, followsTable } from "@/db/schema";
import { eq, inArray, and, or } from "drizzle-orm";

type GraphNode = {
  id: number;
  firstName: string;
  lastName: string;
  userLink: string;
  numFollowers: number;
  order: number;
};

type GraphEdge = {
  source: number;
  target: number;
};

type GraphResponse = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userHandle = searchParams.get("user_handle");
  const order = parseInt(searchParams.get("order") ?? "2", 10);

  if (!userHandle) {
    return NextResponse.json(
      { error: "user_handle is required" },
      { status: 400 },
    );
  }

  // Find root user by handle
  const [rootUser] = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      userLink: usersTable.userLink,
      numFollowers: usersTable.numFollowers,
    })
    .from(usersTable)
    .where(eq(usersTable.userLink, userHandle))
    .limit(1);

  if (!rootUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<number, GraphNode>();

  // Add root user
  const rootNode: GraphNode = { ...rootUser, order: 0 };
  nodes.push(rootNode);
  nodeMap.set(rootUser.id, rootNode);

  // Get 1st degree follows (people the root user follows)
  const firstDegreeFollows = await db
    .select({ followingId: followsTable.followingId })
    .from(followsTable)
    .where(eq(followsTable.followerId, rootUser.id));

  const firstDegreeIds = firstDegreeFollows.map((f) => f.followingId);

  if (firstDegreeIds.length === 0) {
    return NextResponse.json({ nodes, edges } satisfies GraphResponse);
  }

  // Get user details for 1st degree
  const firstDegreeUsers = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      userLink: usersTable.userLink,
      numFollowers: usersTable.numFollowers,
    })
    .from(usersTable)
    .where(inArray(usersTable.id, firstDegreeIds));

  // Add 1st degree nodes and edges from root
  for (const u of firstDegreeUsers) {
    const node: GraphNode = { ...u, order: 1 };
    nodes.push(node);
    nodeMap.set(u.id, node);
    edges.push({ source: rootUser.id, target: u.id });
  }

  // Get follows between 1st degree users (mutual follows within the same degree)
  if (firstDegreeIds.length > 1) {
    const intraFirstDegreeFollows = await db
      .select({
        followerId: followsTable.followerId,
        followingId: followsTable.followingId,
      })
      .from(followsTable)
      .where(
        and(
          inArray(followsTable.followerId, firstDegreeIds),
          inArray(followsTable.followingId, firstDegreeIds),
        ),
      );

    for (const f of intraFirstDegreeFollows) {
      edges.push({ source: f.followerId, target: f.followingId });
    }
  }

  // If order >= 2, get 2nd degree follows
  if (order >= 2 && firstDegreeIds.length > 0) {
    // Get all follows from 1st degree users
    const secondDegreeFollows = await db
      .select({
        followerId: followsTable.followerId,
        followingId: followsTable.followingId,
      })
      .from(followsTable)
      .where(inArray(followsTable.followerId, firstDegreeIds));

    // Filter to only 2nd degree users (not root or 1st degree)
    const secondDegreeIds = [
      ...new Set(secondDegreeFollows.map((f) => f.followingId)),
    ].filter((id) => id !== rootUser.id && !firstDegreeIds.includes(id));

    if (secondDegreeIds.length > 0) {
      // Get user details for 2nd degree
      const secondDegreeUsers = await db
        .select({
          id: usersTable.id,
          firstName: usersTable.firstName,
          lastName: usersTable.lastName,
          userLink: usersTable.userLink,
          numFollowers: usersTable.numFollowers,
        })
        .from(usersTable)
        .where(inArray(usersTable.id, secondDegreeIds));

      // Add 2nd degree nodes
      for (const u of secondDegreeUsers) {
        const node: GraphNode = { ...u, order: 2 };
        nodes.push(node);
        nodeMap.set(u.id, node);
      }

      // Add edges from 1st degree to 2nd degree (only those that exist)
      for (const f of secondDegreeFollows) {
        // Only add edge if target is a 2nd degree user
        if (secondDegreeIds.includes(f.followingId)) {
          edges.push({ source: f.followerId, target: f.followingId });
        }
      }
    }
  }

  return NextResponse.json({ nodes, edges } satisfies GraphResponse);
}

