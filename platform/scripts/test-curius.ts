import { Effect } from "effect";
import { FetchHttpClient } from "@effect/platform";
import { CuriusAPIService } from "../src/lib/curius";

const program = Effect.gen(function* () {
  const curius = yield* CuriusAPIService;

  console.log("=== Testing CuriusAPIService ===\n");

  // Test getAllUsers
  console.log("1. Testing getAllUsers()...");
  const allUsers = yield* curius.getAllUsers();
  console.log(`   ✓ Found ${allUsers.users.length} users`);
  console.log(
    `   Sample user: ${allUsers.users[0]?.firstName} ${allUsers.users[0]?.lastName}\n`,
  );

  // Test getUserDetail
  console.log("2. Testing getUserDetail('kamal-nayan-bandaru')...");
  const userDetail = yield* curius.getUserDetail("kamal-nayan-bandaru");
  console.log(
    `   ✓ User: ${userDetail.user.firstName} ${userDetail.user.lastName}`,
  );
  console.log(`   School: ${userDetail.user.school ?? "N/A"}`);
  console.log(`   Followers: ${userDetail.user.numFollowers}`);
  console.log(`   Following: ${userDetail.user.followingUsers.length} users\n`);

  // Test getUserLinks
  console.log(`3. Testing getUserLinks(${userDetail.user.id}, 0)...`);
  const userLinks = yield* curius.getUserLinks(userDetail.user.id, 0);
  console.log(`   ✓ Found ${userLinks.userSaved.length} saved links`);
  if (userLinks.userSaved.length > 0) {
    const firstLink = userLinks.userSaved[0];
    console.log(`   First link: "${firstLink.title}"`);
    console.log(`   URL: ${firstLink.link}`);
    console.log(`   Highlights: ${firstLink.highlights.length}`);
  }

  console.log("\n=== All tests passed! ===");
});

const runnable = program.pipe(
  Effect.provide(CuriusAPIService.Default),
  Effect.provide(FetchHttpClient.layer),
);

Effect.runPromise(runnable).catch(console.error);

