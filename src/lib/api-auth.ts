import { getDB, initDB } from "./db";
import { apiTokens } from "./schema";
import { eq } from "drizzle-orm";

/**
 * Resolve user from Bearer token.
 * Returns userId if valid, null otherwise.
 */
export async function resolveTokenUser(
  token: string,
  platform: any,
): Promise<string | null> {
  const db = getDB(platform);
  await initDB(db, platform);
  // Simple hash comparison (SHA-256)
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const result = await db
    .select({ user_id: apiTokens.user_id })
    .from(apiTokens)
    .where(eq(apiTokens.token_hash, hashHex))
    .limit(1);

  if (!result[0]) return null;

  // Update last_used_at
  await db
    .update(apiTokens)
    .set({ last_used_at: new Date().toISOString() })
    .where(eq(apiTokens.token_hash, hashHex));

  return result[0].user_id;
}

/** Extract Bearer token from Authorization header */
export function extractBearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}
