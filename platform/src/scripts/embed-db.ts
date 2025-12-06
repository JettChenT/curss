import { Effect, Console } from "effect";
import { embedDb } from "../lib/embeddings";

const program = Effect.gen(function* () {
  yield* Console.log("Starting database embedding...\n");

  const result = yield* embedDb();

  yield* Console.log(`\n✓ Successfully embedded ${result.embedded} documents`);
  yield* Console.log(`  Total tokens used: ${result.tokens}`);
});

Effect.runPromiseExit(program).catch(console.error);
