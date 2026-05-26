import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getBucket } from "~/lib/storage";
import type { Project, Icon } from "~/lib/types";

export const onGet: RequestHandler = async ({ params, platform, json }) => {
  const db = getDB(platform);
  await initDB(db);
  const id = parseInt(params.id, 10);

  const projectStmt = db.prepare("SELECT * FROM projects WHERE id = ?").bind(id);
  const project = await projectStmt.first<Project>();

  if (!project) {
    json(404, { error: "Project not found" });
    return;
  }

  const iconsStmt = db.prepare("SELECT * FROM icons WHERE project_id = ? ORDER BY created_at ASC").bind(id);
  const iconsResult = await iconsStmt.all<Icon>();

  json(200, {
    project: {
      ...project,
      icons: iconsResult.results ?? [],
    },
  });
};

export const onPut: RequestHandler = async ({ params, platform, request, json }) => {
  const db = getDB(platform);
  await initDB(db);
  const id = parseInt(params.id, 10);
  const body = await request.json();
  const { name, description, font_family, prefix } = body;

  const stmt = db.prepare("UPDATE projects SET name = ?, description = ?, font_family = ?, prefix = ? WHERE id = ?");
  stmt.bind(name, description ?? null, font_family ?? "iconfont", prefix ?? "icon-", id);
  const result = await stmt.run();

  if (!result.success || (result.meta?.changes ?? 0) === 0) {
    json(404, { error: "Project not found" });
    return;
  }

  json(200, { success: true });
};

export const onDelete: RequestHandler = async ({ params, platform, json }) => {
  const db = getDB(platform);
  await initDB(db);
  const bucket = getBucket(platform);
  const id = parseInt(params.id, 10);

  // Delete all associated SVGs from R2
  const iconsStmt = db.prepare("SELECT svg_path FROM icons WHERE project_id = ?").bind(id);
  const iconsResult = await iconsStmt.all<{ svg_path: string }>();
  for (const icon of iconsResult.results ?? []) {
    await bucket.delete(icon.svg_path);
  }

  const stmt = db.prepare("DELETE FROM projects WHERE id = ?").bind(id);
  await stmt.run();

  json(200, { success: true });
};
