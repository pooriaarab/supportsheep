import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { verifyInterviewToken } from "@/lib/interviews/interview-token";
import { resolveInterviewTokenFromRequest } from "@/lib/interviews/interview-token-request";
import { createLogger } from "@/lib/logger";
import {
  getSessionLock,
  upsertHeartbeat,
  deleteSessionLock,
  STALE_LOCK_THRESHOLD_MS,
} from "@/lib/interviews/session-locks-repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";

const log = createLogger("interviews:session-lock");

/**
 * Force dynamic — defensive against Next.js attempting any static
 * evaluation of an authenticated, interviewId-scoped route.
 */
export const dynamic = "force-dynamic";

export { STALE_LOCK_THRESHOLD_MS };

const HEARTBEAT_ID_MAX = 128;

const heartbeatSchema = z.object({
  heartbeatId: z.string().min(1).max(HEARTBEAT_ID_MAX),
  /** When true, the caller forcibly takes over an existing active lock. */
  takeover: z.boolean().optional(),
});

function authorizeInterviewToken(
  request: Request,
  interviewId: string,
): NextResponse | null {
  const resolved = resolveInterviewTokenFromRequest(request, interviewId);
  if (!resolved) {
    return NextResponse.json(
      { error: "Missing interview token" },
      { status: 401 },
    );
  }
  const payload = verifyInterviewToken(resolved.token);
  if (!payload) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (payload.interviewId !== interviewId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return null;
}

function lockIsStale(lastBeatAt: number | null | undefined): boolean {
  if (lastBeatAt == null) return true;
  return Date.now() - lastBeatAt > STALE_LOCK_THRESHOLD_MS;
}

/**
 * Emit a structured error log before returning 500 so production failures
 * can be diagnosed without redeploying.
 */
function logRouteFailure(
  method: "GET" | "Article" | "DELETE",
  interviewId: string,
  request: Request,
  err: unknown,
): void {
  const error = err instanceof Error ? err : undefined;
  log.error("session-lock route failed", {
    method,
    interviewId,
    requestPath: new URL(request.url).pathname,
    errorMessage: error?.message ?? String(err),
    errorName: error?.name,
    errorStack: error?.stack,
  });
}

/**
 * GET — return the current lock holder (if any) and whether it is stale.
 */
export const GET = createApiHandler({
  auth: "none",
  handler: async ({ request, params }) => {
    const { id } = params as { id: string };
    const authError = authorizeInterviewToken(request, id);
    if (authError) return authError;

    try {
      const lock = await getSessionLock(DEFAULT_blog_id, id);
      if (!lock) {
        return NextResponse.json({ holder: null, lastBeatAt: null, stale: false });
      }
      const stale = lockIsStale(lock.lastBeatAt);
      return NextResponse.json({
        holder: lock.heartbeatId,
        lastBeatAt: lock.lastBeatAt,
        stale,
      });
    } catch (err) {
      logRouteFailure("GET", id, request, err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
});

/**
 * POST — record a heartbeat.
 */
export const POST = createApiHandler({
  auth: "none",
  input: heartbeatSchema,
  handler: async ({ body, request, params }) => {
    const { id } = params as { id: string };
    const authError = authorizeInterviewToken(request, id);
    if (authError) return authError;

    const { heartbeatId, takeover } = body;

    try {
      const result = await upsertHeartbeat(
        DEFAULT_blog_id,
        id,
        heartbeatId,
        takeover ?? false,
      );

      if (result.status === "conflict") {
        log.info("session-lock conflict", {
          interviewId: id,
          attemptedHeartbeatId: heartbeatId,
          currentHolder: result.currentHolder,
        });
        return NextResponse.json(result, { status: 409 });
      }
      return NextResponse.json(result);
    } catch (err) {
      logRouteFailure("Article", id, request, err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
});

/**
 * DELETE — release the lock if the caller is the current holder.
 */
export const DELETE = createApiHandler({
  auth: "none",
  handler: async ({ request, params }) => {
    const { id } = params as { id: string };
    const authError = authorizeInterviewToken(request, id);
    if (authError) return authError;

    const url = new URL(request.url);
    const heartbeatId = url.searchParams.get("heartbeatId") ?? "";
    if (!heartbeatId) {
      return NextResponse.json({ error: "heartbeatId required" }, { status: 400 });
    }

    try {
      await deleteSessionLock(DEFAULT_blog_id, id, heartbeatId);
      return NextResponse.json({ released: true });
    } catch (err) {
      logRouteFailure("DELETE", id, request, err);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
  },
});
