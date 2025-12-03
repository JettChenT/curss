import { Effect } from "effect";
import { FetchHttpClient } from "@effect/platform";
import { syncDB } from "../../../lib/sync";
import { CuriusAPIService } from "../../../lib/curius";
import { headers } from "next/headers";

const CRON_SECRET = process.env.CRON_SECRET;

async function verifyAuth(): Promise<boolean> {
  const headersList = await headers();
  const authHeader = headersList.get("authorization");

  if (!CRON_SECRET) {
    console.error("CRON_SECRET not configured");
    return false;
  }

  // Vercel cron jobs send: Authorization: Bearer <CRON_SECRET>
  if (authHeader === `Bearer ${CRON_SECRET}`) {
    return true;
  }

  return false;
}

async function runSync() {
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

// GET handler for Vercel cron jobs
export async function GET() {
  const isAuthed = await verifyAuth();
  if (!isAuthed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSync();
    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Sync error:", error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
