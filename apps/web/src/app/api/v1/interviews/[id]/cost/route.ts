import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { aggregateUsage } from "@/lib/interviews/aggregate-usage";
import {
  computeRealtimeCost,
  computeTotalCost,
  computeWriterCost,
  roundCostUsd,
} from "@/lib/interviews/cost";
import { getInterview } from "@/lib/interviews/interviews-repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";
import { toIsoString } from "@/lib/interviews/timestamp-utils";

/**
 * Best-effort ISO conversion for epoch-ms numbers (D1 timestamp format).
 * Handles null/undefined gracefully.
 */
function epochMsToIso(value: number | null | undefined): string | null {
  if (value == null) return null;
  return toIsoString(new Date(value));
}

export const GET = createApiHandler({
  auth: "user",
  handler: async ({ params, role }) => {
    const { id } = params as { id: string };

    // 1. Enforce write-capable role (owner/admin/editor).
    if (!role || (role !== "admin" && role !== "editor" && role !== "owner")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 2. Fetch the interview from D1
    const blogId = DEFAULT_blog_id;
    const interview = await getInterview(blogId, id);
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    let costUsd = 0;
    let realtimeTokens = 0;
    let writerTokens = 0;
    let durationSec = 0;
    let realtimeCostUsd = 0;
    let writerCostUsd = 0;

    if (interview.status === "live") {
      const usage = await aggregateUsage(blogId, id);
      realtimeCostUsd = computeRealtimeCost(usage.realtime);
      writerCostUsd = computeWriterCost(usage.writer);
      costUsd = roundCostUsd(computeTotalCost(usage.realtime, usage.writer));
      realtimeTokens = usage.realtime.input + usage.realtime.output;
      writerTokens = usage.writer.input + usage.writer.cachedInput + usage.writer.output;

      const startedAtMs = interview.startedAt;
      durationSec = startedAtMs
        ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
        : 0;
    } else {
      costUsd = interview.costUsd ?? 0;
      durationSec = (interview.startedAt && interview.endedAt)
        ? Math.max(0, Math.floor((interview.endedAt - interview.startedAt) / 1000))
        : 0;
      // For ended interviews we re-derive the breakdown by querying events so
      // the admin UI can show provider-level costs without having to persist
      // a separate breakdown field on the interview row. Cheap: the same
      // events query backs `aggregateUsage` already.
      const usage = await aggregateUsage(blogId, id);
      realtimeCostUsd = computeRealtimeCost(usage.realtime);
      writerCostUsd = computeWriterCost(usage.writer);
      realtimeTokens = usage.realtime.input + usage.realtime.output;
      writerTokens = usage.writer.input + usage.writer.cachedInput + usage.writer.output;
    }

    // Returns ONLY admin-relevant fields - no PII (no guestName, transcripts, etc).
    return NextResponse.json({
      status: interview.status ?? "unknown",
      endedAt: epochMsToIso(interview.endedAt),
      startedAt: epochMsToIso(interview.startedAt),
      costUsd,
      realtimeTokens,
      writerTokens,
      durationSec,
      breakdown: {
        realtimeCostUsd: roundCostUsd(realtimeCostUsd),
        writerCostUsd: roundCostUsd(writerCostUsd),
      },
    });
  },
});
