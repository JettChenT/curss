import { headers } from "next/headers";
import { start } from "workflow/api";
import { syncWorkflow } from "@/app/workflows/sync-workflow";

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

// GET handler for Vercel cron jobs
export async function GET() {
  const isAuthed = await verifyAuth();
  if (!isAuthed) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await start(syncWorkflow);
    return Response.json({ message: "Sync started" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Sync error:", error);
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
