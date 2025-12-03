import {
  integer,
  pgTable,
  text,
  timestamp,
  jsonb,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const linksTable = pgTable(
  "links",
  {
    id: integer().primaryKey(),
    link: text().notNull(),
    title: text().notNull(),
    snippet: text().notNull(),
    fulltext: text(),
    createdBy: integer()
      .notNull()
      .references(() => usersTable.id),
    createdDate: timestamp().notNull(),
    modifiedDate: timestamp().notNull(),
    lastCrawled: timestamp().notNull(),
    metadata: jsonb(),
  },
  (table) => [index("links_created_by_idx").on(table.createdBy)],
);

export const usersTable = pgTable("users", {
  id: integer().primaryKey(),
  firstName: text().notNull(),
  lastName: text().notNull(),
  userLink: text().notNull(),
  lastOnline: timestamp().notNull(),
  numFollowers: integer().notNull(),
  profileMetadata: jsonb(),
});

export const followsTable = pgTable(
  "users_follows",
  {
    followerId: integer()
      .notNull()
      .references(() => usersTable.id),
    followingId: integer()
      .notNull()
      .references(() => usersTable.id),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followingId] }),
    index("follows_follower_idx").on(table.followerId),
    index("follows_following_idx").on(table.followingId),
  ],
);

export const savedLinksTable = pgTable(
  "saved_links",
  {
    userId: integer()
      .notNull()
      .references(() => usersTable.id),
    linkId: integer()
      .notNull()
      .references(() => linksTable.id),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.linkId] }),
    index("saved_links_user_idx").on(table.userId),
    index("saved_links_link_idx").on(table.linkId),
  ],
);

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  createdLinks: many(linksTable),
  savedLinks: many(savedLinksTable),
  followers: many(followsTable, { relationName: "followers" }),
  following: many(followsTable, { relationName: "following" }),
}));

export const linksRelations = relations(linksTable, ({ one, many }) => ({
  creator: one(usersTable, {
    fields: [linksTable.createdBy],
    references: [usersTable.id],
  }),
  savedBy: many(savedLinksTable),
}));

export const followsRelations = relations(followsTable, ({ one }) => ({
  follower: one(usersTable, {
    fields: [followsTable.followerId],
    references: [usersTable.id],
    relationName: "followers",
  }),
  following: one(usersTable, {
    fields: [followsTable.followingId],
    references: [usersTable.id],
    relationName: "following",
  }),
}));

export const savedLinksRelations = relations(savedLinksTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [savedLinksTable.userId],
    references: [usersTable.id],
  }),
  link: one(linksTable, {
    fields: [savedLinksTable.linkId],
    references: [linksTable.id],
  }),
}));
