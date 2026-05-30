import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Create a betterAuth instance for the given Cloudflare platform.
 * In production (wrangler), platform.env.DB is the D1 binding.
 * In local dev (vite SSR), we pass null — auth features won't work
 * without a real database; use `pnpm serve` (wrangler dev) for auth.
 *
 * Environment variables (set in wrangler.toml or .dev.vars):
 * - BETTER_AUTH_URL: Public base URL (e.g. https://iconfont.example.com)
 * - BETTER_AUTH_SECRET: Secret key for signing sessions
 */
export function createAuth(platform: any, origin?: string) {
  const d1 = platform?.env?.DB;
  if (!d1) {
    return null; // No D1 available — anonymous/localStorage mode
  }

  const db = drizzle(d1, { schema });

  // Resolve base URL: env var > request origin > localhost fallback
  const env = platform?.env || {};
  const baseURL = env.BETTER_AUTH_URL || origin || "http://localhost:5173";

  // Build trusted origins from base URL + common dev ports
  const trustedOrigins = [baseURL];
  if (!trustedOrigins.includes("http://localhost:5173")) {
    trustedOrigins.push("http://localhost:5173");
  }
  if (!trustedOrigins.includes("http://localhost:8788")) {
    trustedOrigins.push("http://localhost:8788");
  }

  return betterAuth({
    baseURL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        ...schema,
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    trustedOrigins,
  });
}
