import { db } from "./db";
import { followsTable } from "../db/schema";
import { inArray } from "drizzle-orm";

export type FollowGraph = {
  rootUserId: number;
  userIdsByOrder: Map<number, Set<number>>;
};

async function getDirectFollowsBatch(userIds: number[]): Promise<number[]> {
  if (userIds.length === 0) return [];

  const follows = await db
    .select({ followingId: followsTable.followingId })
    .from(followsTable)
    .where(inArray(followsTable.followerId, userIds));

  return follows.map((f) => f.followingId);
}

export async function getFollowGraph(
  userId: number,
  maxOrder: number,
): Promise<FollowGraph> {
  const userIdsByOrder = new Map<number, Set<number>>();
  const seen = new Set<number>();

  userIdsByOrder.set(0, new Set([userId]));
  seen.add(userId);

  if (maxOrder === 0) {
    return { rootUserId: userId, userIdsByOrder };
  }

  for (let currentOrder = 1; currentOrder <= maxOrder; currentOrder++) {
    const previousOrder = userIdsByOrder.get(currentOrder - 1);
    if (!previousOrder || previousOrder.size === 0) break;

    const followIds = await getDirectFollowsBatch([...previousOrder]);

    const newAtThisOrder = new Set<number>();
    for (const id of followIds) {
      if (!seen.has(id)) {
        newAtThisOrder.add(id);
        seen.add(id);
      }
    }

    if (newAtThisOrder.size > 0) {
      userIdsByOrder.set(currentOrder, newAtThisOrder);
    }
  }

  return { rootUserId: userId, userIdsByOrder };
}

export function getUserIdsFromGraph(
  graph: FollowGraph,
  includeRoot = false,
): number[] {
  const result: number[] = [];

  for (const [order, ids] of graph.userIdsByOrder) {
    if (order === 0 && !includeRoot) continue;
    result.push(...ids);
  }

  return result;
}

export async function getUserIdsWithinDistance(
  userId: number,
  maxOrder: number,
  includeRoot = false,
): Promise<number[]> {
  const graph = await getFollowGraph(userId, maxOrder);
  return getUserIdsFromGraph(graph, includeRoot);
}

export function getUserOrders(graph: FollowGraph): Map<number, number> {
  const orderMap = new Map<number, number>();

  for (const [order, ids] of graph.userIdsByOrder) {
    for (const id of ids) {
      orderMap.set(id, order);
    }
  }

  return orderMap;
}

export function getUsersAtOrder(
  graph: FollowGraph,
  order: number,
): Set<number> {
  return graph.userIdsByOrder.get(order) ?? new Set();
}
