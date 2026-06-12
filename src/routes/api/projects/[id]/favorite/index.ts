import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getSessionFromRequest } from "~/lib/session";
import { favorites, projects } from "~/lib/schema";
import { eq, and, sql } from "drizzle-orm";

export const onPost: RequestHandler = async ({
  platform,
  request,
  json,
  params,
}) => {
  const session = await getSessionFromRequest(platform, request);
  if (!session) {
    json(401, { error: "Not authenticated" });
    return;
  }

  const db = getDB(platform);
  await initDB(db, platform);
  const projectId = parseInt(params.id, 10);

  // Check if project exists and is public
  const projectResult = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  const project = projectResult[0];
  if (!project) {
    json(404, { error: "Project not found" });
    return;
  }
  if (project.visibility !== "public") {
    json(403, { error: "Cannot favorite a private project" });
    return;
  }

  // Check if already favorited
  const existing = await db
    .select()
    .from(favorites)
    .where(
      and(
        eq(favorites.user_id, session.user.id),
        eq(favorites.project_id, projectId),
      ),
    );

  if (existing.length > 0) {
    json(409, { error: "Already favorited" });
    return;
  }

  // Add favorite
  await db.insert(favorites).values({
    user_id: session.user.id,
    project_id: projectId,
  });

  // Atomic increment favorites_count
  await db
    .update(projects)
    .set({ favorites_count: sql`${projects.favorites_count} + 1` })
    .where(eq(projects.id, projectId));

  // Read updated count
  const updated = await db
    .select({ favorites_count: projects.favorites_count })
    .from(projects)
    .where(eq(projects.id, projectId));

  json(200, {
    success: true,
    favorites_count: updated[0]?.favorites_count ?? 0,
  });
};

export const onDelete: RequestHandler = async ({
  platform,
  request,
  json,
  params,
}) => {
  const session = await getSessionFromRequest(platform, request);
  if (!session) {
    json(401, { error: "Not authenticated" });
    return;
  }

  const db = getDB(platform);
  await initDB(db, platform);
  const projectId = parseInt(params.id, 10);

  const projectResult = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  const project = projectResult[0];
  if (!project) {
    json(404, { error: "Project not found" });
    return;
  }

  // Remove favorite
  await db
    .delete(favorites)
    .where(
      and(
        eq(favorites.user_id, session.user.id),
        eq(favorites.project_id, projectId),
      ),
    );

  // Atomic decrement favorites_count (floor at 0)
  await db
    .update(projects)
    .set({ favorites_count: sql`MAX(${projects.favorites_count} - 1, 0)` })
    .where(eq(projects.id, projectId));

  // Read updated count
  const updated = await db
    .select({ favorites_count: projects.favorites_count })
    .from(projects)
    .where(eq(projects.id, projectId));

  json(200, { success: true, favorites_count: updated[0]?.favorites_count ?? 0 });
};

export const onGet: RequestHandler = async ({
  platform,
  request,
  json,
  params,
}) => {
  const session = await getSessionFromRequest(platform, request);
  if (!session) {
    json(401, { error: "Not authenticated" });
    return;
  }

  const db = getDB(platform);
  await initDB(db, platform);
  const projectId = parseInt(params.id, 10);

  const result = await db
    .select()
    .from(favorites)
    .where(
      and(
        eq(favorites.user_id, session.user.id),
        eq(favorites.project_id, projectId),
      ),
    );

  json(200, { favorited: result.length > 0 });
};
