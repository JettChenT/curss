import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getUserByHandle, getUsersByIds } from "@/lib/queries/users";
import { getFollowGraph } from "@/lib/graph";
import { serializeFollowWithOrder } from "@/lib/formatters";
import type { FollowWithOrder } from "@/lib/types";

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

  const user = await getUserByHandle(userHandle);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const graph = await getFollowGraph(user.id, order);

  const result: FollowWithOrder[] = [serializeFollowWithOrder(user, 0)];

  for (let currentOrder = 1; currentOrder <= order; currentOrder++) {
    const idsAtOrder = graph.userIdsByOrder.get(currentOrder);
    if (!idsAtOrder || idsAtOrder.size === 0) continue;

    const usersAtOrder = await getUsersByIds([...idsAtOrder]);

    for (const u of usersAtOrder) {
      result.push(serializeFollowWithOrder(u, currentOrder));
    }
  }

  return NextResponse.json(result);
}
