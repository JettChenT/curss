import type { Schema } from "effect";
import type { UserProfile, FollowingUser, Content } from "./curius";
import type {
  usersTable,
  linksTable,
  followsTable,
  savedLinksTable,
} from "../db/schema";

// Curius API types
type CuriusUserProfile = Schema.Schema.Type<typeof UserProfile>;
type CuriusFollowingUser = Schema.Schema.Type<typeof FollowingUser>;
type CuriusContent = Schema.Schema.Type<typeof Content>;

// Database insert types
type UserInsert = typeof usersTable.$inferInsert;
type LinkInsert = typeof linksTable.$inferInsert;
type FollowInsert = typeof followsTable.$inferInsert;
type SavedLinkInsert = typeof savedLinksTable.$inferInsert;

/**
 * Convert a full Curius user profile to database user insert
 */
export function userProfileToDb(profile: CuriusUserProfile): UserInsert {
  return {
    id: profile.id,
    firstName: profile.firstName,
    lastName: profile.lastName,
    userLink: profile.userLink,
    lastOnline: profile.lastOnline,
    numFollowers: profile.numFollowers,
    profileMetadata: {
      major: profile.major ?? null,
      interests: profile.interests ?? null,
      expertise: profile.expertise ?? null,
      school: profile.school ?? null,
      github: profile.github ?? null,
      twitter: profile.twitter ?? null,
      website: profile.website ?? null,
    },
  };
}

/**
 * Convert a Curius following user to minimal database user insert
 */
export function followingUserToDb(user: CuriusFollowingUser): UserInsert {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    userLink: user.userLink,
    lastOnline: user.lastOnline,
    numFollowers: -1, // Mark as placeholder
    profileMetadata: null,
  };
}

/**
 * Convert a user profile's following list to database follow inserts
 */
export function userFollowsToDb(profile: CuriusUserProfile): FollowInsert[] {
  return profile.followingUsers.map((f) => ({
    followerId: profile.id,
    followingId: f.id,
  }));
}

/**
 * Convert a Curius content/link to database link insert
 * Extracts fulltext from metadata if available
 */
export function contentToDb(
  content: CuriusContent,
  fallbackCreatedBy: number,
): LinkInsert {
  const metadata = content.metadata as Record<string, unknown> | null;

  // Extract fulltext from metadata if available
  const fulltext =
    metadata && typeof metadata.full_text === "string"
      ? metadata.full_text
      : null;

  // Remove fulltext from metadata to avoid duplication
  const cleanMetadata = metadata
    ? Object.fromEntries(
        Object.entries(metadata).filter(([key]) => key !== "full_text"),
      )
    : null;

  // Parse dates (they come as strings from API)
  const modifiedDate = new Date(content.modifiedDate);
  const lastCrawled = content.lastCrawled
    ? new Date(content.lastCrawled)
    : modifiedDate;

  return {
    id: content.id,
    link: content.link,
    title: content.title,
    snippet: content.snippet ?? "",
    fulltext,
    createdBy: content.createdBy ?? fallbackCreatedBy,
    lastCrawled,
    metadata: cleanMetadata,
  };
}

/**
 * Get the update fields for upserting a link
 */
export function contentToDbUpdate(
  content: CuriusContent,
): Partial<Omit<LinkInsert, "id" | "createdBy" | "createdDate">> {
  const metadata = content.metadata as Record<string, unknown> | null;

  const fulltext =
    metadata && typeof metadata.full_text === "string"
      ? metadata.full_text
      : null;

  const cleanMetadata = metadata
    ? Object.fromEntries(
        Object.entries(metadata).filter(([key]) => key !== "full_text"),
      )
    : null;

  const lastCrawled = content.lastCrawled
    ? new Date(content.lastCrawled)
    : null;

  return {
    title: content.title,
    snippet: content.snippet ?? "",
    fulltext,
    lastCrawled,
    metadata: cleanMetadata,
  };
}

/**
 * Create a saved link insert from user id and link id
 */
export function savedLinkToDb(
  userId: number,
  linkId: number,
  linkCreatedAt: Date,
): SavedLinkInsert {
  return { userId, linkId, timestamp: linkCreatedAt };
}
