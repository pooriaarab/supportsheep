import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { renderMarkdownForPath } from "@/lib/markdown-for-agents";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";

const CACHE_CONTROL = "public, max-age=300, s-maxage=300";

/**
 * Internal rewrite target for markdown negotiation.
 *
 * This stays outside `/api/v1` because browsers and agents do not call it as
 * part of the public blog data API; middleware rewrites public page requests
 * here only when clients explicitly negotiate `text/markdown`.
 */
export const GET = createApiHandler({
  auth: "none",
  handler: async ({ request }) => {
    const pathname =
      request.headers.get("x-markdown-pathname") ??
      request.nextUrl.searchParams.get("pathname") ??
      "/";
    const response = await renderMarkdownForPath(
      pathname,
      request.nextUrl.searchParams,
      await getRequestBlogId(),
    );

    const tokenCount = response.markdown
      .split(/\s+/)
      .filter((segment) => segment.length > 0).length;

    return new NextResponse(response.markdown, {
      status: response.status,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        Vary: "Accept",
        "Cache-Control": response.status === 200 ? CACHE_CONTROL : "no-store",
        "x-markdown-tokens": String(tokenCount),
      },
    });
  },
});
