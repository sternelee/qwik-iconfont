import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getSessionFromRequest } from "~/lib/session";
import { icons, projects } from "~/lib/schema";
import { eq, and, inArray } from "drizzle-orm";

/**
 * POST /api/projects/[id]/icons/reorder
 * Body: { iconIds: number[] }
 * Reorders icons by updating sort_order based on the provided array order.
 */
export const onPost: RequestHandler = async ({
  params,
  platform,
  request,
  json,
}) => {
  const session = await getSessionFromRequest(platform, request);
  if (!session) {
    json(401, { error: "Not authenticated" });
    return;
  }

  const db = getDB(platform);
  await initDB(db, platform);
  const projectId = parseInt(params.id, 10);

  // Verify project ownership
  const projectResult = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.user_id, session.user.id)),
    );
  if (!projectResult[0]) {
    json(404, { error: "Project not found" });
    return;
  }

  const body = (await request.json()) as { iconIds?: number[] };
  const iconIds = body.iconIds;
  if (!Array.isArray(iconIds) || iconIds.length === 0) {
    json(400, { error: "iconIds array is required" });
    return;
  }

  // Verify all icons belong to this project
  const existingIcons = await db
    .select({ id: icons.id })
    .from(icons)
    .where(and(eq(icons.project_id, projectId), inArray(icons.id, iconIds)));

  if (existingIcons.length !== iconIds.length) {
    json(403, { error: "Some icons do not belong to this project" });
    return;
  }

  // Update sort_order
  for (let i = 0; i < iconIds.length; i++) {
    await db
      .update(icons)
      .set({ sort_order: i })
      .where(eq(icons.id, iconIds[i]));
  }

  json(200, { success: true });
};
