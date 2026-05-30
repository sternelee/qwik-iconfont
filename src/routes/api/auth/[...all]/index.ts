import type { RequestHandler } from "@builder.io/qwik-city";
import { createAuth } from "~/lib/auth";

/**
 * Catch-all route that delegates all /api/auth/* requests to better-auth.
 * better-auth handles: sign-up, sign-in, sign-out, session, CSRF, etc.
 */
async function handleAuth(event: {
  request: Request;
  platform: any;
  json: (status: number, data: any) => void;
}) {
  const { request, platform } = event;
  const origin = new URL(request.url).origin;
  const auth = createAuth(platform, origin);

  if (!auth) {
    // No D1 available — auth not supported in this mode
    event.json(503, { error: "Auth not available: no database binding" });
    return;
  }

  // better-auth's handler expects a standard Request and returns a standard Response
  const response = await auth.handler(request);

  // Qwik City route handlers need to return via json/send or throw response
  // We need to forward the better-auth response
  return response;
}

export const onGet: RequestHandler = async (event) => {
  const response = await handleAuth(event);
  if (response) {
    // Forward the better-auth response
    event.send(
      new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }),
    );
  }
};

export const onPost: RequestHandler = async (event) => {
  const response = await handleAuth(event);
  if (response) {
    event.send(
      new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }),
    );
  }
};
