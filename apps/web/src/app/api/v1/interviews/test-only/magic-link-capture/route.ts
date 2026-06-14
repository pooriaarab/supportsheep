/**
 * Test-only endpoint that returns the most recently issued magic-link URL for
 * a given email address. Used by the Playwright e2e suite to follow the link
 * without an outbound email service.
 *
 * Enabled only when both `NODE_ENV !== "production"` and the
 * `INTERVIEW_MAGIC_LINK_TEST_CAPTURE` env var is set to "true". Returns 404
 * otherwise.
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  getLatestMagicLinkUrlFor,
  isMagicLinkTestCaptureEnabled,
} from "@/lib/interviews/magic-link-test-capture";

export const GET = createApiHandler({
  auth: "none",
  handler: async ({ request }) => {
    if (!isMagicLinkTestCaptureEnabled()) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const email = url.searchParams.get("email");
    if (!email) {
      return NextResponse.json({ error: "email_required" }, { status: 400 });
    }

    const captured = getLatestMagicLinkUrlFor(email);
    if (!captured) {
      return NextResponse.json({ error: "no_capture" }, { status: 404 });
    }

    return NextResponse.json(captured);
  },
});
