import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { getShareLinkByTokenHash } from "@/lib/interviews/share-links-repository";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";
import { generateInterviewIcs } from "@/lib/interviews/ics";

/**
 * GET /api/v1/interviews/share-links/by-token/[token]/calendar
 * Generates and downloads an RFC 5545 ICS calendar file for a scheduled interview.
 * Gated by active status, expiration date, maximum uses, and scheduled state.
 */
export const GET = createApiHandler<unknown, { token: string }>({
  auth: "none",
  handler: async ({ request, params }) => {
    const token = params?.token;
    if (!token || token.length < 32) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const hash = hashShareLinkToken(token);
    const doc = await getShareLinkByTokenHash(hash);

    if (!doc) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Standard lifecycle gates
    if (doc.status !== "active") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (doc.maxUses !== null && doc.uses >= doc.maxUses) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Only if scheduled
    if (!doc.scheduledAt) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const icsText = generateInterviewIcs({
      token,
      topic: doc.topic,
      scheduledAt: doc.scheduledAt,
      durationSec: doc.maxDurationSec,
      baseUrl: request.nextUrl.origin,
    });

    return new NextResponse(icsText, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="interview-${token}.ics"`,
      },
    });
  },
});
