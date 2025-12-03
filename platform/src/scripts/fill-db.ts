import { Effect, Console } from "effect";
import { FetchHttpClient } from "@effect/platform";
import { CuriusAPIService } from "../lib/curius";
import { db } from "../lib/db";
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
  savedLinkToDb,
} from "../lib/converters";
import { inArray, gte } from "drizzle-orm";
import cliProgress from "cli-progress";

const program = Effect.gen(function* () {
  const api = yield* CuriusAPIService;

  // 1. Fetch all users from Curius
  yield* Console.log("Fetching all users from Curius...");
  const { users: allUsers } = yield* api.getAllUsers();
  yield* Console.log(`Found ${allUsers.length} users`);

  // Get existing user IDs from database (only fully processed users with numFollowers >= 0)
  const existingUsers = yield* Effect.tryPromise(() =>
    db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(gte(usersTable.numFollowers, 0)),
  );
  const existingUserIds = new Set(existingUsers.map((u) => u.id));
  yield* Console.log(`${existingUserIds.size} users already in database`);

  // Filter to only new users
  const newUsers = allUsers.filter((u) => !existingUserIds.has(u.id));
  yield* Console.log(`${newUsers.length} new users to process`);

  if (newUsers.length === 0) {
    yield* Console.log("No new users to process. Done!");
    return;
  }

  // Setup progress bar
  const progressBar = new cliProgress.SingleBar(
    {
      format:
        "Processing |{bar}| {percentage}% | {value}/{total} users (concurrency: 5)",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  );
  progressBar.start(newUsers.length, 0);

  // Shared counters for progress tracking
  let processed = 0;
  let errors = 0;
  const errorDetails: Array<{ user: string; error: string }> = [];

  // Create an effect for processing a single user
  const processUser = (user: (typeof newUsers)[number]) =>
    Effect.tryPromise(async () => {
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

      // Insert user profile (upsert to override placeholder data)
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

      // Insert follows (user's following list)
      if (profile.followingUsers.length > 0) {
        // First ensure all followed users exist in the users table
        const followingUserIds = profile.followingUsers.map((f) => f.id);
        const existingFollowedUsers = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(inArray(usersTable.id, followingUserIds));
        const existingFollowedUserIds = new Set(
          existingFollowedUsers.map((u) => u.id),
        );

        // Insert minimal user records for followed users that don't exist
        const missingFollowedUsers = profile.followingUsers.filter(
          (f) => !existingFollowedUserIds.has(f.id),
        );
        if (missingFollowedUsers.length > 0) {
          await db
            .insert(usersTable)
            .values(missingFollowedUsers.map(followingUserToDb))
            .onConflictDoNothing();
        }

        // Now insert follow relationships
        await db
          .insert(followsTable)
          .values(userFollowsToDb(profile))
          .onConflictDoNothing();
      }

      // Process links
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
          .values(savedLinkToDb(user.id, link.id))
          .onConflictDoNothing();
      }

      return { success: true };
    }).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          processed++;
          progressBar.update(processed);
        }),
      ),
      Effect.catchAll((error) =>
        Effect.sync(() => {
          errors++;
          processed++;
          progressBar.update(processed);
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
          return { success: false };
        }),
      ),
    );

  // 2. Process all users concurrently with max 5 concurrent operations
  yield* Effect.all(newUsers.map(processUser), { concurrency: 5 });

  progressBar.stop();
  yield* Console.log(`\nDone! Processed ${processed} users, ${errors} errors`);

  // Print error details if any
  if (errorDetails.length > 0) {
    yield* Console.log("\n--- Error Details ---");
    for (const { user, error } of errorDetails) {
      yield* Console.log(`\n❌ ${user}`);
      yield* Console.log(`   Error: ${error}`);
    }
  }
});

// Run the program
const main = program.pipe(
  Effect.provide(CuriusAPIService.Default),
  Effect.provide(FetchHttpClient.layer),
);

Effect.runPromise(main).catch(console.error);
