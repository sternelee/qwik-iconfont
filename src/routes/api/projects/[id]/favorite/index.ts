import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getSessionFromRequest } from "~/lib/session";
import { favorites, projects } from "~/lib/schema";
import { eq, and } from "drizzle-orm";

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

  // Increment favorites_count
  await db
    .update(projects)
    .set({ favorites_count: (project.favorites_count || 0) + 1 })
    .where(eq(projects.id, projectId));

  json(200, {
    success: true,
    favorites_count: (project.favorites_count || 0) + 1,
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

  // Decrement favorites_count
  const newCount = Math.max(0, (project.favorites_count || 0) - 1);
  await db
    .update(projects)
    .set({ favorites_count: newCount })
    .where(eq(projects.id, projectId));

  json(200, { success: true, favorites_count: newCount });
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
