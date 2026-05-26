import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getBucket } from "~/lib/storage";

export const onGet: RequestHandler = async ({ params, platform, send, error }) => {
  const db = getDB(platform);
  await initDB(db);
  const id = parseInt(params.id, 10);

  const stmt = db.prepare("SELECT svg_path, content FROM icons WHERE id = ?").bind(id);
  const icon = await stmt.first<{ svg_path: string; content: string | null }>();

  if (!icon) {
    error(404, "Icon not found");
    return;
  }

  // Prefer cached content, fall back to R2
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

  send(new Response(svgContent, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
    },
  }));
};
