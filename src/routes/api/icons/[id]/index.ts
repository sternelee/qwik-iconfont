import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getBucket, uploadSVG } from "~/lib/storage";
import type { Icon } from "~/lib/types";

export const onGet: RequestHandler = async ({ params, platform, json }) => {
  const db = getDB(platform);
  await initDB(db);
  const id = parseInt(params.id, 10);

  const stmt = db.prepare("SELECT * FROM icons WHERE id = ?").bind(id);
  const icon = await stmt.first<Icon>();

  if (!icon) {
    json(404, { error: "Icon not found" });
    return;
  }

  json(200, { icon });
};

export const onPut: RequestHandler = async ({ params, platform, request, json }) => {
  const db = getDB(platform);
  await initDB(db);
  const id = parseInt(params.id, 10);
  const body = await request.json();
  const { name, unicode, view_box, content } = body;

  // Get current icon
  const currentStmt = db.prepare("SELECT * FROM icons WHERE id = ?").bind(id);
  const current = await currentStmt.first<Icon>();

  if (!current) {
    json(404, { error: "Icon not found" });
    return;
  }

  let svgPath = current.svg_path;

  // If content changed, re-upload to R2
  if (content && content !== current.content) {
    const cleanName = name
      ? name.replace(/\.svg$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-")
      : current.name;
    svgPath = await uploadSVG(platform, current.project_id, cleanName, content);
  }

  const stmt = db.prepare(
    "UPDATE icons SET name = ?, unicode = ?, view_box = ?, content = ?, svg_path = ? WHERE id = ?"
  );
  stmt.bind(
    name ?? current.name,
    unicode !== undefined ? unicode : current.unicode,
    view_box ?? current.view_box,
    content ?? current.content,
    svgPath,
    id
  );
  const result = await stmt.run();

  if (!result.success || (result.meta?.changes ?? 0) === 0) {
    json(404, { error: "Icon not found" });
    return;
  }

  json(200, { success: true });
};

export const onDelete: RequestHandler = async ({ params, platform, json }) => {
  const db = getDB(platform);
  await initDB(db);
  const bucket = getBucket(platform);
  const id = parseInt(params.id, 10);

  // Get SVG path before deleting
  const currentStmt = db.prepare("SELECT svg_path FROM icons WHERE id = ?").bind(id);
  const current = await currentStmt.first<{ svg_path: string }>();

  if (current) {
    await bucket.delete(current.svg_path);
  }

  const stmt = db.prepare("DELETE FROM icons WHERE id = ?").bind(id);
  await stmt.run();

  json(200, { success: true });
};
