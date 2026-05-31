import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { projects } from "~/lib/schema";
import { eq, sql } from "drizzle-orm";

/**
 * POST /api/projects/[id]/stats
 * Body: { action: "view" | "download" }
 * Increment counters (idempotent — no auth required for views)
 */
export const onPost: RequestHandler = async ({
  params,
  platform,
  request,
  json,
}) => {
  const db = getDB(platform);
  await initDB(db, platform);
  const id = parseInt(params.id, 10);
  const body = (await request.json()) as { action?: string };
  const action = body.action;

  if (action === "view") {
    await db
      .update(projects)
      .set({ views_count: sql`${projects.views_count} + 1` })
      .where(eq(projects.id, id));
    json(200, { success: true });
    return;
  }

  if (action === "download") {
    await db
      .update(projects)
      .set({ downloads_count: sql`${projects.downloads_count} + 1` })
      .where(eq(projects.id, id));
    json(200, { success: true });
    return;
  }

  json(400, { error: "Invalid action" });
};
