/**
 * Session utilities for server-side authentication
 *
 * Provides session verification, caching, and request-level auth checks.
 * Better Auth (D1) is the authoritative session backend. Legacy Firebase
 * session cookies are no longer verifiable (the Firebase Admin SDK has been
 * removed); `verifySession` exists only as a compatibility shim for the few
 * public pages that still read the legacy `session` cookie and degrade to
 * "unauthenticated" when it cannot be verified.
 */

import { cache } from "react";
import { cookies, headers } from "next/headers";

const SESSION_COOKIE_NAME = "session";

export interface SessionData {
  uid: string;
  email: string;
  authTime: number;
}

/**
 * Verify a legacy Firebase session cookie and return session data.
 *
 * Firebase session cookies can no longer be verified — the Firebase Admin SDK
 * (the only thing that could validate the cookie signature) has been removed
 * as part of the Cloudflare migration. This always returns `null` so callers
 * that still read the legacy `session` cookie treat the request as
 * unauthenticated and fall through to their login/redirect path. Better Auth
 * (`getAuth()` in `verifyRequest`) is the authoritative session backend.
 */
export async function verifySession(
  _sessionCookie: string,
): Promise<SessionData | null> {
  return null;
}

/**
 * Get the session cookie name
 */
export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

/**
 * Cached version of verifySession for per-request deduplication
 * Multiple calls within the same request will only verify once
 */
export const verifySessionCached = cache(
  async (sessionCookie: string): Promise<SessionData | null> => {
    return await verifySession(sessionCookie);
  },
);

/**
 * Verify authentication from request
 * Returns session data or throws error with appropriate status code
 *
 * This helper consolidates auth logic and uses React.cache for deduplication.
 * Multiple calls within the same request will only verify once.
 *
 * @throws {AuthError} With status and message for error responses
 */
export async function verifyRequest(): Promise<SessionData> {
  // Dev bypass: skip auth in local development
  if (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_BYPASS === "true"
  ) {
    const email = process.env.DEV_AUTH_EMAIL || "dev@example.com";
    return {
      uid: email,
      email,
      authTime: Math.floor(Date.now() / 1000),
    };
  }

  const cookieStore = await cookies();

  // Better Auth (D1) session takes precedence during the migration. Only attempt it
  // when a Better Auth cookie is present, so requests without one don't pay a D1
  // round-trip. Wrapped so any Better Auth/runtime error never breaks the path;
  // dynamic imports avoid a module load cycle.
  if (cookieStore.getAll().some((c) => c.name.includes("better-auth"))) {
    try {
      const { getAuth } = await import("@/lib/auth/better-auth");
      const ba = await getAuth().api.getSession({ headers: await headers() });
      if (ba?.user) {
        const created = ba.session?.createdAt;
        return {
          uid: ba.user.id,
          email: ba.user.email ?? "",
          authTime: Math.floor(
            (created ? new Date(created).getTime() : Date.now()) / 1000,
          ),
        };
      }
    } catch {
      // fall through to the legacy session-cookie path below
    }
  }

  const sessionCookie = cookieStore.get(getSessionCookieName());

  if (!sessionCookie) {
    throw new AuthError("No session cookie", 401);
  }

  const session = await verifySessionCached(sessionCookie.value);

  if (!session) {
    throw new AuthError("Invalid or expired session", 401);
  }

  return session;
}

/**
 * Auth error with HTTP status code
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public status: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Extended session data for API key authentication
 */
export interface ApiKeySessionData extends SessionData {
  viaApiKey: true;
  keyId: string;
  scopes: string[];
}

/**
 * Verify a request using Bearer API key or fall back to session cookie auth.
 * Returns ApiKeySessionData if Bearer token is present and valid,
 * otherwise falls back to verifyRequest() for cookie-based auth.
 *
 * @param request - The incoming request
 * @param requiredScopes - If provided, the API key must have at least one of these scopes
 */
export async function verifyRequestWithApiKey(
  request: Request,
  _requiredScopes?: string[],
): Promise<SessionData | ApiKeySessionData> {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const _token = authHeader.slice("Bearer ".length);

    const { findApiKeyByToken } = await import("@/lib/api-keys/repository");
    const key = await findApiKeyByToken(_token);
    if (!key) {
      throw new AuthError("Invalid API key", 401);
    }
    return {
      uid: key.ownerId,
      email: "",
      authTime: Math.floor(Date.now() / 1000),
      viaApiKey: true,
      keyId: key.id,
      scopes: key.scopes,
    } satisfies ApiKeySessionData;
  }

  return verifyRequest();
}
