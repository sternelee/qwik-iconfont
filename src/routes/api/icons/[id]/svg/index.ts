import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getBucket } from "~/lib/storage";
import { getSessionFromRequest } from "~/lib/session";
import { icons, projects } from "~/lib/schema";
import { eq, and } from "drizzle-orm";

export const onGet: RequestHandler = async ({
  params,
  platform,
  request,
  send,
  error,
}) => {
  const session = await getSessionFromRequest(platform, request);
  if (!session) {
    error(401, "Not authenticated");
    return;
  }

  const db = getDB(platform);
  await initDB(db, platform);
  const id = parseInt(params.id, 10);

  // Get icon and verify project ownership
  const result = await db
    .select({ svg_path: icons.svg_path, content: icons.content })
    .from(icons)
    .innerJoin(projects, eq(icons.project_id, projects.id))
    .where(and(eq(icons.id, id), eq(projects.user_id, session.user.id)));

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
