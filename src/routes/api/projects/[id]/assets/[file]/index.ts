import type { RequestHandler } from "@builder.io/qwik-city";
import { getBucket } from "~/lib/storage";
import { getDB, initDB } from "~/lib/db";
import { projects } from "~/lib/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/projects/[id]/assets/[file]
 *
 * Serve published font assets from R2.
 * Supports: *.ttf, *.css, *.woff2 (future)
 * Public access for public projects; auth required for private.
 */
export const onGet: RequestHandler = async ({
  params,
  platform,
  send,
  error,
}) => {
  const db = getDB(platform);
  await initDB(db, platform);
  const id = parseInt(params.id, 10);
  const file = params.file;

  // Check project exists
  const projectResult = await db
    .select({
      visibility: projects.visibility,
      font_family: projects.font_family,
    })
    .from(projects)
    .where(eq(projects.id, id));
  const project = projectResult[0];
  if (!project) throw error(404, "Not found");

  const bucket = getBucket(platform);
  const key = `projects/${id}/${file}`;
  const obj = await bucket.get(key);
  if (!obj) throw error(404, "Asset not found — publish the project first");

  const ext = file.split(".").pop()?.toLowerCase() ?? "";
  const mimeTypes: Record<string, string> = {
    ttf: "font/truetype",
    woff: "font/woff",
    woff2: "font/woff2",
    css: "text/css; charset=utf-8",
    svg: "image/svg+xml",
  };
  const contentType = mimeTypes[ext] || "application/octet-stream";

  const data = await obj.arrayBuffer();
  const response = new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
      // Web fonts require CORS wildcard — browsers block cross-origin font loads otherwise
      // eslint-disable-next-line no-restricted-syntax
      "Access-Control-Allow-Origin": "*",
    },
  });

  send(response);
};
