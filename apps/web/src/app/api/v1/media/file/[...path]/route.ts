/**
 * Public Media Serve
 *
 * GET /api/v1/media/file/[...path] -- Stream public media bytes from the R2
 * MEDIA bucket. Blog images must render on the public site, so this route is
 * unauthenticated.
 *
 * SECURITY: the MEDIA bucket also holds PRIVATE objects (e.g. interview
 * recordings). This public route is prefix-locked to the `media/` namespace and
 * rejects anything else with 404, so private prefixes can never be served here.
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { getMediaBucket } from "@/lib/media/bucket";

export const GET = createApiHandler<unknown, { path: string[] }>({
  auth: "none",
  handler: async ({ params }) => {
    const key = params.path.join("/");

    // Prefix-lock: only public media may be served through this route.
    if (!key.startsWith("media/")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Reject path traversal: no `..` segment may appear in the key.
    if (params.path.some((segment) => segment === "..") || key.includes("../")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const obj = await getMediaBucket().get(key);
    if (!obj) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return new NextResponse(obj.body, {
      status: 200,
      headers: {
        "content-type":
          obj.httpMetadata?.contentType ?? "application/octet-stream",
        "content-length": String(obj.size),
        "cache-control": "public, max-age=31536000, immutable",
        "content-security-policy":
          "default-src 'none'; style-src 'unsafe-inline'",
        "x-content-type-options": "nosniff",
      },
    });
  },
});
