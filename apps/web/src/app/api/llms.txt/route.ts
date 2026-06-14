/**
 * llms.txt endpoint (legacy path)
 *
 * GET /api/llms.txt
 * Serves the spec-compliant llms.txt index (per https://llmstxt.org).
 * The canonical path is `/llms.txt`; this path is retained for backwards
 * compatibility. The full-body dump lives at `/llms-full.txt`.
 */

import { NextResponse } from "next/server";
import { buildLlmsTxtIndex } from "@/lib/llms-txt";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

export async function GET() {
  return new NextResponse(await buildLlmsTxtIndex(await getRequestBlogId()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
