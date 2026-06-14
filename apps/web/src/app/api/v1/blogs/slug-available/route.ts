/**
 * Slug availability check for live UI validation.
 *
 * GET /api/v1/blogs/slug-available?slug=foo
 *   -> { available: boolean, reason?: "invalid_format" | "reserved" | "taken" }
 */

import { NextResponse } from "next/server";

import { createApiHandler } from "@/lib/create-api-handler";
import { slugAvailable, validateSlug } from "@/lib/tenancy/blogs";

export const GET = createApiHandler({
  auth: "session",
  handler: async ({ request }) => {
    const slug = new URL(request.url).searchParams.get("slug") ?? "";

    const validation = validateSlug(slug);
    if (!validation.ok) {
      return NextResponse.json({
        available: false,
        reason: validation.reason,
      });
    }

    if (!(await slugAvailable(slug))) {
      return NextResponse.json({ available: false, reason: "taken" });
    }

    return NextResponse.json({ available: true });
  },
});
