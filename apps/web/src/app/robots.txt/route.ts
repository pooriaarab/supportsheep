import { NextResponse } from "next/server";
import { resolvePublicSiteUrl } from "@/lib/public-site";

export const revalidate = 3600;

/**
 * Public paths that any well-behaved crawler -- traditional search or AI --
 * is welcome to visit. Kept as Allow lines so we can layer explicit
 * Disallows below without losing the default "everything else is fine" rule.
 */
const ALLOW_PATHS = [
  "/",
  "/blog",
  "/guest-post",
  "/tools",
  "/api/feed",
  "/ai/summary.json",
  "/ai/faq.json",
  "/ai/service.json",
  "/llms.txt",
  "/llms-full.txt",
  "/llms-articles.txt",
];

/**
 * Admin, editor, and API surfaces we never want indexed or ingested. Mirrors
 * the structure of the Next.js route tree under `(dashboard)` plus internal
 * REST endpoints.
 */
const DISALLOW_PATHS = [
  "/api/v1/",
  "/blog/search",
  "/dashboard/",
  "/posts/",
  "/settings/",
  "/generate/",
  "/writing/",
  "/seo/",
  "/media/",
  "/categories/",
  "/login",
  "/wp-admin/",
  "/wp-content/",
  "/wp-includes/",
  "/wp-json/",
];

/**
 * Search, answer, and training agents we explicitly welcome for discovery,
 * citations, grounding, and model training. Most would be permitted by the
 * wildcard stanza anyway; listing them keeps the policy legible and future
 * diffs obvious when operators add or rename bots.
 */
const ALLOWED_AI_AGENTS = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "Applebot-Extended",
  "Google-Extended",
  "Bytespider",
  "CCBot",
  "DuckAssistBot",
  "Amazonbot",
  "AI2Bot",
  "AI2Bot-Dolma",
  "cohere-ai",
  "FacebookBot",
  "facebookexternalhit",
  "meta-externalfetcher",
  "Meta-ExternalFetcher",
  "MistralAI-User",
  "PetalBot",
  "YouBot",
  "xAI-Bot",
];

function buildStanza(userAgent: string): string[] {
  const lines = [`User-Agent: ${userAgent}`];
  for (const path of ALLOW_PATHS) {
    lines.push(`Allow: ${path}`);
  }
  for (const path of DISALLOW_PATHS) {
    lines.push(`Disallow: ${path}`);
  }
  return lines;
}

export async function GET() {
  const siteUrl = resolvePublicSiteUrl();
  const stanzas: string[][] = [
    buildStanza("*"),
    ...ALLOWED_AI_AGENTS.map((ua) => buildStanza(ua)),
  ];

  const body = [
    ...stanzas.flatMap((stanza, idx) =>
      idx === stanzas.length - 1 ? stanza : [...stanza, ""],
    ),
    "",
    "Content-Signal: ai-train=yes, search=yes, ai-input=yes",
    `Sitemap: ${siteUrl}/sitemap.xml`,
  ].join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
