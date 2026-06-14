import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { getInterview } from "@/lib/interviews/interviews-repository";
import { appendEvents } from "@/lib/interviews/events-repository";
import { getWorker } from "@/lib/interviews/writer-worker-registry";
import { createLogger } from "@/lib/logger";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

const log = createLogger("interviews:canvas-edit");

/**
 * Cap for the contentPreview field in the structured user-edit log. Bounds
 * the per-line payload and keeps any PII tail truncated so log aggregations
 * (GCP Cloud Logging) don't ingest unbounded user-typed prose.
 */
const CONTENT_PREVIEW_MAX = 200;

// Length caps protect both the SSE fan-out path (every connected client
// receives the payload) and the Firestore event document size (F-009).
// Section ids are short slugs in practice; values are user-edited block
// contents (heading, paragraph, bullet) and 8 KB comfortably covers
// legitimate edits while rejecting megabyte-scale DoS payloads.
const CANVAS_EDIT_SECTION_ID_MAX = 64;
const CANVAS_EDIT_VALUE_MAX = 8_000;
const CANVAS_EDIT_INDEX_MAX = 10_000;

const canvasEditSchema = z.object({
  sectionId: z.string().min(1).max(CANVAS_EDIT_SECTION_ID_MAX),
  field: z.enum(["heading", "paragraph_text", "bullet_text"]),
  index: z.number().int().nonnegative().max(CANVAS_EDIT_INDEX_MAX).optional(),
  value: z.string().max(CANVAS_EDIT_VALUE_MAX),
}).refine((data) => {
  if ((data.field === "paragraph_text" || data.field === "bullet_text") && data.index === undefined) {
    return false;
  }
  return true;
}, {
  message: "index is required when field is paragraph_text or bullet_text",
  path: ["index"],
});

// In-memory rate limiting map: interviewId -> timestamps
const rateLimitMap = new Map<string, number[]>();

export const POST = createApiHandler({
  auth: "user",
  input: canvasEditSchema,
  handler: async ({ params, body, role }) => {
    const { id } = params as { id: string };

    // 1. Enforce write-capable role (owner/admin/editor).
    if (!role || (role !== "admin" && role !== "editor" && role !== "owner")) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // 2. Enforce rate limiting: 30 edits per minute per interview
    const now = Date.now();
    const timestamps = rateLimitMap.get(id) || [];
    const validTimestamps = timestamps.filter((t) => now - t < 60000);
    if (validTimestamps.length >= 30) {
      return NextResponse.json(
        { error: "Too many requests. Rate limit is 30 edits per minute." },
        { status: 429 }
      );
    }
    validTimestamps.push(now);
    rateLimitMap.set(id, validTimestamps);

    // 3. Fetch the interview and validate live status
    const interview = await getInterview(DEFAULT_BLOG_ID, id);
    if (!interview) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    if (interview.status !== "live") {
      return NextResponse.json(
        { error: "Cannot edit canvas for interview that is not live" },
        { status: 409 }
      );
    }

    // 4. Save canvas_edit event to D1.
    const { sectionId, field, index, value } = body;
    await appendEvents(DEFAULT_BLOG_ID, id, [
      {
        kind: "canvas_edit",
        ts: new Date().toISOString(),
        payload: { sectionId, field, index, value },
      },
    ]);

    // 5. Structured audit log for the human user-edit cue. Mirrors the
    //    shape that AI tool dispatches emit via `withToolCallLogging`
    //    so a `gcloud logging read jsonPayload.kind="user_edit"` query
    //    can pull every human-driven canvas mutation for an interview.
    //    `contentPreview` is truncated to bound PII; `diffSize` captures
    //    the raw value length so a regression like W24.I / W25.A (empty
    //    body cues) is detectable from logs alone.
    log.info("user_edit dispatched", {
      kind: "user_edit",
      interviewId: id,
      nodeType: field,
      position: index ?? null,
      contentPreview: value.slice(0, CONTENT_PREVIEW_MAX),
      diffSize: value.length,
    });

    // 6. Update the WriterWorker in-memory if it exists
    const worker = getWorker(id);
    if (worker) {
      worker.applyCanvasEdit({ sectionId, field, index, value });
    }

    return NextResponse.json({ success: true });
  },
});
