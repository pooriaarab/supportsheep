/**
 * Test-only seed endpoint for deploy-preview e2e matrix.
 *
 * POST /api/v1/interviews/test-only/seed-share-link
 *
 * Creates a share-link record directly in D1 with the requested
 * recording-config / mode / visibility / authMode combo and returns the
 * plaintext token. Used by `tests/deploy-preview-interview-matrix.spec.ts`
 * and the local dev harness (`apps/web/scripts/dev-interview-harness.ts`)
 * to exercise the full interview surface — device picker (audio/video) and
 * Tavus video path included — without burning real money on OpenAI realtime
 * mints. The spec mocks the network calls client-side.
 *
 * All overrides are optional; defaults match the original PR #199 seed
 * behaviour (transcript / live / link / anonymous) so existing callers keep
 * working.
 *
 * Gated by the `INTERVIEW_E2E_TEST_SEED` env flag. Returns 404 unless the
 * flag is set, so it is inert in real production.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  createShareLink,
  deleteShareLink,
} from "@/lib/interviews/share-links-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";
import { generateShareLinkToken } from "@/lib/interviews/share-link-token";
import {
  AUTH_MODE,
  RECORDING_CONFIG,
  SHARE_LINK_VISIBILITY,
  DEFAULT_DURATION_SEC,
} from "@/lib/interviews/share-link-schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:interviews:test-only:seed-share-link");

const SeedInput = z
  .object({
    visibility: z.enum(SHARE_LINK_VISIBILITY).default("link"),
    authMode: z.enum(AUTH_MODE).default("anonymous"),
    recordingConfig: z.enum(RECORDING_CONFIG).default("transcript"),
    mode: z.enum(["live", "async"]).default("live"),
    topic: z.string().max(500).optional(),
    createdByUid: z.string().min(1).optional(),
    workspaceId: z.string().min(1).optional(),
    tavusPersonaId: z.string().min(1).optional(),
    tavusReplicaId: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.recordingConfig === "video") {
      if (!value.tavusPersonaId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tavusPersonaId"],
          message: "tavusPersonaId is required when recordingConfig is video",
        });
      }
      if (!value.tavusReplicaId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["tavusReplicaId"],
          message: "tavusReplicaId is required when recordingConfig is video",
        });
      }
    }
  });

export const POST = createApiHandler({
  auth: "none",
  input: SeedInput,
  handler: async ({ body }) => {
    if (process.env.INTERVIEW_E2E_TEST_SEED !== "true") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { token, hash } = generateShareLinkToken();

    // tavusPersonaId/tavusReplicaId are accepted for backward-compat with the
    // e2e spec request shape but not persisted — the D1 share_links table has
    // no such columns and nothing reads them off the share link.
    const row = await createShareLink(DEFAULT_BLOG_ID, {
      type: body.visibility,
      createdBy: body.createdByUid ?? "test-seed-uid",
      workspaceId: body.workspaceId ?? "default",
      topic: body.topic ?? `e2e ${body.visibility}/${body.authMode}`,
      goal: null,
      style: "smart",
      authMode: body.authMode,
      recordingConfig: body.recordingConfig,
      maxDurationSec: DEFAULT_DURATION_SEC,
      expiresAt: null,
      maxUses: null,
      tokenHash: hash,
      language: "en",
      scheduledAt: null,
      scheduledGuestEmail: null,
      mode: body.mode,
      asyncQuestions: [],
    });

    log.info("seeded share-link", {
      shareLinkId: row.id,
      visibility: body.visibility,
      authMode: body.authMode,
      recordingConfig: body.recordingConfig,
      mode: body.mode,
    });

    return NextResponse.json({
      token,
      shareLinkId: row.id,
      visibility: body.visibility,
      authMode: body.authMode,
      recordingConfig: body.recordingConfig,
      mode: body.mode,
    });
  },
});

export const DELETE = createApiHandler({
  auth: "none",
  input: z.object({ shareLinkId: z.string().min(1) }),
  handler: async ({ body }) => {
    if (process.env.INTERVIEW_E2E_TEST_SEED !== "true") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await deleteShareLink(DEFAULT_BLOG_ID, body.shareLinkId);
    return NextResponse.json({ success: true });
  },
});
