import "server-only";

import { canMintShareLink } from "@/lib/interviews/share-link-permissions";
import { getShareLink } from "@/lib/interviews/share-links-repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";
import type { UserRole } from "@repo/types";

/**
 * Shared access-control + storage-path resolution for playing back a
 * pre-recorded question audio attached to a share link (workspace dashboard).
 *
 * Unlike the per-interview recordings, share-link question audio is reviewed
 * only by workspace minters (owner / admin / editor) — there is no guest path.
 * Both the `recording-url` route (returns a streaming URL) and the
 * `recording-file` route (streams bytes) call this so the check lives once.
 */

type Failure = { ok: false; status: number; error: string };
type Success = { ok: true; storagePath: string };

export type ShareLinkRecordingAccessResult = Failure | Success;

/** Validate `questionId`; mirrors the per-interview param validation. */
export function parseShareLinkQuestionId(
  questionId: string | null,
): { ok: true; questionId: string } | Failure {
  const qid = questionId || "";
  if (!qid || !/^[\w-]+$/.test(qid)) {
    return { ok: false, status: 400, error: "invalid_questionId" };
  }
  return { ok: true, questionId: qid };
}

/**
 * Enforce the minter role and resolve the R2 storage path for the requested
 * share-link question. Failures carry the exact HTTP status the legacy
 * `recording-url` route returned.
 */
export async function resolveShareLinkRecordingAccess(
  role: UserRole,
  shareLinkId: string,
  questionId: string,
): Promise<ShareLinkRecordingAccessResult> {
  if (!canMintShareLink(role)) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  const shareLink = await getShareLink(DEFAULT_blog_id, shareLinkId);
  if (!shareLink) {
    return { ok: false, status: 404, error: "share_link_not_found" };
  }

  const match = (shareLink.asyncQuestions ?? []).find(
    (q) => q.id === questionId,
  );
  if (!match || !match.audioStoragePath) {
    return { ok: false, status: 404, error: "not_found" };
  }
  return { ok: true, storagePath: match.audioStoragePath };
}

/** Build the same-origin streaming URL for a share-link question recording. */
export function buildShareLinkRecordingFileUrl(
  shareLinkId: string,
  questionId: string,
): string {
  const qs = new URLSearchParams({ questionId });
  return `/api/v1/interviews/share-links/${shareLinkId}/recording-file?${qs.toString()}`;
}
