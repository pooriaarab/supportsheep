import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { getMediaBucket } from "@/lib/media/bucket";
import {
  parseRecordingParams,
  resolveRecordingAccess,
} from "@/lib/interviews/recording-access";

/**
 * GET /api/v1/interviews/[id]/recording-file?kind=<question|response>&questionId=<id>
 *
 * Streams private interview audio directly from R2 through this authed Worker
 * route — replaces the GCS signed-URL flow. Access control is identical to the
 * `recording-url` route (both call `resolveRecordingAccess`):
 *   - kind=question — guest (interview token) or any workspace member.
 *   - kind=response — workspace owner/admin/editor only; never guests.
 *
 * Auth: `auth: "none"` because the route does its own dual auth (interview
 * bearer token / cookie for guests, session cookie for workspace members).
 */
export const GET = createApiHandler<unknown, { id: string }>({
  auth: "none",
  handler: async ({ request, params }) => {
    const interviewId = params?.id;
    if (!interviewId) {
      return NextResponse.json({ error: "Interview not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const parsed = parseRecordingParams(
      url.searchParams.get("kind"),
      url.searchParams.get("questionId"),
    );
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const access = await resolveRecordingAccess(
      request,
      interviewId,
      parsed.kind,
      parsed.questionId,
    );
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const obj = await getMediaBucket().get(access.storagePath);
    if (!obj) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return new NextResponse(obj.body as unknown as BodyInit, {
      headers: {
        "content-type": obj.httpMetadata?.contentType ?? "audio/webm",
        "cache-control": "private, no-store",
      },
    });
  },
});
