import type { DbUser } from "./queries/users";
import type { DbLink } from "./queries/links";
import type { User, FollowingUser, Content, FollowWithOrder } from "./types";

export function serializeUser(user: DbUser): User {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    userLink: user.userLink,
    lastOnline: user.lastOnline.toISOString(),
    numFollowers: user.numFollowers,
    profileMetadata: user.profileMetadata as User["profileMetadata"],
  };
}

export function serializeFollowingUser(user: DbUser): FollowingUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    userLink: user.userLink,
    lastOnline: user.lastOnline.toISOString(),
    numFollowers: user.numFollowers,
  };
}

export type SerializeFeedItemOptions = {
  usersMap: Map<number, DbUser>;
  savedByUserIds: number[];
  getOrder: (userId: number) => number;
};

export function serializeFeedItem(
  link: DbLink,
  options: SerializeFeedItemOptions,
): Content {
  const { usersMap, savedByUserIds, getOrder } = options;

  const savedBy: FollowWithOrder[] = savedByUserIds
    .map((uid) => {
      const u = usersMap.get(uid);
      if (!u) return null;
      return {
        followingUser: serializeFollowingUser(u),
        order: getOrder(uid),
      };
    })
    .filter((x): x is FollowWithOrder => x !== null);

  if (link.createdBy && !savedByUserIds.includes(link.createdBy)) {
    const creator = usersMap.get(link.createdBy);
    if (creator) {
      savedBy.unshift({
        followingUser: serializeFollowingUser(creator),
        order: getOrder(link.createdBy),
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
    lastCrawled: link.lastCrawled?.toISOString() ?? null,
    metadata: link.metadata,
    highlights: [],
    userIds: savedByUserIds,
    savedBy,
    timestamp: link.timestamp.toISOString(),
  };
}

export function serializeFollowWithOrder(
  user: DbUser,
  order: number,
): FollowWithOrder {
  return {
    followingUser: serializeFollowingUser(user),
    order,
  };
}
