import { NextResponse } from "next/server";
import { buildLlmsTxtIndex } from "@/lib/llms-txt";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

/**
 * Spec-compliant llms.txt index per https://llmstxt.org.
 * A short site overview plus a curated link list -- NOT the full dump.
 * The full-text dump lives at /llms-full.txt.
 */
export async function GET() {
  return new NextResponse(await buildLlmsTxtIndex(await getRequestBlogId()), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
