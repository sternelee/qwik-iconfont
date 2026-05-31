import { eq, and } from "drizzle-orm";
import type { AppDatabase } from "./db";

export async function triggerWebhooks(
  db: AppDatabase,
  projectId: number,
  event: string,
  payload: Record<string, any>,
) {
  try {
    const { webhooks } = await import("~/lib/schema");
    const hooks = await db
      .select()
      .from(webhooks)
      .where(
        and(eq(webhooks.project_id, projectId), eq(webhooks.active, true)),
      );

    for (const hook of hooks) {
      const events =
        hook.events === "*"
          ? ["*"]
          : hook.events.split(",").map((e) => e.trim());
      if (!events.includes("*") && !events.includes(event)) continue;

      const body = JSON.stringify({
        event,
        project_id: projectId,
        timestamp: new Date().toISOString(),
        payload,
      });

      try {
        await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Event": event,
            ...(hook.secret
              ? {
                  "X-Webhook-Signature":
                    "sha256=" + (await hmacSha256(hook.secret, body)),
                }
              : {}),
          },
          body,
        });
      } catch {
        // Silently fail — webhook delivery is best-effort
      }
    }
  } catch {
    // Silently fail
  }
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
