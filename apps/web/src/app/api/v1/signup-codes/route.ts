/**
 * Signup Codes API (admin)
 *
 * POST /api/v1/signup-codes -- Issue an invite/verification code for the blog.
 * GET  /api/v1/signup-codes -- List the blog's codes.
 *
 * A code authorizes an agent to provision an account + API key via
 * POST /api/v1/agent/signup without an interactive flow. Codes can grant at most
 * an "editor" role (owner/admin are clamped to "author"); the returned `code` is
 * a shareable invite token, so it is returned in plaintext here.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiHandler } from "@/lib/create-api-handler";
import {
  createSignupCode,
  listSignupCodes,
} from "@/lib/signup-codes/repository";

const createSchema = z.object({
  // Only grantable roles are accepted; non-grantable roles are clamped to
  // "author" by the repository as a defense-in-depth fallback.
  role: z.enum(["author", "editor", "viewer"]).default("author"),
  note: z.string().max(500).optional(),
  maxUses: z.number().int().min(1).max(10000).default(1),
  expiresAtMs: z.number().int().positive().nullable().optional(),
});

export const POST = createApiHandler({
  auth: "admin",
  input: createSchema,
  audit: "create_signup_code",
  handler: async ({ body, session, blogId }) => {
    const created = await createSignupCode({
      blogId,
      role: body.role,
      note: body.note,
      maxUses: body.maxUses,
      expiresAtMs: body.expiresAtMs ?? null,
      createdBy: session.uid,
    });
    return NextResponse.json(created, { status: 201 });
  },
});

export const GET = createApiHandler({
  auth: "admin",
  handler: async ({ blogId }) => {
    const data = await listSignupCodes(blogId);
    return NextResponse.json({ data });
  },
});
