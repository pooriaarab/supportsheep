import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { verifyInterviewToken } from "@/lib/interviews/interview-token";
import { resolveInterviewTokenFromRequest } from "@/lib/interviews/interview-token-request";
import { saveDraft, type SaveDraftResult } from "@/lib/interviews/save-draft";
import { disposeWorker } from "@/lib/interviews/writer-worker-registry";
import { computeServerAuthoritativeUsage } from "@/lib/interviews/server-side-usage";
import { computeTotalCost, roundCostUsd } from "@/lib/interviews/cost";
import { getBlogConfig } from "@/lib/blog-config";
import { stitchAsyncInterview, type AsyncStitcherQuestion } from "@/lib/interviews/async-stitcher";
import { getProviderApiKey } from "@/lib/ai/providers";
import {
  getInterview,
  updateInterview,
} from "@/lib/interviews/interviews-repository";
import { releaseSessionLock } from "@/lib/interviews/session-locks-repository";
import { getShareLink } from "@/lib/interviews/share-links-repository";
import { listAsyncResponses } from "@/lib/interviews/async-responses-repository";
import { appendEvents } from "@/lib/interviews/events-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";
import { getDb } from "@/db";
import { interviews } from "@/db/schema/interviews";
import { and, eq, gte, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { RATE_LIMITS } from "@/lib/rate-limit";

const log = createLogger("interviews:end");

/**
 * Run a non-fatal step. On failure, log as a warning and return `null`
 * rather than re-throwing. Every step inside /end runs through this
 * wrapper so the only legitimate 500 source is the core state-flip
 * transaction. Post-transaction work (saveDraft, telemetry, cost cap,
 * lock release) returns null on failure and degrades gracefully into a
 * `draftStatus: "pending"` response so the client can retry from the
 * review page rather than seeing a hard 500.
 */
async function runStepWarn<T>(
  stepName: string,
  context: Record<string, unknown>,
  step: () => Promise<T>,
): Promise<T | null> {
  try {
    return await step();
  } catch (err: unknown) {
    log.warn(`/end step "${stepName}" failed (non-blocking)`, {
      step: stepName,
      ...context,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack?.slice(0, 1500) : undefined,
    });
    return null;
  }
}

/**
 * Resolve the interview token from the request. Delegates to the shared
 * `resolveInterviewTokenFromRequest` helper which prefers the
 * `interview_token_<id>` HttpOnly cookie set by /consent (PR #226) and
 * falls back to `Authorization: Bearer <token>` for clients that have
 * not yet migrated.
 */
function resolveInterviewToken(
  request: Request,
  interviewId: string,
): { token: string; source: "header" | "cookie" } | null {
  return resolveInterviewTokenFromRequest(request, interviewId);
}

/**
 * Release the per-interview session lock created by the heartbeat client.
 * `/end` is the canonical "this tab is done" signal — releasing the lock here
 * means a freshly opened review tab won't see a phantom "active session"
 * indicator. Wrapped in best-effort: a D1 failure during release must not
 * regress the user-visible result of /end.
 */
async function releaseSessionLockBestEffort(
  _blogId: string,
  interviewId: string,
): Promise<boolean> {
  const result = await runStepWarn(
    "release-session-lock",
    { interviewId },
    () => releaseSessionLock(interviewId),
  );
  return result ?? false;
}

/** Shape returned on the graceful-degradation path when saveDraft fails. */
interface GracefulEndResponse {
  articleId: string | null;
  slug: string;
  requiresReview: boolean;
  /**
   * Present when saveDraft could not produce an article. The client may use
   * this to surface "your draft is generating" rather than navigating to a
   * 404 review page.
   */
  draftStatus?: "pending";
  /** The /end step that failed, if any. */
  failingStep?: string;
}

export const POST = createApiHandler({
  auth: "none",
  rateLimit: {
    key: "interview-end",
    maxPerMinute: RATE_LIMITS["interview-end"],
  },
  handler: async ({ request, params }) => {
    const { id } = params as { id: string };
    const startedAtRoute = Date.now();

    // Per-request bookkeeping driving the structured exit log. Initialized
    // up-front so every return path can populate it.
    let exitStatus: "success" | "already_ended" | "failed" = "failed";
    let exitFailingStep: string | undefined;
    let sessionLockReleased = false;
    const blogId = DEFAULT_BLOG_ID;

    const logExit = () => {
      log.info("/end completed", {
        interviewId: id,
        status: exitStatus,
        failingStep: exitFailingStep,
        durationMs: Date.now() - startedAtRoute,
        sessionLockReleased,
      });
    };

    // 1. Authorize. Prefer the Authorization header (the in-call client's
    // legacy path); accept the per-interview HttpOnly cookie as a fallback
    // during the F-006 deprecation window when a fresh tab may have lost
    // its in-memory token but still holds the cookie.
    const resolved = resolveInterviewToken(request, id);
    if (!resolved) {
      exitFailingStep = "auth:missing-token";
      logExit();
      return NextResponse.json(
        { error: "Missing or invalid authorization header" },
        { status: 401 },
      );
    }

    const tokenPayload = verifyInterviewToken(resolved.token);
    if (!tokenPayload) {
      exitFailingStep = "auth:invalid-token";
      logExit();
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    // 2. Cross-verify that the token interview ID matches params ID
    if (tokenPayload.interviewId !== id) {
      exitFailingStep = "auth:token-id-mismatch";
      logExit();
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 3. Load interview and check status — idempotent already-ended guard.
    //
    // Atomicity: the state flip from "live" → "ended" is implemented as a
    // conditional UPDATE WHERE status = 'live' RETURNING. If the returned
    // row count is 0, either the interview is already "ended" (idempotent
    // path) or it was in "consent" (409 conflict). Two concurrent /end
    // calls for the same interview cannot both flip the status because only
    // the first UPDATE wins; the second sees row-count 0 and takes the
    // idempotent path.
    //
    // Residual race (article-create vs ended_at): the conditional UPDATE
    // and the article create (saveDraft → createArticle) are NOT a single
    // SQLite transaction — there is a window between the status flip and
    // the article write where a concurrent /end could observe ended_at=null
    // and try to create a second article. This is mitigated by:
    //   a) rate-limiting /end per interview (RATE_LIMITS["interview-end"]),
    //   b) the idempotent path checking `articleId` — if it is set the
    //      second call returns the cached article without calling saveDraft,
    //   c) saveDraft's createArticle is slug-collision-safe (it bumps the
    //      slug on conflict), so even if two articles are created the user
    //      gets back to a valid draft.
    // The old Firestore code ran the status flip AND the ended_at write in
    // the same server-side transaction; D1 does not expose multi-statement
    // userland transactions across reads, so we accept this soft gap.
    // TODO(M2-scale): serialize /end via a D1 advisory lock row if hard
    // atomicity becomes necessary.

    // First, check whether already ended (idempotent path).
    const existingInterview = await getInterview(blogId, id);
    if (!existingInterview) {
      exitFailingStep = "load:not-found";
      logExit();
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    if (existingInterview.status === "ended") {
      // Idempotent: interview already ended.
      if (existingInterview.articleId) {
        // Article was already created — return the cached result.
        // Slug lookup is best-effort (a transient D1 read failure must not
        // surface as 500 on the idempotent path).
        sessionLockReleased = await releaseSessionLockBestEffort(blogId, id);
        exitStatus = "already_ended";
        logExit();
        return NextResponse.json({
          articleId: existingInterview.articleId,
          slug: "",
          requiresReview: existingInterview.requiresReview ??
            (existingInterview.startedByRole === "author" || !existingInterview.startedByUid),
        });
      }
      // ended but no articleId — fall through to re-run saveDraft (recovery path)
    } else if (existingInterview.status !== "live") {
      exitFailingStep = "transaction:status-conflict";
      logExit();
      return NextResponse.json(
        { error: "Cannot end interview that is not in live status" },
        { status: 409 },
      );
    }

    // Conditional UPDATE: only flips status when still "live".
    // Returns the updated row so we confirm atomicity.
    const db = getDb();
    const now = Date.now();

    let flipped = false;
    try {
      const updated = await db
        .update(interviews)
        .set({
          status: "ended",
          endedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(interviews.blogId, blogId),
            eq(interviews.id, id),
            eq(interviews.status, "live"),
          ),
        )
        .returning({ id: interviews.id });
      flipped = updated.length > 0;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error("/end status-flip threw", {
        interviewId: id,
        errorMessage: errMsg,
        errorStack: err instanceof Error ? err.stack?.slice(0, 1500) : undefined,
      });
      exitFailingStep = "transaction:state-flip";
      sessionLockReleased = await releaseSessionLockBestEffort(blogId, id);
      logExit();
      throw err;
    }

    if (!flipped) {
      // Another concurrent /end already flipped the status while we were
      // reading the row above. Re-read to get the current state.
      const current = await getInterview(blogId, id);
      if (current?.articleId) {
        sessionLockReleased = await releaseSessionLockBestEffort(blogId, id);
        exitStatus = "already_ended";
        logExit();
        return NextResponse.json({
          articleId: current.articleId,
          slug: "",
          requiresReview: current.requiresReview ??
            (current.startedByRole === "author" || !current.startedByUid),
        });
      }
      // No article yet — fall through to create it
    }

    // Use the freshly-loaded interview data for the rest of the handler
    const interviewData = existingInterview;

    // 5. Compute duration (informational; stored in a future D1 column migration)
    const startedAtMs = interviewData.startedAt ?? Date.now();
    const _durationSec = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));

    let draftResult: SaveDraftResult | null = null;
    const stepCtx = { interviewId: id, mode: interviewData.mode ?? "live" };

    if (interviewData.mode === "async") {
      // Async stitching is fail-tolerant: every preparatory read + the
      // stitch call itself is wrapped so a single ailing dependency (the
      // share-link doc missing, the responses unreadable, the Claude key
      // fetch failing, the stitcher throwing on malformed input) does not
      // leave the interview marked `ended` with no article AND surface a
      // 500 to the user. Failure here yields a graceful "pending" response
      // — the user can retry from the review page.
      let questions: AsyncStitcherQuestion[] = [];
      if (interviewData.shareLinkId) {
        const shareLink = await runStepWarn(
          "async:load-share-link",
          stepCtx,
          () => getShareLink(blogId, interviewData.shareLinkId as string),
        );
        if (shareLink) {
          questions = (shareLink.asyncQuestions as AsyncStitcherQuestion[] | null) ?? [];
        }
      }

      const responseRows = await runStepWarn("async:load-responses", stepCtx, () =>
        listAsyncResponses(blogId, id),
      );
      const responses = (responseRows ?? []).map((r) => ({
        questionId: r.questionId,
        transcript: r.transcript,
      }));

      const apiKey = await runStepWarn("async:claude-api-key", stepCtx, () =>
        getProviderApiKey("claude"),
      );

      if (apiKey) {
        const canvasState = await runStepWarn("async:stitch", stepCtx, () =>
          stitchAsyncInterview({
            questions,
            responses,
            topic: interviewData.topic ?? undefined,
            goal: interviewData.goal ?? undefined,
            language: interviewData.language,
            guestName: interviewData.guestName || "Guest",
            apiKey,
          }),
        );

        if (canvasState) {
          draftResult = await runStepWarn("async:save-draft", stepCtx, () =>
            saveDraft(id, canvasState, blogId),
          );
          if (!draftResult) {
            exitFailingStep = "async:save-draft";
          }
        } else {
          exitFailingStep = "async:stitch";
        }
      } else {
        exitFailingStep = "async:claude-api-key";
      }

      await runStepWarn("async:update-duration", stepCtx, () =>
        updateInterview(blogId, id, {}), // updatedAt is set automatically
      );
    } else {
      // 6. Save draft via saveDraft helper. Demoted from runStep to
      // runStepWarn: the core state-flip is already committed, so a
      // saveDraft failure (Claude key missing, slug-uniqueness query
      // failure, sanitize-html on malformed canvas, etc.) must not 500 the
      // client. The client receives a graceful "pending" response and may
      // retry by re-POSTing /end — the second call hits the idempotent
      // path, re-runs saveDraft, and either succeeds or returns pending
      // again. The interview stays `ended` either way.
      draftResult = await runStepWarn("live:save-draft", stepCtx, () =>
        saveDraft(id, undefined, blogId),
      );
      if (!draftResult) {
        exitFailingStep = "live:save-draft";
      }

      // 7. Gather cost and token metrics from the SERVER-AUTHORITATIVE source.
      //
      // Security note (F-003): the previous implementation summed token usage
      // out of the events subcollection, where the realtime token counts were
      // populated by `transcript_ai` events posted from the browser. The
      // browser is untrusted: a malicious guest could simply report
      // `usage: { input_tokens: 0, output_tokens: 0 }` on every turn and
      // bypass the workspace `monthlyCostCapUsd` cap entirely. We now compute
      // realtime token usage from server-persisted transcript text (which the
      // events route validates with a strict zod schema and rate limit), so a
      // malicious client cannot under-report it. See
      // `lib/interviews/server-side-usage.ts` for the heuristic and rationale.
      const usage = (await runStepWarn("live:server-authoritative-usage", stepCtx, () =>
        computeServerAuthoritativeUsage(blogId, id),
      )) ?? {
        realtime: { input: 0, output: 0 },
        writer: { input: 0, cachedInput: 0, output: 0 },
      };
      const costUsd = roundCostUsd(computeTotalCost(usage.realtime, usage.writer));
      // realtimeTokens/writerTokens logged for observability; full token
      // column storage is a future D1 column migration (TODO(M2-metrics)).
      const _realtimeTokens = usage.realtime.input + usage.realtime.output;
      const _writerTokens = usage.writer.input + usage.writer.cachedInput + usage.writer.output;

      // 8. Update the remaining metrics on the interview row. Blog config
      // load is best-effort — without it we simply skip the cost-cap check
      // rather than fail the user's session finalization.
      const config = await runStepWarn("live:load-blog-config", stepCtx, () =>
        getBlogConfig(),
      );
      const monthlyCostCapUsd = config?.interview?.monthlyCostCapUsd ?? null;

      // Cost-cap accounting is a non-fatal, workspace-level telemetry concern.
      // The interview is already marked `ended`; the user's draft is already
      // saved. A failure in the workspace-wide aggregation query must not
      // surface as a 500 to the guest finalizing their own session.
      if (monthlyCostCapUsd !== null) {
        const startOfThisMonth = new Date();
        startOfThisMonth.setDate(1);
        startOfThisMonth.setHours(0, 0, 0, 0);
        const startOfMonthMs = startOfThisMonth.getTime();

        const monthlyResult = await runStepWarn(
          "live:cost-cap-query",
          stepCtx,
          () =>
            db
              .select({ totalCost: sql<number>`coalesce(sum(cost_usd), 0)` })
              .from(interviews)
              .where(
                and(
                  eq(interviews.blogId, blogId),
                  gte(interviews.createdAt, startOfMonthMs),
                ),
              ),
        );

        if (monthlyResult) {
          // The current interview's costUsd in D1 is stale (we haven't
          // committed the metric update yet) — add the freshly computed cost.
          const storedTotal = (monthlyResult[0]?.totalCost ?? 0) as number;
          const currentStored = existingInterview.costUsd ?? 0;
          // Replace the stale current value with fresh costUsd
          const totalMonthlyCostUsd = storedTotal - currentStored + costUsd;

          if (totalMonthlyCostUsd > monthlyCostCapUsd) {
            // Emit warning event via D1 events repo (non-fatal)
            await runStepWarn("live:cost-cap-warning-event", stepCtx, () =>
              appendEvents(blogId, id, [
                {
                  kind: "warning",
                  ts: new Date().toISOString(),
                  payload: {
                    message: `Workspace monthly cost cap of $${monthlyCostCapUsd} breached. Total: $${totalMonthlyCostUsd.toFixed(2)}`,
                    type: "cost_cap_exceeded",
                  },
                },
              ]),
            );
          }
        }
      }

      // Metrics update is non-fatal telemetry. The article draft is already
      // saved at this point; failing the user's request because metrics
      // didn't persist would be a worse outcome than missing analytics data.
      await runStepWarn("live:update-metrics", stepCtx, () =>
        updateInterview(blogId, id, { costUsd }),
      );

      // 9. Dispose the active worker. Errors here are non-critical (the
      // interview is already ended) — log + swallow so we don't leak the
      // failure mode into the client's 500.
      try {
        disposeWorker(id);
      } catch (err: unknown) {
        log.warn("/end disposeWorker threw (non-blocking)", {
          interviewId: id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // TODO(M2-metrics): persist a cost-cap-breach flag on the interview row
      // for the admin UI. The D1 interviews schema does not yet have a
      // cost_cap_breach column — add it in a future migration. The breach
      // IS recorded as a warning event via appendEvents above, so no data
      // is lost; the admin filter surface is just deferred.
    }

    // Release the per-interview session lock on the way out. /end is the
    // canonical "this tab is done" signal; without explicit release the
    // lock document lingers until the 10s stale-threshold elapses, which
    // can confuse a freshly opened review tab. Best-effort: a failure here
    // must not change the user-visible response.
    sessionLockReleased = await releaseSessionLockBestEffort(blogId, id);

    // 10. Compose the response. If saveDraft succeeded we return the full
    // draft summary; if it failed (or the async stitch produced no draft)
    // we still return 200 with a graceful "pending" payload so the client
    // can retry from the review page rather than seeing a hard 500.
    if (draftResult) {
      exitStatus = "success";
      exitFailingStep = undefined;
      logExit();
      return NextResponse.json({
        articleId: draftResult.articleId,
        slug: draftResult.slug,
        requiresReview: draftResult.requiresReview,
      });
    }

    const fallbackRequiresReview =
      interviewData.requiresReview ??
      (interviewData.startedByRole === "author" || !interviewData.startedByUid);
    const gracefulBody: GracefulEndResponse = {
      articleId: null,
      slug: "",
      requiresReview: fallbackRequiresReview,
      draftStatus: "pending",
      failingStep: exitFailingStep,
    };
    exitStatus = "failed";
    logExit();
    return NextResponse.json(gracefulBody);
  },
});
