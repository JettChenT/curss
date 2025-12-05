import { db } from "../db";
import { linksTable, savedLinksTable } from "../../db/schema";
import { desc, sql, inArray, eq } from "drizzle-orm";

/** Raw database link type */
export type DbLink = {
  id: number;
  link: string;
  title: string;
  snippet: string;
  createdBy: number;
  timestamp: Date;
  savedBy: number;
  lastCrawled: Date | null;
  metadata: unknown;
};

export type GetLinksOptions = {
  limit: number;
  search?: string;
};

function buildSearchCondition(search: string) {
  return sql`(
    setweight(to_tsvector('english', ${linksTable.title}), 'A') ||
    setweight(to_tsvector('english', ${linksTable.snippet}), 'B') ||
    setweight(to_tsvector('english', coalesce(${linksTable.fulltext}, '')), 'C')
  ) @@ websearch_to_tsquery('english', ${search})`;
}

/**
 * Creates a subquery that gets the latest save per link.
 * Uses DISTINCT ON (linkId) to deduplicate, ordered by timestamp desc.
 */
function createLatestSavesSubquery(userIds?: number[]) {
  const baseQuery = db
    .selectDistinctOn([savedLinksTable.linkId], {
      linkId: savedLinksTable.linkId,
      timestamp: savedLinksTable.timestamp,
      savedBy: savedLinksTable.userId,
    })
    .from(savedLinksTable);

  if (userIds && userIds.length > 0) {
    return baseQuery
      .where(inArray(savedLinksTable.userId, userIds))
      .orderBy(savedLinksTable.linkId, desc(savedLinksTable.timestamp))
      .as("latest_saves");
  }

  return baseQuery
    .orderBy(savedLinksTable.linkId, desc(savedLinksTable.timestamp))
    .as("latest_saves");
}

export async function getLinksByUserIds(
  userIds: number[],
  options: GetLinksOptions,
): Promise<DbLink[]> {
  const { limit, search } = options;

  if (userIds.length === 0) return [];

  // Subquery: get the latest save per link from specified users
  const latestSaves = createLatestSavesSubquery(userIds);

  const query = db
    .select({
      id: linksTable.id,
      link: linksTable.link,
      title: linksTable.title,
      snippet: linksTable.snippet,
      createdBy: linksTable.createdBy,
      lastCrawled: linksTable.lastCrawled,
      metadata: linksTable.metadata,
      timestamp: latestSaves.timestamp,
      savedBy: latestSaves.savedBy,
    })
    .from(latestSaves)
    .innerJoin(linksTable, eq(latestSaves.linkId, linksTable.id))
    .$dynamic();

  const searchCondition = search?.trim()
    ? buildSearchCondition(search.trim())
    : undefined;

  if (searchCondition) {
    query.where(searchCondition);
  }

  return query.orderBy(desc(latestSaves.timestamp)).limit(limit);
}

export async function getGlobalLinks(
  options: GetLinksOptions,
): Promise<DbLink[]> {
  const { limit, search } = options;

  // Subquery: get the latest save per link (across all users)
  const latestSaves = createLatestSavesSubquery();

  const query = db
    .select({
      id: linksTable.id,
      link: linksTable.link,
      title: linksTable.title,
      snippet: linksTable.snippet,
      createdBy: linksTable.createdBy,
      lastCrawled: linksTable.lastCrawled,
      metadata: linksTable.metadata,
      timestamp: latestSaves.timestamp,
      savedBy: latestSaves.savedBy,
    })
    .from(latestSaves)
    .innerJoin(linksTable, eq(latestSaves.linkId, linksTable.id))
    .$dynamic();

  const searchCondition = search?.trim()
    ? buildSearchCondition(search.trim())
    : undefined;

  if (searchCondition) {
    query.where(searchCondition);
  }

  return query.orderBy(desc(latestSaves.timestamp)).limit(limit);
}

export type SavedLinkRelation = {
  userId: number;
  linkId: number;
};

export async function getSavedLinkRelations(
  linkIds: number[],
): Promise<SavedLinkRelation[]> {
  if (linkIds.length === 0) return [];

  return db
    .select({
      userId: savedLinksTable.userId,
      linkId: savedLinksTable.linkId,
    })
    .from(savedLinksTable)
    .where(inArray(savedLinksTable.linkId, linkIds));
}

export async function getSavedByMap(
  linkIds: number[],
): Promise<Map<number, number[]>> {
  const relations = await getSavedLinkRelations(linkIds);

  const savedByMap = new Map<number, number[]>();
  for (const { linkId, userId } of relations) {
    const arr = savedByMap.get(linkId) ?? [];
    arr.push(userId);
    savedByMap.set(linkId, arr);
  }

  return savedByMap;
}
