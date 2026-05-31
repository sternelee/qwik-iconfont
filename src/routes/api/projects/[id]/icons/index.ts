import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { uploadSVG } from "~/lib/storage";
import { getSessionFromRequest } from "~/lib/session";
import { icons, projects } from "~/lib/schema";
import { eq, and, count } from "drizzle-orm";
import { resolveSvgViewBox, type Icon } from "~/lib/types";
import { getQuota } from "~/lib/quota";

export const onGet: RequestHandler = async ({
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
  const projectId = parseInt(params.id, 10);

  // Verify project ownership
  const projectResult = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.user_id, session.user.id)),
    );
  if (!projectResult[0]) {
    json(404, { error: "Project not found" });
    return;
  }

  const result = await db
    .select()
    .from(icons)
    .where(eq(icons.project_id, projectId))
    .orderBy(icons.created_at);

  json(200, { icons: result as Icon[] });
};

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
  const projectId = parseInt(params.id, 10);

  // Verify project ownership
  const projectResult = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.user_id, session.user.id)),
    );
  if (!projectResult[0]) {
    json(404, { error: "Project not found" });
    return;
  }

  // Quota check
  const { user } = await import("~/lib/schema");
  const userResult = await db
    .select({ plan: user.plan })
    .from(user)
    .where(eq(user.id, session.user.id));
  const plan = userResult[0]?.plan ?? "free";
  const quota = getQuota(plan);

  if (quota.maxIconsPerProject !== Infinity) {
    const [{ count: iconCount }] = await db
      .select({ count: count() })
      .from(icons)
      .where(eq(icons.project_id, projectId));
    if ((iconCount ?? 0) >= quota.maxIconsPerProject) {
      json(403, {
        error: `图标数量已达上限 (${quota.maxIconsPerProject} 个)。请升级 Pro 计划。`,
      });
      return;
    }
  }

  const formData = await request.formData();
  const name = formData.get("name") as string;
  const content = formData.get("content") as string;
  const unicode = (formData.get("unicode") as string) || null;
  const colorLayersRaw = (formData.get("colorLayers") as string) || null;
  const viewBox = resolveSvgViewBox(formData.get("viewBox") as string, content);

  // Validate color_layers JSON if provided
  let colorLayers: string | null = null;
  if (colorLayersRaw) {
    try {
      JSON.parse(colorLayersRaw); // validate JSON
      colorLayers = colorLayersRaw;
    } catch {
      colorLayers = null;
    }
  }

  if (!name || !content) {
    json(400, { error: "name and content are required" });
    return;
  }

  const cleanName = name.replace(/\.svg$/i, "").replace(/[^a-zA-Z0-9_-]/g, "-");
  const svgPath = await uploadSVG(platform, projectId, cleanName, content);

  const result = await db
    .insert(icons)
    .values({
      project_id: projectId,
      name: cleanName,
      unicode,
      svg_path: svgPath,
      view_box: viewBox,
      content,
      color_layers: colorLayers,
    })
    .returning();

  // Trigger webhooks
  const { triggerWebhooks } = await import("~/lib/webhook");
  await triggerWebhooks(db, projectId, "icon.created", {
    icon: result[0],
  });

  json(201, { icon: result[0] });
};
