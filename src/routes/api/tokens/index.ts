import type { RequestHandler } from "@builder.io/qwik-city";
import { getDB, initDB } from "~/lib/db";
import { getSessionFromRequest } from "~/lib/session";
import { apiTokens } from "~/lib/schema";
import { eq, desc } from "drizzle-orm";

/** POST /api/tokens — Create a new API token */
export const onPost: RequestHandler = async ({ platform, request, json }) => {
  const session = await getSessionFromRequest(platform, request);
  if (!session) {
    json(401, { error: "Not authenticated" });
    return;
  }

  const db = getDB(platform);
  await initDB(db, platform);
  const body = (await request.json()) as { name?: string };
  const name = body.name || "API Token";

  // Generate random token
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const result = await db
    .insert(apiTokens)
    .values({
      user_id: session.user.id,
      name,
      token_hash: hashHex,
    })
    .returning();

  json(201, {
    success: true,
    token, // Only returned once
    id: result[0].id,
    name,
  });
};

/** GET /api/tokens — List user's tokens */
export const onGet: RequestHandler = async ({ platform, request, json }) => {
  const session = await getSessionFromRequest(platform, request);
  if (!session) {
    json(401, { error: "Not authenticated" });
    return;
  }

  const db = getDB(platform);
  await initDB(db, platform);

  const result = await db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      last_used_at: apiTokens.last_used_at,
      created_at: apiTokens.created_at,
    })
    .from(apiTokens)
    .where(eq(apiTokens.user_id, session.user.id))
    .orderBy(desc(apiTokens.created_at));

  json(200, { tokens: result });
};

/** DELETE /api/tokens — Revoke a token */
export const onDelete: RequestHandler = async ({ platform, request, json }) => {
  const session = await getSessionFromRequest(platform, request);
  if (!session) {
    json(401, { error: "Not authenticated" });
    return;
  }

  const db = getDB(platform);
  await initDB(db, platform);
  const body = (await request.json()) as { id?: number };
  if (!body.id) {
    json(400, { error: "Token id is required" });
    return;
  }

  await db.delete(apiTokens).where(eq(apiTokens.id, body.id));

  json(200, { success: true });
};
