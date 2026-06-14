import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { getMediaBucket } from "@/lib/media/bucket";
import {
  parseShareLinkQuestionId,
  resolveShareLinkRecordingAccess,
} from "@/lib/interviews/share-link-recording-access";
import type { UserRole } from "@repo/types";

/**
 * GET /api/v1/interviews/share-links/[id]/recording-file?questionId=<id>
 *
 * Streams a pre-recorded share-link question audio directly from R2 through
 * this authed Worker route — replaces the GCS signed-URL flow. Access control
 * is identical to the share-link `recording-url` route (both call
 * `resolveShareLinkRecordingAccess`): workspace minters (owner/admin/editor).
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
