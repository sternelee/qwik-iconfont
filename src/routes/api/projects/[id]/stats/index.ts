import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { projects } from "~/lib/schema";
import { eq, sql } from "drizzle-orm";

const VALID_ACTIONS = new Set(["view", "download"]);

/**
 * POST /api/projects/[id]/stats
 * Body: { action: "view" | "download" }
 * Increment counters (idempotent — no auth required for views)
 * Rate limited: max 10 requests per IP per minute per project
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export const onPost: RequestHandler = async ({
  params,
  platform,
  request,
  json,
}) => {
  const db = getDB(platform);
  await initDB(db, platform);
  const id = parseInt(params.id, 10);
  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    json(400, { error: "Invalid JSON body" });
    return;
  }
  const action = body.action;

  if (!action || !VALID_ACTIONS.has(action)) {
    json(400, { error: "Invalid action. Must be 'view' or 'download'" });
    return;
  }

  // Verify project exists
  const [project] = await db
    .select({ id: projects.id, visibility: projects.visibility })
    .from(projects)
    .where(eq(projects.id, id));
  if (!project) {
    json(404, { error: "Project not found" });
    return;
  }

  // Rate limit: 10 req/min per IP per project
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const rateKey = `${ip}:${id}:${action}`;
  if (!checkRateLimit(rateKey, 10, 60_000)) {
    json(429, { error: "Too many requests" });
    return;
  }

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
};
