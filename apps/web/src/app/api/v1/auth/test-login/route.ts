/**
 * Test login endpoint (development and E2E only)
 *
 * POST /api/v1/auth/test-login { email }
 * Mints a real Better Auth session for `email` without the email round-trip,
 * by generating a magic-link token and verifying it server-side. Used by
 * Playwright E2E specs and local worktrees. Gated on DEV_AUTH_BYPASS=true so
 * it 404s in real deployments (`next start` sets NODE_ENV=production, so the
 * flag — not NODE_ENV — is the guard).
 */

import { desc, like } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getDbRaw } from "@/db";
import { verification } from "@/db/schema/auth";
import { createApiHandler } from "@/lib/create-api-handler";
import { getAuth } from "@/lib/auth/better-auth";
import { isEmailAllowed } from "@/lib/auth/email-allowlist";
import { createLogger } from "@/lib/logger";

// The magic-link plugin endpoints (signInMagicLink, magicLinkVerify) are added
// at runtime by the plugin but aren't reflected in the generic
// ReturnType<typeof betterAuth> that getAuth() returns. Type just the two
// methods we call (shapes verified against the better-auth 1.4.17 magic-link
// plugin source) so the call sites stay type-checked without `any`.
type MagicLinkAuth = {
  api: {
    signInMagicLink(opts: {
      body: { email: string; callbackURL?: string };
      headers: Headers;
    }): Promise<unknown>;
    magicLinkVerify(opts: {
      query: { token: string };
      headers: Headers;
      asResponse: true;
    }): Promise<Response>;
  };
};

const log = createLogger("api:auth:test-login");

const testLoginSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export const POST = createApiHandler({
  auth: "none",
  input: testLoginSchema,
  handler: async ({ body, request }) => {
    if (process.env.DEV_AUTH_BYPASS !== "true") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { email } = body;
    if (!isEmailAllowed(email)) {
      return NextResponse.json(
        { error: "Email domain not authorized" },
        { status: 403 },
      );
    }

    const auth = getAuth() as unknown as MagicLinkAuth;

    // 1. Generate a magic-link verification token (sendMagicLink runs; non-fatal
    //    if email delivery isn't configured).
    await auth.api.signInMagicLink({
      body: { email, callbackURL: "/dashboard" },
      headers: request.headers,
    });

    // 2. Read the freshly-created token from the verification table.
    const db = getDbRaw();
    const rows = await db
      .select({ identifier: verification.identifier })
      .from(verification)
      // Match the email as it appears quoted in the JSON `value`
      // (`{"email":"…"}`) to avoid matching a different row by substring.
      .where(like(verification.value, `%"${email}"%`))
      .orderBy(desc(verification.createdAt))
      .limit(1);
    const token = rows[0]?.identifier;
    if (!token) {
      log.error("test-login: no verification token found", { email });
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 },
      );
    }

    // 3. Verify the token to mint a session; capture the Set-Cookie header.
    //    magicLinkVerify requires headers (requireHeaders: true) — pass empty
    //    Headers so the validator is satisfied. No callbackURL in query so
    //    the endpoint returns JSON (not a redirect) and the Set-Cookie is
    //    present on the response.
    const verifyRes = await auth.api.magicLinkVerify({
      query: { token },
      headers: new Headers(),
      asResponse: true,
    });
    // Forward ALL Set-Cookie headers (getSetCookie preserves multiples; the
    // session token cookie is the one that matters, but don't drop any).
    const setCookies = verifyRes.headers.getSetCookie();
    if (setCookies.length === 0) {
      log.error("test-login: verify returned no session cookie", { email });
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 },
      );
    }

    const response = NextResponse.json({ success: true, user: { email } });
    for (const cookie of setCookies) {
      response.headers.append("set-cookie", cookie);
    }
    log.info("test-login session created", { email });
    return response;
  },
});

export const GET = createApiHandler({
  auth: "none",
  handler: async () => {
    if (process.env.DEV_AUTH_BYPASS !== "true") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      available: true,
      usage: 'POST { "email": "you@example.com" } to create a dev session',
    });
  },
});
