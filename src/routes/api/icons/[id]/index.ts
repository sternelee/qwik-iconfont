import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getBucket, uploadSVG } from "~/lib/storage";
import { icons } from "~/lib/schema";
import { eq } from "drizzle-orm";
import { resolveSvgViewBox, type Icon } from "~/lib/types";

export const onGet: RequestHandler = async ({ params, platform, json }) => {
  const db = getDB(platform);
  await initDB(db, platform);
  const id = parseInt(params.id, 10);

  const result = await db.select().from(icons).where(eq(icons.id, id));
  const icon = result[0] as Icon | undefined;

  if (!icon) {
    json(404, { error: "Icon not found" });
    return;
  }

  json(200, { icon });
};

export const onPut: RequestHandler = async ({
  params,
  platform,
  request,
  json,
}) => {
  const db = getDB(platform);
  await initDB(db, platform);
  const id = parseInt(params.id, 10);
  const body = (await request.json()) as any;
  const { name, unicode, view_box, content, tags } = body;

  const result = await db.select().from(icons).where(eq(icons.id, id));
  const current = result[0] as Icon | undefined;

  if (!current) {
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

export const onDelete: RequestHandler = async ({ params, platform, json }) => {
  const db = getDB(platform);
  await initDB(db, platform);
  const bucket = getBucket(platform);
  const id = parseInt(params.id, 10);

  const result = await db
    .select({ svg_path: icons.svg_path })
    .from(icons)
    .where(eq(icons.id, id));
  const current = result[0];

  if (current) {
    await bucket.delete(current.svg_path);
  }

  await db.delete(icons).where(eq(icons.id, id));

  json(200, { success: true });
};
