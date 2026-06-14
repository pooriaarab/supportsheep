import { buildLlmsArticleIndexContent } from "@/lib/llms-txt";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";

export const revalidate = 3600;

export async function GET() {
  const body = await buildLlmsArticleIndexContent(await getRequestBlogId());

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
