import { Effect } from "effect";
import { FetchHttpClient } from "@effect/platform";
import { CuriusAPIService } from "./curius";
import { db } from "./db";
import {
  usersTable,
  linksTable,
  followsTable,
  savedLinksTable,
} from "../db/schema";
import {
  userProfileToDb,
  followingUserToDb,
  userFollowsToDb,
  contentToDb,
  contentToDbUpdate,
} from "./converters";
import { max } from "drizzle-orm";

export const syncDB = () =>
  Effect.gen(function* () {
    const api = yield* CuriusAPIService;

    // Get max timestamp and max ID from database
    const res = yield* Effect.tryPromise(() =>
      db
        .select({
          maxOnline: max(usersTable.lastOnline),
          maxId: max(usersTable.id),
        })
        .from(usersTable),
    );
    const maxTimestamp = res[0].maxOnline || new Date(0);
    const maxId = res[0].maxId || 0;

    // Fetch all users from API
    const { users: allUsers } = yield* api.getAllUsers();

    // Filter users that need updating (new or updated since last sync)
    const needUpdateUsers = allUsers.filter(
      (x) => x.lastOnline > maxTimestamp || x.id > maxId,
    );

    console.log(
      `Found ${needUpdateUsers.length} users to update out of ${allUsers.length} total`,
    );

    if (needUpdateUsers.length === 0) {
      console.log("No users to sync. Done!");
      return { processed: 0, errors: 0, errorDetails: [] };
    }

    // Track progress
    let processed = 0;
    let errors = 0;
    const errorDetails: Array<{ user: string; error: string }> = [];

    // Process a single user
    const processUser = (user: (typeof needUpdateUsers)[number]) =>
      Effect.tryPromise(async () => {
        const isNewUser = user.id > maxId;

        // Fetch user profile
        const { user: profile } = await Effect.runPromise(
          api
            .getUserDetail(user.userLink)
            .pipe(Effect.provide(FetchHttpClient.layer)),
        );

        // Fetch user links (first page only)
        const { userSaved: allLinks } = await Effect.runPromise(
          api
            .getUserLinks(user.id, 0)
            .pipe(Effect.provide(FetchHttpClient.layer)),
        );

        // Upsert user profile
        const userInsert = userProfileToDb(profile);
        await db
          .insert(usersTable)
          .values(userInsert)
          .onConflictDoUpdate({
            target: usersTable.id,
            set: {
              firstName: userInsert.firstName,
              lastName: userInsert.lastName,
              userLink: userInsert.userLink,
              lastOnline: userInsert.lastOnline,
              numFollowers: userInsert.numFollowers,
              profileMetadata: userInsert.profileMetadata,
            },
          });

        // Upsert follows (user's following list)
        if (profile.followingUsers.length > 0) {
          // Insert minimal user records for followed users (ignore conflicts)
          await db
            .insert(usersTable)
            .values(profile.followingUsers.map(followingUserToDb))
            .onConflictDoNothing();

          // Insert follow relationships
          await db
            .insert(followsTable)
            .values(userFollowsToDb(profile))
            .onConflictDoNothing();
        }

        // Process links - upsert each link and saved_link relationship
        // Count links modified after maxTimestamp as new
        const newLinksCount = allLinks.filter(
          (link) => new Date(link.modifiedDate) > maxTimestamp,
        ).length;

        for (const link of allLinks) {
          // Upsert link
          await db
            .insert(linksTable)
            .values(contentToDb(link, user.id))
            .onConflictDoUpdate({
              target: linksTable.id,
              set: contentToDbUpdate(link),
            });

          // Insert saved link relationship
          await db
            .insert(savedLinksTable)
            .values({
              linkId: link.id,
              userId: user.id,
              timestamp: new Date(link.createdDate),
            })
            .onConflictDoNothing();
        }

        return { success: true, isNewUser, newLinksCount };
      }).pipe(
        Effect.tap((result) =>
          Effect.sync(() => {
            processed++;
            const userStatus = result.isNewUser ? "🆕 NEW" : "📝";
            const linksInfo =
              result.newLinksCount > 0
                ? ` (+${result.newLinksCount} links)`
                : "";
            console.log(
              `[${processed}/${needUpdateUsers.length}] ${userStatus} ${user.firstName} ${user.lastName}${linksInfo}`,
            );
          }),
        ),
        Effect.catchAll((error) =>
          Effect.sync(() => {
            errors++;
            processed++;
            const errorMessage =
              error instanceof Error
                ? error.message
                : typeof error === "object" && error !== null
                  ? JSON.stringify(error)
                  : String(error);
            errorDetails.push({
              user: `${user.firstName} ${user.lastName} (${user.userLink}, id: ${user.id})`,
              error: errorMessage,
            });
            console.log(
              `[${processed}/${needUpdateUsers.length}] Error syncing ${user.firstName} ${user.lastName}: ${errorMessage}`,
            );
            return { success: false };
          }),
        ),
      );

    // Process all users concurrently with max 5 concurrent operations
    yield* Effect.all(needUpdateUsers.map(processUser), { concurrency: 5 });

    console.log(
      `\nSync complete! Processed ${processed} users, ${errors} errors`,
    );

    // Print error details if any
    if (errorDetails.length > 0) {
      console.log("\n--- Error Details ---");
      for (const { user, error } of errorDetails) {
        console.log(`\n❌ ${user}`);
        console.log(`   Error: ${error}`);
      }
    }

    return { processed, errors, errorDetails };
  });
