import type { RequestHandler } from "@builder.io/qwik-city";
import { getSessionFromRequest } from "~/lib/session";
import { getDB, initDB } from "~/lib/db";
import { eq, and } from "drizzle-orm";

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
