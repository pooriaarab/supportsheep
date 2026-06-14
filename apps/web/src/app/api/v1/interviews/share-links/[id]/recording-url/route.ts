import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  buildShareLinkRecordingFileUrl,
  parseShareLinkQuestionId,
  resolveShareLinkRecordingAccess,
} from "@/lib/interviews/share-link-recording-access";
import type { UserRole } from "@repo/types";

/**
 * GET /api/v1/interviews/share-links/[id]/recording-url?questionId=<id>
 *
 * Returns a same-origin streaming URL for playing back a pre-recorded question
 * audio attached to the given share-link. Used by the workspace dashboard
 * (owner/admin/editor) when reviewing the questions configured on a link. The
 * bytes are served by the authed `recording-file` route — no signed URLs.
 */
export const GET = createApiHandler<unknown, { id: string }>({
  auth: "user",
  handler: async ({ request, params, role: ctxRole }) => {
    const shareLinkId = params?.id;
    if (!shareLinkId) {
      return NextResponse.json({ error: "share_link_not_found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const parsed = parseShareLinkQuestionId(url.searchParams.get("questionId"));
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }

    const role = (ctxRole ?? "guest") as UserRole;
    const access = await resolveShareLinkRecordingAccess(
      role,
      shareLinkId,
      parsed.questionId,
    );
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    return NextResponse.json({
      url: buildShareLinkRecordingFileUrl(shareLinkId, parsed.questionId),
    });
  },
});
