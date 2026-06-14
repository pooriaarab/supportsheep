import { NextResponse } from "next/server";
import { buildArticleMarkdownExport } from "@/lib/article-export";
import { isReservedRootSlug } from "@/lib/permalinks";
import { resolvePublicSiteUrl } from "@/lib/public-site";
import { getPublicArticleBySlug } from "@/lib/public-route-resolution";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";

export const revalidate = 300;
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function GET(_: Request, { params }: Props) {
  const { slug } = await params;

  if (isReservedRootSlug(slug)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const article = await getPublicArticleBySlug(slug, await getRequestBlogId());
  if (!article) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(
    buildArticleMarkdownExport(article, resolvePublicSiteUrl()),
    {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
