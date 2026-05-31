import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getSessionFromRequest } from "~/lib/session";
import { projects, icons, user } from "~/lib/schema";
import { eq, desc, count, lt, and, like, or } from "drizzle-orm";
import type { Project } from "~/lib/types";
import { getQuota } from "~/lib/quota";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

/** Shared select shape */
const projectSelect = {
  id: projects.id,
  user_id: projects.user_id,
  name: projects.name,
  description: projects.description,
  font_family: projects.font_family,
  prefix: projects.prefix,
  visibility: projects.visibility,
  favorites_count: projects.favorites_count,
  author_name: user.name,
  author_email: user.email,
  author_image: user.image,
  created_at: projects.created_at,
  updated_at: projects.updated_at,
  icon_count: count(icons.id),
};

export const onGet: RequestHandler = async ({
  platform,
  request,
  json,
  query,
}) => {
  const visibility = query.get("visibility");
  const q = query.get("q")?.trim() || "";
  // tag filter reserved for icon-level search (future)
  // const tag = query.get("tag")?.trim() || "";
  const limitParam = parseInt(query.get("limit") || String(DEFAULT_LIMIT), 10);
  const limit = Math.min(
    isNaN(limitParam) ? DEFAULT_LIMIT : limitParam,
    MAX_LIMIT,
  );
  const cursor = query.get("cursor"); // last project id (for keyset pagination)

  // ── Public project listing ──────────────────────────────────────
  if (visibility === "public") {
    const db = getDB(platform);
    await initDB(db, platform);

    // Build WHERE conditions
    const conditions: any[] = [eq(projects.visibility, "public")];
    if (q) {
      conditions.push(
        or(
          like(projects.name, `%${q}%`),
          like(projects.description, `%${q}%`),
          like(user.name, `%${q}%`),
        ),
      );
    }
    if (cursor) {
      // keyset: favorites_count < cursor_count OR (count = cursor_count AND id < cursor_id)
      // Simpler: paginate by id (desc updated_at is complex with ties); use offset-style via id
      conditions.push(lt(projects.id, parseInt(cursor, 10)));
    }

    const whereClause =
      conditions.length === 1 ? conditions[0] : and(...conditions);

    const result = await db
      .select(projectSelect)
      .from(projects)
      .leftJoin(icons, eq(projects.id, icons.project_id))
      .leftJoin(user, eq(projects.user_id, user.id))
      .where(whereClause)
      .groupBy(projects.id)
      .orderBy(desc(projects.favorites_count), desc(projects.id))
      .limit(limit + 1); // fetch one extra to detect hasMore

    const hasMore = result.length > limit;
    const items = hasMore ? result.slice(0, limit) : result;
    const nextCursor = hasMore ? String(items[items.length - 1].id) : null;

    json(200, {
      projects: items as (Project & { icon_count: number })[],
      nextCursor,
      hasMore,
      mode: "public",
    });
    return;
  }

  // ── Authenticated user project listing ─────────────────────────
  const session = await getSessionFromRequest(platform, request);
  if (!session) {
    json(401, { error: "Not authenticated" });
    return;
  }

  const db = getDB(platform);
  await initDB(db, platform);

  const conditions: any[] = [eq(projects.user_id, session.user.id)];
  if (q) {
    conditions.push(
      or(like(projects.name, `%${q}%`), like(projects.description, `%${q}%`)),
    );
  }
  if (cursor) {
    conditions.push(lt(projects.id, parseInt(cursor, 10)));
  }

  const whereClause =
    conditions.length === 1 ? conditions[0] : and(...conditions);

  const result = await db
    .select(projectSelect)
    .from(projects)
    .leftJoin(icons, eq(projects.id, icons.project_id))
    .leftJoin(user, eq(projects.user_id, user.id))
    .where(whereClause)
    .groupBy(projects.id)
    .orderBy(desc(projects.updated_at), desc(projects.id))
    .limit(limit + 1);

  const hasMore = result.length > limit;
  const items = hasMore ? result.slice(0, limit) : result;
  const nextCursor = hasMore ? String(items[items.length - 1].id) : null;

  json(200, {
    projects: items as (Project & { icon_count: number })[],
    nextCursor,
    hasMore,
    mode: "server",
  });
};

export const onPost: RequestHandler = async ({ platform, request, json }) => {
  const session = await getSessionFromRequest(platform, request);
  if (!session) {
    json(401, { error: "Not authenticated" });
    return;
  }
  const { getDB, initDB } = await import("~/lib/db");
  const db = getDB(platform);
  await initDB(db, platform);
  const { projects, user } = await import("~/lib/schema");
  const body = (await request.json()) as any;
  const { name, description, font_family, prefix, visibility } = body;

  if (!name || typeof name !== "string") {
    json(400, { error: "name is required" });
    return;
  }

  // Quota check
  const userResult = await db
    .select({ plan: user.plan })
    .from(user)
    .where(eq(user.id, session.user.id));
  const plan = userResult[0]?.plan ?? "free";
  const quota = getQuota(plan);

  if (quota.maxProjects !== Infinity) {
    const [{ count: projectCount }] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.user_id, session.user.id));
    if ((projectCount ?? 0) >= quota.maxProjects) {
      json(403, {
        error: `项目数量已达上限 (${quota.maxProjects} 个)。请升级 Pro 计划。`,
      });
      return;
    }
  }

  const result = await db
    .insert(projects)
    .values({
      user_id: session.user.id,
      name,
      description: description ?? null,
      font_family: font_family ?? "iconfont",
      prefix: prefix ?? "icon-",
      visibility: visibility ?? "private",
    })
    .returning();

  json(201, { id: result[0].id, project: result[0] });
};
