/**
 * Agent Signup API (public, code-gated)
 *
 * POST /api/v1/agent/signup
 *   body: { code, email, name? }
 *
 * Non-interactive account provisioning for AI agents. The agent presents an
 * invite/verification code (issued by an admin via POST /api/v1/signup-codes).
 * On success the code is consumed (one use), a Better Auth user + blog membership
 * are provisioned, and a fresh API key is minted and returned ONCE in plaintext.
 * The key is stored only as a SHA-256 hash, so this response is the sole chance
 * to capture it. Use it as `Authorization: Bearer <key>` against /api/v1/mcp.
 *
 * Rate-limited per IP — anonymous callers can hit this endpoint.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getClientIp, logAuditEvent } from "@/lib/audit-log";
import { createApiHandler } from "@/lib/create-api-handler";
import { provisionAgentAccount } from "@/lib/signup-codes/provision";
import { redeemSignupCode } from "@/lib/signup-codes/repository";

const signupSchema = z.object({
  code: z.string().min(1, "code is required").max(100),
  email: z.string().email(),
  name: z.string().min(1).max(200).optional(),
});

export const POST = createApiHandler({
  auth: "none",
  rateLimit: { key: "agent-signup", maxPerMinute: 10 },
  input: signupSchema,
  handler: async ({ body, request }) => {
    const redeemed = await redeemSignupCode(body.code);
    if (!redeemed.ok) {
      // 410 Gone for a code that existed but is no longer usable (expired /
      // exhausted); 400 for one that never existed.
      const status = redeemed.reason === "not_found" ? 400 : 410;
      return NextResponse.json({ error: redeemed.reason }, { status });
    }

    const provisioned = await provisionAgentAccount({
      email: body.email,
      name: body.name,
      blogId: redeemed.blogId,
      role: redeemed.role,
    });

    // Manual audit: createApiHandler skips auto-audit for auth:"none" routes.
    logAuditEvent({
      actorId: provisioned.userId,
      actorEmail: body.email,
      action: "agent_signup",
      ip: getClientIp(request),
      result: "success",
    }).catch(() => {});

    return NextResponse.json(
      {
        apiKey: provisioned.apiKey,
        keyPreview: provisioned.keyPreview,
        blogId: redeemed.blogId,
        userId: provisioned.userId,
        role: redeemed.role,
        usage:
          "Store this API key now — it is shown only once. Authenticate with " +
          "`Authorization: Bearer <apiKey>` against /api/v1/mcp.",
      },
      { status: 201 },
    );
  },
});
