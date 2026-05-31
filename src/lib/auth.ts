import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { getDB } from "./db";

async function sendWelcomeEmail(
  to: string,
  name: string,
  env: Record<string, string>,
) {
  // Requires RESEND_API_KEY in env (or Cloudflare Email binding)
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM || "noreply@iconfont.app",
        to,
        subject: "欢迎来到 Iconfont",
        html: `<p>Hi ${name || ""},</p><p>感谢注册 Iconfont！开始创建你的图标字体项目吧。</p>`,
      }),
    });
  } catch {
    // silent fail — don't block registration
  }
}

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

  // getDB wraps D1 to convert Date → ISO string (better-auth generates Date objects)
  const db = getDB(platform);

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
    }),
    emailAndPassword: {
      enabled: true,
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await sendWelcomeEmail(user.email, user.name || "", env);
          },
        },
      },
    },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID || "",
        clientSecret: env.GITHUB_CLIENT_SECRET || "",
      },
      google: {
        clientId: env.GOOGLE_CLIENT_ID || "",
        clientSecret: env.GOOGLE_CLIENT_SECRET || "",
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
    },
    trustedOrigins,
  });
}
