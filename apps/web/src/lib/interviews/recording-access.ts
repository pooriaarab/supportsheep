import "server-only";

import { verifyRequest } from "@/lib/auth/session";
import { verifyInterviewToken } from "@/lib/interviews/interview-token";
import { resolveInterviewTokenFromRequest } from "@/lib/interviews/interview-token-request";
import { getInterview } from "@/lib/interviews/interviews-repository";
import { getShareLink } from "@/lib/interviews/share-links-repository";
import { getAsyncResponse } from "@/lib/interviews/async-responses-repository";
import { DEFAULT_blog_id, getMembershipByUser } from "@/lib/tenancy/repository";
import type { UserRole } from "@repo/types";

/**
 * Shared access-control + storage-path resolution for interview recording
 * playback. Both the `recording-url` route (returns a same-origin streaming
 * URL) and the `recording-file` route (streams the bytes) call this so the
 * PII security model lives in exactly one place.
 *
 * The audio is private guest/admin PII. Access rules (must match exactly):
 *   - kind === "question": guest (valid interview bearer token / cookie for
 *     THIS interview) OR any authenticated workspace member.
 *   - kind === "response": workspace member with role owner/admin/editor only.
 *     Guests can NEVER fetch response audio.
 */

export type RecordingKind = "question" | "response";

type Failure = { ok: false; status: number; error: string };
type Success = { ok: true; storagePath: string };

export type RecordingAccessResult = Failure | Success;

/**
 * Validate `kind` + `questionId` request params. Returns the normalized values
 * or a 400 failure. Centralized so both routes reject malformed input the same
 * way before any auth or DB work.
 */
export function parseRecordingParams(
  kind: string | null,
  questionId: string | null,
): { ok: true; kind: RecordingKind; questionId: string } | Failure {
  if (kind !== "question" && kind !== "response") {
    return { ok: false, status: 400, error: "invalid_kind" };
  }
  const qid = questionId || "";
  if (!qid || !/^[\w-]+$/.test(qid)) {
    return { ok: false, status: 400, error: "invalid_questionId" };
  }
  return { ok: true, kind, questionId: qid };
}

/**
 * Resolve the caller, enforce the per-kind access rules, and return the R2
 * storage path for the requested recording. Failures carry the exact HTTP
 * status the legacy `recording-url` route returned for that case.
 */
export async function resolveRecordingAccess(
  request: Request,
  interviewId: string,
  kind: RecordingKind,
  questionId: string,
): Promise<RecordingAccessResult> {
  // 1. Resolve caller identity. Prefer the interview bearer token / cookie
  //    (guest); fall back to a workspace session cookie.
  let callerKind: "guest" | "workspace" | null = null;
  let workspaceRole: UserRole | null = null;

  const resolved = resolveInterviewTokenFromRequest(request, interviewId);
  if (resolved) {
    const tokenPayload = verifyInterviewToken(resolved.token);
    if (!tokenPayload || tokenPayload.interviewId !== interviewId) {
      return { ok: false, status: 401, error: "unauthorized" };
    }
    callerKind = "guest";
  } else {
    try {
      const viewer = await verifyRequest();
      workspaceRole = ((await getMembershipByUser(viewer.uid))?.role ??
        "guest") as UserRole;
      callerKind = "workspace";
    } catch {
      return { ok: false, status: 401, error: "unauthorized" };
    }
  }

  // 2. Response audio is guest PII — restricted to workspace reviewers with an
  //    owner/admin/editor role. Guests may never fetch response audio.
  if (kind === "response" && callerKind !== "workspace") {
    return { ok: false, status: 403, error: "forbidden" };
  }
  if (kind === "response" && callerKind === "workspace") {
    if (
      workspaceRole !== "owner" &&
      workspaceRole !== "admin" &&
      workspaceRole !== "editor"
    ) {
      return { ok: false, status: 403, error: "forbidden" };
    }
  }

  // 3. Resolve the interview to find its share-link id (required for question
  //    paths, used as an ownership/scoping check).
  const interview = await getInterview(DEFAULT_blog_id, interviewId);
  if (!interview) {
    return { ok: false, status: 404, error: "Interview not found" };
  }

  if (kind === "question") {
    const shareLinkId = interview.shareLinkId;
    if (!shareLinkId) {
      return { ok: false, status: 404, error: "not_found" };
    }
    const shareLink = await getShareLink(DEFAULT_blog_id, shareLinkId);
    if (!shareLink) {
      return { ok: false, status: 404, error: "not_found" };
    }
    const match = (shareLink.asyncQuestions ?? []).find(
      (q) => q.id === questionId,
    );
    if (!match || !match.audioStoragePath) {
      return { ok: false, status: 404, error: "not_found" };
    }
    return { ok: true, storagePath: match.audioStoragePath };
  }

  // kind === "response"
  const response = await getAsyncResponse(
    DEFAULT_blog_id,
    interviewId,
    questionId,
  );
  if (!response || !response.audioStoragePath) {
    return { ok: false, status: 404, error: "not_found" };
  }
  return { ok: true, storagePath: response.audioStoragePath };
}

/**
 * Build the same-origin streaming URL the `recording-url` route hands back to
 * clients. The `<audio>`/`fetch` consumer loads it directly — cookie auth
 * (interview-token cookie path-scoped to `/api/v1/interviews/{id}`, or the
 * workspace session cookie) carries the credentials.
 */
export function buildRecordingFileUrl(
  interviewId: string,
  kind: RecordingKind,
  questionId: string,
): string {
  const qs = new URLSearchParams({ kind, questionId });
  return `/api/v1/interviews/${interviewId}/recording-file?${qs.toString()}`;
}
