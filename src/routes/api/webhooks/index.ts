import type { RequestHandler } from "@builder.io/qwik-city";
import { getSessionFromRequest } from "~/lib/session";
import { getDB, initDB } from "~/lib/db";
import { eq, and } from "drizzle-orm";

function validateWebhookUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return "URL 格式无效";
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return "URL 必须使用 HTTP 或 HTTPS";
  }
  if (url.username || url.password) {
    return "URL 不允许包含认证信息";
  }
  if (
    /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|0\.)/i.test(
      url.hostname,
    )
  ) {
    return "URL 不允许使用内网地址";
  }
  return null;
}

export const onGet: RequestHandler = async ({ json, platform }) => {
  const session = await getSessionFromRequest(platform, platform.request!);
  if (!session) {
    json(401, { error: "Unauthorized" });
    return;
  }

  const db = getDB(platform);
  await initDB(db, platform);
  const { webhooks } = await import("~/lib/schema");

  const hooks = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.user_id, session.user.id));

  json(200, { webhooks: hooks });
};

export const onPost: RequestHandler = async ({ json, platform }) => {
  const session = await getSessionFromRequest(platform, platform.request!);
  if (!session) {
    json(401, { error: "Unauthorized" });
    return;
  }

  const db = getDB(platform);
  await initDB(db, platform);
  const { webhooks } = await import("~/lib/schema");

  const body = (await platform.request!.json()) as {
    project_id: number;
    url: string;
    events?: string;
    secret?: string;
  };

  if (!body.url || !body.project_id) {
    json(400, { error: "url and project_id required" });
    return;
  }

  const urlError = validateWebhookUrl(body.url);
  if (urlError) {
    json(400, { error: urlError });
    return;
  }

  const result = await db
    .insert(webhooks)
    .values({
      user_id: session.user.id,
      project_id: body.project_id,
      url: body.url,
      events: body.events || "*",
      secret: body.secret || null,
    })
    .returning();

  json(200, { webhook: result[0] });
};

export const onDelete: RequestHandler = async ({ json, platform, query }) => {
  const session = await getSessionFromRequest(platform, platform.request!);
  if (!session) {
    json(401, { error: "Unauthorized" });
    return;
  }

  const id = parseInt(query.get("id") || "", 10);
  if (!id) {
    json(400, { error: "id required" });
    return;
  }

  const db = getDB(platform);
  await initDB(db, platform);
  const { webhooks } = await import("~/lib/schema");

  await db
    .delete(webhooks)
    .where(and(eq(webhooks.id, id), eq(webhooks.user_id, session.user.id)));

  json(200, { success: true });
};
