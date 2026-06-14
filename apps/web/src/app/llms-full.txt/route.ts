import { NextResponse } from "next/server";
import { buildLlmsFullTxtContent } from "@/lib/llms-txt";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

/**
 * Full-text dump of every published article for LLM consumption.
 * Companion to the spec-compliant `/llms.txt` index.
 */
export async function GET() {
  return new NextResponse(
    await buildLlmsFullTxtContent(await getRequestBlogId()),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    },
  );
}
