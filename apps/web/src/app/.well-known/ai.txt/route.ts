import { NextResponse } from "next/server";
import { resolvePublicSiteUrl } from "@/lib/public-site";

export const revalidate = 3600;

/**
 * Spawning AI preferences signal (https://site.spawning.ai/spaces/ai-txt).
 * Permissive for indexing, citation, grounding, and training. Mirrors the
 * `Content-Signal` semantics used in `/robots.txt`
 * (`ai-train=yes, search=yes, ai-input=yes`).
 */
export async function GET() {
  const siteUrl = resolvePublicSiteUrl();
  const lines = [
    "# Supportsheep AI preferences",
    `# See ${siteUrl}/robots.txt for the per-bot allow/disallow list.`,
    "",
    "User-Agent: *",
    "Allow: /",
    "Allow: /blog",
    "Allow: /api/feed",
    "Allow: /ai/summary.json",
    "Allow: /ai/faq.json",
    "Allow: /ai/service.json",
    "Allow: /llms.txt",
    "Allow: /llms-full.txt",
    "Allow: /llms-articles.txt",
    "Disallow: /api/v1/",
    "Disallow: /blog/search",
    "Disallow: /dashboard/",
    "Disallow: /posts/",
    "Disallow: /settings/",
    "Disallow: /generate/",
    "Disallow: /writing/",
    "Disallow: /seo/",
    "Disallow: /media/",
    "Disallow: /categories/",
    "Disallow: /login/",
    "",
    "Content-Signal: ai-train=yes, search=yes, ai-input=yes",
    "",
    "# Policy summary:",
    "# - Search indexing: allowed",
    "# - Answer / RAG / grounding (ai-input): allowed with attribution",
    "# - Model training (ai-train): allowed",
    `Sitemap: ${siteUrl}/sitemap.xml`,
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
