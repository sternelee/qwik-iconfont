import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getBucket } from "~/lib/storage";
import { icons } from "~/lib/schema";
import { eq } from "drizzle-orm";

export const onGet: RequestHandler = async ({
  params,
  platform,
  send,
  error,
}) => {
  const db = getDB(platform);
  await initDB(db, platform);
  const id = parseInt(params.id, 10);

  const result = await db
    .select({ svg_path: icons.svg_path, content: icons.content })
    .from(icons)
    .where(eq(icons.id, id));
  const icon = result[0];

  if (!icon) {
    error(404, "Icon not found");
    return;
  }

  let svgContent = icon.content;
  if (!svgContent) {
    const bucket = getBucket(platform);
    const obj = await bucket.get(icon.svg_path);
    if (!obj) {
      error(404, "SVG not found");
      return;
    }
    svgContent = await obj.text();
  }

  send(
    new Response(svgContent, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    }),
  );
};
