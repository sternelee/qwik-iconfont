import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getSessionFromRequest } from "~/lib/session";
import { getBucket } from "~/lib/storage";
import { projects } from "~/lib/schema";
import { eq, and } from "drizzle-orm";

/**
 * POST /api/projects/[id]/publish
 *
 * Receive client-generated TTF + CSS, store in R2 for CDN delivery.
 * Body: multipart/form-data with fields: ttf (Blob), css (string)
 * Returns: { ttfUrl, cssUrl }
 */
export const onPost: RequestHandler = async ({
  params,
  platform,
  request,
  json,
}) => {
  const session = await getSessionFromRequest(platform, request);
  if (!session) {
    json(401, { error: "Not authenticated" });
    return;
  }

  const db = getDB(platform);
  await initDB(db, platform);
  const id = parseInt(params.id, 10);

  // Verify ownership
  const projectResult = await db
    .select({
      id: projects.id,
      font_family: projects.font_family,
      user_id: projects.user_id,
    })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.user_id, session.user.id)));
  const project = projectResult[0];
  if (!project) {
    json(404, { error: "Project not found" });
    return;
  }

  const bucket = getBucket(platform);
  const fontFamily = project.font_family;

  let ttfData: ArrayBuffer | null = null;
  let cssData: string | null = null;

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const ttfBlob = form.get("ttf") as Blob | null;
    const cssStr = form.get("css") as string | null;
    if (ttfBlob) ttfData = await ttfBlob.arrayBuffer();
    if (cssStr) cssData = cssStr;
  } else {
    // JSON: { ttf: base64, css: string }
    const body = (await request.json()) as any;
    if (body.ttf) {
      const binary = atob(body.ttf);
      ttfData = new Uint8Array(binary.length).map((_, i) =>
        binary.charCodeAt(i),
      ).buffer;
    }
    if (body.css) cssData = body.css;
  }

  if (!ttfData && !cssData) {
    json(400, { error: "No font data provided" });
    return;
  }

  const ttfKey = `projects/${id}/${fontFamily}.ttf`;
  const cssKey = `projects/${id}/${fontFamily}.css`;

  if (ttfData) {
    await bucket.put(ttfKey, ttfData, {
      httpMetadata: { contentType: "font/truetype" },
    });
  }
  if (cssData) {
    await bucket.put(cssKey, cssData, {
      httpMetadata: { contentType: "text/css; charset=utf-8" },
    });
  }

  const baseUrl = new URL(request.url).origin;
  json(200, {
    success: true,
    ttfUrl: `${baseUrl}/api/projects/${id}/assets/${fontFamily}.ttf`,
    cssUrl: `${baseUrl}/api/projects/${id}/assets/${fontFamily}.css`,
  });
};

/**
 * GET /api/projects/[id]/publish
 * Returns publish status + CDN URLs if published
 */
export const onGet: RequestHandler = async ({
  params,
  platform,
  request,
  json,
}) => {
  const db = getDB(platform);
  await initDB(db, platform);
  const id = parseInt(params.id, 10);

  const projectResult = await db
    .select({
      id: projects.id,
      font_family: projects.font_family,
      visibility: projects.visibility,
      user_id: projects.user_id,
    })
    .from(projects)
    .where(eq(projects.id, id));
  const project = projectResult[0];
  if (!project) {
    json(404, { error: "Project not found" });
    return;
  }

  const bucket = getBucket(platform);
  const ttfKey = `projects/${id}/${project.font_family}.ttf`;
  const exists = await bucket.get(ttfKey);

  if (!exists) {
    json(200, { published: false });
    return;
  }

  const baseUrl = new URL(request.url).origin;
  json(200, {
    published: true,
    ttfUrl: `${baseUrl}/api/projects/${id}/assets/${project.font_family}.ttf`,
    cssUrl: `${baseUrl}/api/projects/${id}/assets/${project.font_family}.css`,
  });
};
