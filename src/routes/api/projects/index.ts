import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { projects, icons } from "~/lib/schema";
import { eq, desc, count } from "drizzle-orm";
import type { Project } from "~/lib/types";

export const onGet: RequestHandler = async ({ platform, json }) => {
  const db = getDB(platform);
  await initDB(db);

  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      font_family: projects.font_family,
      prefix: projects.prefix,
      created_at: projects.created_at,
      updated_at: projects.updated_at,
      icon_count: count(icons.id),
    })
    .from(projects)
    .leftJoin(icons, eq(projects.id, icons.project_id))
    .groupBy(projects.id)
    .orderBy(desc(projects.updated_at));

  json(200, { projects: result as (Project & { icon_count: number })[] });
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

  const result = await db
    .insert(projects)
    .values({
      name,
      description: description ?? null,
      font_family: font_family ?? "iconfont",
      prefix: prefix ?? "icon-",
    })
    .returning();

  json(201, { project: result[0] });
};
