/**
 * Server-side session helper for Qwik City route loaders/actions.
 * Checks the better-auth session cookie via the auth API.
 */

import { createAuth } from "./auth";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
}

export interface SessionData {
  user: SessionUser;
  session: {
    id: string;
    expiresAt: string;
    token: string;
    userId: string;
  };
}

/**
 * Get the current session from the request headers.
 * Returns null if no session or D1 not available.
 */
export async function getSessionFromRequest(
  platform: any,
  request: Request,
): Promise<SessionData | null> {
  const origin = new URL(request.url).origin;
  const auth = createAuth(platform, origin);
  if (!auth) return null;

  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });
    return session as SessionData | null;
  } catch {
    return null;
  }
}
