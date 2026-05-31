import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getSessionFromRequest } from "~/lib/session";
import { projects, icons } from "~/lib/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/projects/[id]/fork
 *
 * Clone a public project into the authenticated user's account.
 * - Copies project metadata (name, description, font_family, prefix)
 * - Copies all icon records (svg_path points to the same R2 objects — read-only shared)
 * - New project starts as private
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
  const sourceId = parseInt(params.id, 10);

  // Load source project — must be public
  const sourceResult = await db
    .select()
    .from(projects)
    .where(eq(projects.id, sourceId));
  const source = sourceResult[0];

  if (!source) {
    json(404, { error: "Project not found" });
    return;
  }
  if (source.visibility !== "public") {
    json(403, { error: "Can only fork public projects" });
    return;
  }

  // Prevent forking your own project (just navigate to it)
  if (source.user_id === session.user.id) {
    json(409, { error: "Already your project", projectId: source.id });
    return;
  }

  // Load source icons
  const sourceIcons = await db
    .select()
    .from(icons)
    .where(eq(icons.project_id, sourceId))
    .orderBy(icons.created_at);

  // Create forked project
  const forkName = `${source.name} (fork)`;
  const newProjectResult = await db
    .insert(projects)
    .values({
      user_id: session.user.id,
      name: forkName,
      description: source.description,
      font_family: source.font_family,
      prefix: source.prefix,
      visibility: "private", // always start private
      favorites_count: 0,
    })
    .returning();

  const newProject = newProjectResult[0];
  if (!newProject) {
    json(500, { error: "Failed to create project" });
    return;
  }

  // Copy icon records (svg_path shared — no R2 copy needed for display)
  if (sourceIcons.length > 0) {
    const iconValues = sourceIcons.map((ic) => ({
      project_id: newProject.id,
      name: ic.name,
      unicode: ic.unicode,
      svg_path: ic.svg_path, // shared R2 reference (read-only)
      view_box: ic.view_box,
      width: ic.width,
      height: ic.height,
      content: ic.content,
      tags: ic.tags,
    }));

    // Insert in batches of 50 (D1 statement limit)
    for (let i = 0; i < iconValues.length; i += 50) {
      await db.insert(icons).values(iconValues.slice(i, i + 50));
    }
  }

  json(201, {
    success: true,
    projectId: newProject.id,
    name: forkName,
    iconCount: sourceIcons.length,
  });
};
