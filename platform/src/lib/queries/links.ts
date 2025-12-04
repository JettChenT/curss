import { db } from "../db";
import { linksTable, savedLinksTable } from "../../db/schema";
import { desc, sql, and, inArray } from "drizzle-orm";

/** Raw database link type */
export type DbLink = {
  id: number;
  link: string;
  title: string;
  snippet: string;
  createdBy: number;
  createdDate: Date;
  modifiedDate: Date;
  lastCrawled: Date;
  metadata: unknown;
};

export const linkSelectFields = {
  id: linksTable.id,
  link: linksTable.link,
  title: linksTable.title,
  snippet: linksTable.snippet,
  createdBy: linksTable.createdBy,
  createdDate: linksTable.createdDate,
  modifiedDate: linksTable.modifiedDate,
  lastCrawled: linksTable.lastCrawled,
  metadata: linksTable.metadata,
} as const;

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

export async function getLinksByUserIds(
  userIds: number[],
  options: GetLinksOptions,
): Promise<DbLink[]> {
  const { limit, search } = options;

  if (userIds.length === 0) return [];

  const userCondition = inArray(linksTable.createdBy, userIds);
  const searchCondition = search?.trim()
    ? buildSearchCondition(search.trim())
    : undefined;

  const whereCondition = searchCondition
    ? and(userCondition, searchCondition)
    : userCondition;

  return db
    .select(linkSelectFields)
    .from(linksTable)
    .where(whereCondition)
    .orderBy(desc(linksTable.modifiedDate))
    .limit(limit);
}

export async function getGlobalLinks(
  options: GetLinksOptions,
): Promise<DbLink[]> {
  const { limit, search } = options;

  const searchCondition = search?.trim()
    ? buildSearchCondition(search.trim())
    : undefined;

  const query = db.select(linkSelectFields).from(linksTable).$dynamic();

  if (searchCondition) {
    query.where(searchCondition);
  }

  return query.orderBy(desc(linksTable.modifiedDate)).limit(limit);
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
