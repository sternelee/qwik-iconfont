import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getBucket } from "~/lib/storage";
import { getSessionFromRequest } from "~/lib/session";
import { projects, icons } from "~/lib/schema";
import { eq, and } from "drizzle-orm";
import type { Project, Icon } from "~/lib/types";

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

  const projectResult = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.user_id, session.user.id)));
  const project = projectResult[0] as Project | undefined;

  if (!project) {
    json(404, { error: "Project not found" });
    return;
  }

  const iconsResult = await db
    .select()
    .from(icons)
    .where(eq(icons.project_id, id))
    .orderBy(icons.created_at);

  json(200, {
    project: {
      ...project,
      icons: iconsResult as Icon[],
    },
  });
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
  const { name, description, font_family, prefix, visibility } = body;

  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.user_id, session.user.id)));
  if (!existing[0]) {
    json(404, { error: "Project not found" });
    return;
  }

  await db
    .update(projects)
    .set({
      name,
      description: description ?? null,
      font_family: font_family ?? "iconfont",
      prefix: prefix ?? "icon-",
      visibility: visibility ?? existing[0].visibility ?? "private",
      updated_at: new Date().toISOString(),
    })
    .where(eq(projects.id, id));

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
  const bucket = getBucket(platform);
  const id = parseInt(params.id, 10);

  // Verify ownership
  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.user_id, session.user.id)));
  if (!existing[0]) {
    json(404, { error: "Project not found" });
    return;
  }

  const iconsResult = await db
    .select({ svg_path: icons.svg_path })
    .from(icons)
    .where(eq(icons.project_id, id));

  for (const icon of iconsResult) {
    await bucket.delete(icon.svg_path);
  }

  await db.delete(projects).where(eq(projects.id, id));

  json(200, { success: true });
};
