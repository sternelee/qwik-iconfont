import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { uploadSVG } from "~/lib/storage";
import type { Icon } from "~/lib/types";

export const onGet: RequestHandler = async ({ params, platform, json }) => {
  const db = getDB(platform);
  await initDB(db);
  const projectId = parseInt(params.id, 10);

  const stmt = db
    .prepare("SELECT * FROM icons WHERE project_id = ? ORDER BY created_at ASC")
    .bind(projectId);
  const result = await stmt.all<Icon>();

  json(200, { icons: result.results ?? [] });
};

export const onPost: RequestHandler = async ({ params, platform, request, json }) => {
  const db = getDB(platform);
  await initDB(db);
  const projectId = parseInt(params.id, 10);

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const content = formData.get("content") as string;
  const unicode = (formData.get("unicode") as string) || null;
  const viewBox = (formData.get("viewBox") as string) || "0 0 1024 1024";

  if (!name || !content) {
    json(400, { error: "name and content are required" });
    return;
  }

  // Clean SVG name
  const cleanName = name.replace(/\.svg$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-");

  // Upload SVG to R2
  const svgPath = await uploadSVG(platform, projectId, cleanName, content);

  const stmt = db.prepare(
    "INSERT INTO icons (project_id, name, unicode, svg_path, view_box, content) VALUES (?, ?, ?, ?, ?, ?)"
  );
  stmt.bind(projectId, cleanName, unicode, svgPath, viewBox, content);
  const result = await stmt.run();

  if (!result.success) {
    json(500, { error: "Failed to create icon" });
    return;
  }

  json(201, {
    icon: {
      id: result.meta?.last_row_id,
      project_id: projectId,
      name: cleanName,
      unicode,
      svg_path: svgPath,
      view_box: viewBox,
      content,
    },
  });
};
