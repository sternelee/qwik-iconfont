import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { uploadSVG, deleteSVG } from "~/lib/storage";
import { getSessionFromRequest } from "~/lib/session";
import { icons, projects, projectMembers } from "~/lib/schema";
import { eq, and } from "drizzle-orm";
import { resolveSvgViewBox, type Icon } from "~/lib/types";

async function canEditProject(
  db: any,
  projectId: number,
  userId: string,
): Promise<boolean> {
  const [project] = await db
    .select({ user_id: projects.user_id })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (project?.user_id === userId) return true;

  const [member] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.project_id, projectId),
        eq(projectMembers.user_id, userId),
      ),
    );
  return member?.role === "editor";
}

export const onGet: RequestHandler = async ({
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
  const id = parseInt(params.id, 10);

  // Get icon and verify project access
  const result = await db
    .select()
    .from(icons)
    .innerJoin(projects, eq(icons.project_id, projects.id))
    .where(eq(icons.id, id));

  const current = result[0];
  if (!current) {
    json(404, { error: "Icon not found" });
    return;
  }

  const hasAccess =
    current.projects.user_id === session.user.id ||
    (await canEditProject(db, current.icons.project_id, session.user.id));
  if (!hasAccess) {
    json(404, { error: "Icon not found" });
    return;
  }

  json(200, { icon: current.icons as Icon });
};

export const onPut: RequestHandler = async ({
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
  const id = parseInt(params.id, 10);
  const body = (await request.json()) as any;
  const { name, unicode, view_box, content, tags } = body;

  // Get icon and verify project access
  const result = await db
    .select()
    .from(icons)
    .innerJoin(projects, eq(icons.project_id, projects.id))
    .where(eq(icons.id, id));

  const current = result[0]?.icons as Icon | undefined;

  if (!current) {
    json(404, { error: "Icon not found" });
    return;
  }

  const hasAccess =
    result[0]?.projects.user_id === session.user.id ||
    (await canEditProject(db, current.project_id, session.user.id));
  if (!hasAccess) {
    json(404, { error: "Icon not found" });
    return;
  }

  let svgPath = current.svg_path;
  const newName = (name as string) || current.name;
  const newContent = content as string | undefined;

  if (newContent && newContent !== current.content) {
    const cleanName = newName
      .replace(/\.svg$/i, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-");
    svgPath = await uploadSVG(
      platform,
      current.project_id,
      cleanName,
      newContent,
    );
  }

  await db
    .update(icons)
    .set({
      name: newName,
      unicode: unicode !== undefined ? unicode : current.unicode,
      view_box: resolveSvgViewBox(
        (view_box as string | undefined) ?? current.view_box,
        newContent ?? current.content,
      ),
      content: newContent ?? current.content,
      tags: tags !== undefined ? tags : current.tags,
      svg_path: svgPath,
      updated_at: new Date().toISOString(),
    })
    .where(eq(icons.id, id));

  json(200, { success: true });
};

export const onDelete: RequestHandler = async ({
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
  const id = parseInt(params.id, 10);

  // Get icon and verify project access
  const result = await db
    .select()
    .from(icons)
    .innerJoin(projects, eq(icons.project_id, projects.id))
    .where(eq(icons.id, id));

  const current = result[0]?.icons;
  const hasAccess =
    result[0]?.projects.user_id === session.user.id ||
    (await canEditProject(db, current?.project_id, session.user.id));

  if (current && hasAccess) {
    await deleteSVG(platform, current.svg_path);
  }

  if (!hasAccess) {
    json(404, { error: "Icon not found" });
    return;
  }

  await db.delete(icons).where(eq(icons.id, id));

  json(200, { success: true });
};
