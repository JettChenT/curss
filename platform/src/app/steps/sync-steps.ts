import { syncDB } from "../../lib/sync";
import { embedDb } from "../../lib/embeddings";
import { Effect } from "effect";
import { CuriusAPIService } from "../../lib/curius";
import { FetchHttpClient } from "@effect/platform";

export async function syncCuriusToDbStep() {
  "use step";
  const result = await Effect.runPromise(
    syncDB().pipe(
      Effect.provide(CuriusAPIService.Default),
      Effect.provide(FetchHttpClient.layer),
    ),
  );

  return {
    success: true,
    processed: result.processed,
    errors: result.errors,
    errorDetails: result.errorDetails,
  };
}

export async function embedDbStep() {
  "use step";
  const result = await Effect.runPromise(embedDb());
  return {
    success: true,
    embedded: result.embedded,
    tokens: result.tokens,
  };
}
