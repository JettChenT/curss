import { NextRequest, NextResponse } from "next/server";
import { generateRssFeed } from "feedsmith";
import { getUserByHandle, getUsersMap } from "@/lib/queries/users";
import {
  getLinksByUserIds,
  getGlobalLinks,
  getSavedByMap,
} from "@/lib/queries/links";
import {
  getFollowGraph,
  getUserIdsWithinDistance,
  getUserOrders,
  getUsersAtOrder,
} from "@/lib/graph";
import { serializeFeedItem } from "@/lib/formatters";

function parseParams(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  return {
    userHandle: searchParams.get("user_handle"),
    order: parseInt(searchParams.get("order") ?? "1", 10),
    limit: Math.min(parseInt(searchParams.get("limit") ?? "100", 10), 500),
    format: searchParams.get("format") ?? "json",
    search: searchParams.get("search")?.trim() ?? "",
  };
}

export async function GET(request: NextRequest) {
  const { userHandle, order, limit, format, search } = parseParams(request);

  let graph: Awaited<ReturnType<typeof getFollowGraph>> | null = null;
  let targetUserIds: number[] = [];

  if (userHandle) {
    const user = await getUserByHandle(userHandle);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (order === 0) {
      targetUserIds = [user.id];
    } else {
      graph = await getFollowGraph(user.id, order);
      targetUserIds = await getUserIdsWithinDistance(user.id, order);

      if (targetUserIds.length === 0) {
        return NextResponse.json([]);
      }
    }
  }

  const links =
    targetUserIds.length > 0
      ? await getLinksByUserIds(targetUserIds, { limit, search })
      : await getGlobalLinks({ limit, search });

  if (links.length === 0) {
    return NextResponse.json([]);
  }

  const linkIds = links.map((l) => l.id);
  const savedByMap = await getSavedByMap(linkIds);

  const allUserIds = new Set<number>();
  for (const link of links) {
    allUserIds.add(link.createdBy);
  }
  for (const userIds of savedByMap.values()) {
    for (const uid of userIds) {
      allUserIds.add(uid);
    }
  }

  const usersMap = await getUsersMap([...allUserIds]);

  const orderMap = graph ? getUserOrders(graph) : new Map<number, number>();
  const firstDegreeIds = graph ? getUsersAtOrder(graph, 1) : new Set<number>();

  const getOrder = (userId: number): number => {
    if (orderMap.has(userId)) return orderMap.get(userId)!;
    return firstDegreeIds.has(userId) ? 1 : 2;
  };

  const feed = links.map((link) =>
    serializeFeedItem(link, {
      usersMap,
      savedByUserIds: savedByMap.get(link.id) ?? [],
      getOrder,
    })
  );

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
        guid: { value: `curius-${item.id}` },
      })),
    });

    return new NextResponse(rss, {
      headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
    });
  }

  return NextResponse.json(feed);
}
