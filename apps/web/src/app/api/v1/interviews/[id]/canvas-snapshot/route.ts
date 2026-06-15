import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { getInterview } from "@/lib/interviews/interviews-repository";
import { verifyInterviewToken } from "@/lib/interviews/interview-token";
import { resolveInterviewTokenFromRequest } from "@/lib/interviews/interview-token-request";
import { getWorker } from "@/lib/interviews/writer-worker-registry";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";

/**
 * GET — return the most recent canvas snapshot for an in-progress interview.
 * Used by the live page on mount to detect a recoverable prior session
 * (refresh / browser crash) and rehydrate the canvas before showing the orb.
 *
 * Response: { canvas: CanvasState | null, snapshotAt: number | null }.
 * `canvas: null` means no recoverable state exists — the UI should fall
 * through to its normal first-mount flow.
 */
export const GET = createApiHandler({
  auth: "none",
  handler: async ({ request, params }) => {
    const { id } = params as { id: string };

    const resolved = resolveInterviewTokenFromRequest(request, id);
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
    if (payload.interviewId !== id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Prefer the in-memory worker canvas — it is the freshest source and
    // includes any diffs the stream loop has not yet debounced to disk.
    // Fall back to the persisted snapshot when this Function instance has no
    // active worker (post-refresh on a cold container).
    const worker = getWorker(id);
    if (worker) {
      const canvas = worker.getCanvas();
      const isEmpty =
        !canvas.title &&
        canvas.sections.length === 0 &&
        canvas.meta.description === null &&
        canvas.meta.tags.length === 0;
      if (!isEmpty) {
        return NextResponse.json({ canvas, snapshotAt: Date.now(), source: "worker" });
      }
    }

    const interview = await getInterview(DEFAULT_blog_id, id);
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }
    if (!interview.canvasSnapshot) {
      return NextResponse.json({ canvas: null, snapshotAt: null });
    }
    return NextResponse.json({
      canvas: interview.canvasSnapshot,
      snapshotAt: interview.canvasSnapshotAt,
      source: "d1",
    });
  },
});
