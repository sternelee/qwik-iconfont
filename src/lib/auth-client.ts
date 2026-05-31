/**
 * Auth client for Qwik — thin wrapper over better-auth REST API.
 *
 * Usage in Qwik components:
 *   import { signUp, signIn, signOut, getSession } from "~/lib/auth-client";
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthSession {
  user: AuthUser;
  session: {
    id: string;
    expiresAt: string;
    token: string;
    userId: string;
  };
}

export interface AuthError {
  message: string;
  code?: string;
}

export interface AuthResult<T = any> {
  data: T | null;
  error: AuthError | null;
}

const BASE = "/api/auth";

async function authFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<AuthResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const json: any = await res.json();

    if (!res.ok) {
      return {
        data: null,
        error: {
          message: json.message || json.error || "Authentication failed",
          code: json.code,
        },
      };
    }

    return { data: json as T, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: { message: err.message || "Network error" },
    };
  }
}

/** Register a new user with email + password */
export async function signUp(params: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthResult<AuthSession>> {
  return authFetch<AuthSession>("/sign-up/email", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** Sign in with email + password */
export async function signIn(params: {
  email: string;
  password: string;
}): Promise<AuthResult<AuthSession>> {
  return authFetch<AuthSession>("/sign-in/email", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** Initiate OAuth sign-in — redirects to provider */
export async function signInSocial(
  provider: "github" | "google",
): Promise<void> {
  const res = await fetch(`${BASE}/sign-in/social`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, callbackURL: "/" }),
  });
  const data = (await res.json()) as any;
  if (data?.url) {
    window.location.href = data.url;
  }
}

/** Sign out the current user */
export async function signOut(): Promise<AuthResult> {
  return authFetch("/sign-out", {
    method: "POST",
  });
}

/** Get the current session (server reads cookie) */
export async function getSession(): Promise<AuthResult<AuthSession>> {
  return authFetch<AuthSession>("/get-session", {
    method: "GET",
  });
}
