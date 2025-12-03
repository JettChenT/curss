import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  usersTable,
  followsTable,
  linksTable,
  savedLinksTable,
} from "@/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { generateRssFeed } from "feedsmith";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userHandle = searchParams.get("user_handle");
  const order = parseInt(searchParams.get("order") ?? "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500);
  const format = searchParams.get("format") ?? "json";

  let firstDegreeIds: number[] = [];
  let targetUserIds: number[] = [];

  // If no user_handle, return global feed (all recent links)
  if (userHandle) {
    // Find user by handle
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.userLink, userHandle))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // If order === 0, show only the user's own links
    if (order === 0) {
      targetUserIds = [user.id];
    } else {
      // Get 1st degree follows
      const firstDegreeFollows = await db
        .select({ followingId: followsTable.followingId })
        .from(followsTable)
        .where(eq(followsTable.followerId, user.id));

      firstDegreeIds = firstDegreeFollows.map((f) => f.followingId);

      if (firstDegreeIds.length === 0) {
        return NextResponse.json([]);
      }

      // Collect all user IDs we want content from
      targetUserIds = [...firstDegreeIds];

      // If order >= 2, include 2nd degree follows
      if (order >= 2) {
        const secondDegreeFollows = await db
          .select({ followingId: followsTable.followingId })
          .from(followsTable)
          .where(inArray(followsTable.followerId, firstDegreeIds));

        const secondDegreeIds = [
          ...new Set(secondDegreeFollows.map((f) => f.followingId)),
        ].filter((id) => id !== user.id && !firstDegreeIds.includes(id));

        targetUserIds = [...targetUserIds, ...secondDegreeIds];
      }
    }
  }

  // Get links - either filtered by target users or global (all links)
  const links = await db
    .select({
      id: linksTable.id,
      link: linksTable.link,
      title: linksTable.title,
      snippet: linksTable.snippet,
      createdBy: linksTable.createdBy,
      createdDate: linksTable.createdDate,
      modifiedDate: linksTable.modifiedDate,
      lastCrawled: linksTable.lastCrawled,
      metadata: linksTable.metadata,
    })
    .from(linksTable)
    .$dynamic()
    .where(targetUserIds.length > 0 ? inArray(linksTable.createdBy, targetUserIds) : undefined)
    .orderBy(desc(linksTable.modifiedDate))
    .limit(limit);

  // Build a map of users for savedBy info
  const allUserIds = [...new Set(links.map((l) => l.createdBy))];

  const usersMap = new Map<
    number,
    {
      id: number;
      firstName: string;
      lastName: string;
      userLink: string;
      lastOnline: string;
    }
  >();

  if (allUserIds.length > 0) {
    const users = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        userLink: usersTable.userLink,
        lastOnline: usersTable.lastOnline,
      })
      .from(usersTable)
      .where(inArray(usersTable.id, allUserIds));

    for (const u of users) {
      usersMap.set(u.id, {
        ...u,
        lastOnline: u.lastOnline.toISOString(),
      });
    }
  }

  // Get saved links info for additional savedBy context
  const linkIds = links.map((l) => l.id);
  const savedLinks =
    linkIds.length > 0
      ? await db
          .select({
            userId: savedLinksTable.userId,
            linkId: savedLinksTable.linkId,
          })
          .from(savedLinksTable)
          .where(inArray(savedLinksTable.linkId, linkIds))
      : [];

  // Group saved links by link ID
  const savedByMap = new Map<number, number[]>();
  for (const sl of savedLinks) {
    const arr = savedByMap.get(sl.linkId) ?? [];
    arr.push(sl.userId);
    savedByMap.set(sl.linkId, arr);
  }

  // Fetch additional users who saved these links
  const saverIds = [...new Set(savedLinks.map((sl) => sl.userId))].filter(
    (id) => !usersMap.has(id),
  );
  if (saverIds.length > 0) {
    const savers = await db
      .select({
        id: usersTable.id,
        firstName: usersTable.firstName,
        lastName: usersTable.lastName,
        userLink: usersTable.userLink,
        lastOnline: usersTable.lastOnline,
      })
      .from(usersTable)
      .where(inArray(usersTable.id, saverIds));

    for (const u of savers) {
      usersMap.set(u.id, {
        ...u,
        lastOnline: u.lastOnline.toISOString(),
      });
    }
  }

  // Format response
  const feed = links.map((link) => {
    const savedByUserIds = savedByMap.get(link.id) ?? [];
    const savedBy = savedByUserIds
      .map((uid) => {
        const u = usersMap.get(uid);
        if (!u) return null;
        return {
          followingUser: u,
          order: firstDegreeIds.includes(uid) ? 1 : 2,
        };
      })
      .filter(Boolean);

    // If creator is in our target users, add them to savedBy if not already
    if (link.createdBy && !savedByUserIds.includes(link.createdBy)) {
      const creator = usersMap.get(link.createdBy);
      if (creator) {
        savedBy.unshift({
          followingUser: creator,
          order: firstDegreeIds.includes(link.createdBy) ? 1 : 2,
        });
      }
    }

    return {
      id: link.id,
      link: link.link,
      title: link.title,
      favorite: false,
      snippet: link.snippet,
      toRead: null,
      createdBy: link.createdBy,
      createdDate: link.createdDate.toISOString(),
      modifiedDate: link.modifiedDate.toISOString(),
      lastCrawled: link.lastCrawled?.toISOString() ?? null,
      metadata: link.metadata,
      highlights: [],
      userIds: savedByUserIds,
      savedBy,
    };
  });

  // Return RSS feed if format is "rss"
  if (format === "rss") {
    const rss = generateRssFeed({
      title: `Curius - ${userHandle} - ${order} order feed`,
      link: `https://curius.app/${userHandle}`,
      description: `The curius network feed for ${userHandle} and their connections within the network (distance <= ${order})`,
      items: feed.map((item) => ({
        title: item.title ?? "Untitled",
        link: item.link,
        description: item.snippet ?? "",
        pubDate: new Date(item.modifiedDate),
        guid: {
          value: `curius-${item.id}`,
        },
      })),
    });

    return new NextResponse(rss, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
      },
    });
  }

  return NextResponse.json(feed);
}
