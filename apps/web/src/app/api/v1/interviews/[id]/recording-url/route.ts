import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  buildRecordingFileUrl,
  parseRecordingParams,
  resolveRecordingAccess,
} from "@/lib/interviews/recording-access";

/**
 * GET /api/v1/interviews/[id]/recording-url
 *
 * Returns a same-origin streaming URL for playing back interview audio (either
 * a pre-recorded question on the parent share-link, or a guest response stored
 * under the interview itself). The bytes are served by the authed
 * `recording-file` route — we no longer mint GCS signed URLs.
 *
 * Query params:
 *   - kind=question — playback a share-link question audio. Allowed for the
 *     guest (interview token) and workspace members.
 *   - kind=response — playback a guest response audio. Allowed only for
 *     workspace members (owner / admin / editor) — never guests.
 *   - questionId=<id> — required, identifies the audio object.
 *
 * Auth: either an interview bearer token / cookie (guest) or a session cookie
 * (workspace member). Both kinds of access control are enforced by
 * `resolveRecordingAccess`, shared with the `recording-file` route.
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

    return NextResponse.json({
      url: buildRecordingFileUrl(interviewId, parsed.kind, parsed.questionId),
    });
  },
});
