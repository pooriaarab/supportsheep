import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";
import { getInterview } from "@/lib/interviews/interviews-repository";
import { getShareLink } from "@/lib/interviews/share-links-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

// Binds the caller to the interview via the share-link token they presented.
// Guest flows must present the same plaintext token used to create the interview.
// Self flows (started from the dashboard with a session cookie) are not served
// here — they fetch interview state via authenticated endpoints.
export const GET = createApiHandler({
  auth: "none",
  handler: async ({ params, request }) => {
    const { id } = (await params) as { id: string };
    const url = new URL(request.url);
    const shareLinkToken = url.searchParams.get("shareLinkToken");

    if (!shareLinkToken) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const interview = await getInterview(DEFAULT_BLOG_ID, id);
    if (!interview) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (!interview.shareLinkId) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const tokenHash = hashShareLinkToken(shareLinkToken);
    const shareLink = await getShareLink(DEFAULT_BLOG_ID, interview.shareLinkId);
    if (!shareLink) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (shareLink.tokenHash !== tokenHash) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({
      id,
      status: interview.status,
      recordingConfig: interview.recordingConfig,
      maxDurationSec: interview.maxDurationSec,
      topic: interview.topic || null,
    });
  },
});
