/**
 * Test-only tool dispatch endpoint for per-category e2e coverage.
 *
 * POST /api/v1/interviews/test-only/dispatch-tool
 * Body: `{ interviewId, toolName, args }`
 *
 * Routes through the real `dispatchTool` from `@/lib/interviews/tools`
 * so the spec exercises the exact validation + per-session cap + dedupe
 * + canvas-mutation path the realtime events route uses. Returns the
 * `ToolResult` plus a snapshot of the post-dispatch canvas so the spec
 * can assert state diffs without poking the database directly.
 *
 * Belt + suspenders: 404 unless BOTH `NODE_ENV !== "production"` AND
 * `INTERVIEW_E2E_TEST_SEED === "true"`. The env-flag-only check used by
 * the share-link seed route is fine for share-link records (they only
 * leak topic strings), but tool dispatch mutates per-session writer
 * state and could be abused to overwrite a live interview's canvas if
 * the flag ever leaked into production by mistake. The `NODE_ENV` gate
 * is the second lock that makes the route inert even with the flag set.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  createInterview,
  deleteInterview,
  getInterview,
} from "@/lib/interviews/interviews-repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";
import {
  buildToolContext,
  dispatchTool,
} from "@/lib/interviews/tools";
import {
  disposeWorker,
  getOrCreateWorker,
} from "@/lib/interviews/writer-worker-registry";
import { type InterviewLanguage } from "@/lib/interviews/share-link-schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:interviews:test-only:dispatch-tool");

const DispatchInput = z.object({
  interviewId: z.string().min(1),
  toolName: z.string().min(1).max(128),
  args: z.unknown().optional(),
  /**
   * When `true`, the route will create a live interview document for
   * `interviewId` if one does not already exist. Lets the e2e spec
   * stand up the test in a single round-trip without a separate seed
   * endpoint — still gated by the same NODE_ENV + flag locks.
   */
  seedIfMissing: z.boolean().optional(),
});

function isEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.INTERVIEW_E2E_TEST_SEED === "true"
  );
}

export const POST = createApiHandler({
  auth: "none",
  input: DispatchInput,
  handler: async ({ body }) => {
    if (!isEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const existing = await getInterview(DEFAULT_blog_id, body.interviewId);
    let interviewData: {
      topic?: string | null;
      goal?: string | null;
      language?: InterviewLanguage;
    };
    if (!existing) {
      if (!body.seedIfMissing) {
        return NextResponse.json(
          { error: "Interview not found" },
          { status: 404 },
        );
      }
      interviewData = {
        topic: "e2e per-category tool dispatch",
        language: "en" as InterviewLanguage,
      };
      await createInterview(DEFAULT_blog_id, {
        id: body.interviewId,
        status: "live",
        startedByUid: "test-seed-uid",
        startedByRole: "guest",
        style: "smart",
        recordingConfig: "transcript",
        maxDurationSec: 300,
        topic: interviewData.topic,
        goal: null,
        language: interviewData.language,
      });
    } else {
      interviewData = {
        topic: existing.topic,
        goal: existing.goal,
        language: existing.language,
      };
    }

    // Use a dummy api key — the spec only exercises sync canvas-mutation
    // tools that never hit Claude. The writer-worker constructor requires
    // *some* key; tests must not call `appendTranscript` which would
    // trigger the real Anthropic refinement loop.
    const worker = getOrCreateWorker({
      interviewId: body.interviewId,
      topic: interviewData.topic ?? undefined,
      goal: interviewData.goal ?? undefined,
      language: interviewData.language,
      apiKey: "test-only-dummy-key",
    });
    const ctx = buildToolContext({ interviewId: body.interviewId, worker });

    const result = await dispatchTool(body.toolName, body.args, ctx);

    log.info("test-only dispatch-tool invoked", {
      interviewId: body.interviewId,
      toolName: body.toolName,
      ok: result.ok,
    });

    return NextResponse.json({
      result,
      canvas: worker.getCanvas(),
    });
  },
});

const DeleteInput = z.object({
  interviewId: z.string().min(1),
});

export const DELETE = createApiHandler({
  auth: "none",
  input: DeleteInput,
  handler: async ({ body }) => {
    if (!isEnabled()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    disposeWorker(body.interviewId);
    await deleteInterview(DEFAULT_blog_id, body.interviewId);

    return NextResponse.json({ success: true });
  },
});
