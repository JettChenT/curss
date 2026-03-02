import { type NextRequest, NextResponse } from "next/server";
import { serializeFollowingUser } from "@/lib/formatters";
import {
  getLinksByIds,
  getSavedByForLinks,
  getTopStoriesByDate,
} from "@/lib/queries/links";
import { getUsersMap } from "@/lib/queries/users";
import type { TopStoriesResponse, TopStory } from "@/lib/types";

function parseDateParam(dateStr: string | null): Date {
  if (dateStr) {
    const parsed = new Date(`${dateStr}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const dateParam = searchParams.get("date");
  const limit = Math.min(
    Math.max(parseInt(searchParams.get("limit") ?? "30", 10), 1),
    100,
  );

  const startDate = parseDateParam(dateParam);
  const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

  const topRows = await getTopStoriesByDate(startDate, endDate, limit);

  if (topRows.length === 0) {
    const response: TopStoriesResponse = {
      date: startDate.toISOString().slice(0, 10),
      stories: [],
    };
    return NextResponse.json(response);
  }

  const linkIds = topRows.map((r) => r.linkId);
  const [linksData, savedByMap] = await Promise.all([
    getLinksByIds(linkIds),
    getSavedByForLinks(linkIds, startDate, endDate),
  ]);

  const linksMap = new Map(linksData.map((l) => [l.id, l]));

  const allUserIds = new Set<number>();
  for (const link of linksData) {
    allUserIds.add(link.createdBy);
  }
  for (const userIds of savedByMap.values()) {
    for (const uid of userIds) {
      allUserIds.add(uid);
    }
  }

  const usersMap = await getUsersMap([...allUserIds]);

  const stories: TopStory[] = topRows
    .map((row) => {
      const link = linksMap.get(row.linkId);
      if (!link) return null;

      const saverIds = savedByMap.get(row.linkId) ?? [];
      const savedBy = saverIds
        .map((uid) => {
          const u = usersMap.get(uid);
          if (!u) return null;
          return { followingUser: serializeFollowingUser(u), order: 0 };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      return {
        id: link.id,
        link: link.link,
        title: link.title,
        snippet: link.snippet,
        createdBy: link.createdBy,
        lastCrawled: link.lastCrawled?.toISOString() ?? null,
        metadata: link.metadata,
        saveCount: row.saveCount,
        latestSave: new Date(row.latestSave).toISOString(),
        savedBy,
      };
    })
    .filter((x): x is TopStory => x !== null);

  const response: TopStoriesResponse = {
    date: startDate.toISOString().slice(0, 10),
    stories,
  };

  return NextResponse.json(response);
}
