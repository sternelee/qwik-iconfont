import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import type { Project } from "~/lib/types";

export const onGet: RequestHandler = async ({ platform, json }) => {
  const db = getDB(platform);
  await initDB(db);
  const stmt = db.prepare("SELECT * FROM projects ORDER BY updated_at DESC");
  const result = await stmt.all<Project>();
  json(200, { projects: result.results ?? [] });
};

export const onPost: RequestHandler = async ({ platform, request, json }) => {
  const db = getDB(platform);
  await initDB(db);
  const body = await request.json();
  const { name, description, font_family, prefix } = body;

  if (!name || typeof name !== "string") {
    json(400, { error: "name is required" });
    return;
  }

  const stmt = db.prepare(
    "INSERT INTO projects (name, description, font_family, prefix) VALUES (?, ?, ?, ?)"
  );
  stmt.bind(name, description ?? null, font_family ?? "iconfont", prefix ?? "icon-");
  const result = await stmt.run();

  if (!result.success) {
    json(500, { error: "Failed to create project" });
    return;
  }

  const id = result.meta?.last_row_id;
  json(201, {
    project: {
      id,
      name,
      description: description ?? null,
      font_family: font_family ?? "iconfont",
      prefix: prefix ?? "icon-",
    },
  });
};
