/**
 * Suggest Internal Links API
 *
 * POST /api/v1/seo/suggest-links
 * Uses AI to find phrases in content that should link to sitemap URLs.
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { getSitemap, listSitemapsForBlog } from "@/lib/seo/sitemaps-repository";
import { suggestLinksSchema } from "@/lib/schemas";
import { generateContent } from "@/lib/ai/generate";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:seo:suggest-links");

interface LinkSuggestion {
  phrase: string;
  url: string;
  reason: string;
}

export const POST = createApiHandler({
  auth: "user",
  input: suggestLinksSchema,
  handler: async ({ body, blogId }) => {
    // Gather sitemap URLs
    let sitemapUrls: string[] = [];

    if (body.sitemapId) {
      const entry = await getSitemap(blogId, body.sitemapId);
      if (entry) {
        sitemapUrls = entry.urls;
      }
    } else {
      const entries = await listSitemapsForBlog(blogId, 5);
      sitemapUrls = entries.flatMap((e) => e.urls);
    }

    if (sitemapUrls.length === 0) {
      return NextResponse.json({ data: { suggestions: [] } });
    }

    // Use AI to find link opportunities
    const urlList = sitemapUrls.slice(0, 50).join("\n");
    const rawResult = await generateContent({
      provider: "claude",
      systemPrompt: `You are an SEO internal linking expert. Given article content and a list of site URLs, find exact phrases in the content that should link to one of the provided URLs.

Rules:
- Only suggest phrases that EXACTLY appear in the content (case-insensitive match is fine)
- Each URL should be suggested at most once
- Prefer linking naturally relevant phrases, not forced keyword stuffing
- Return valid JSON array only, no explanation

Return format:
[{"phrase": "exact text from content", "url": "https://...", "reason": "brief reason"}]

If no good links found, return: []`,
      userPrompt: `Content:\n${body.content.slice(0, 8000)}\n\nAvailable URLs:\n${urlList}`,
      temperature: 0.2,
    });

    // Parse AI response
    let suggestions: LinkSuggestion[] = [];
    try {
      const parsed = JSON.parse(rawResult.trim()) as LinkSuggestion[];
      if (Array.isArray(parsed)) {
        // Validate each suggestion
        suggestions = parsed.filter(
          (s) =>
            typeof s.phrase === "string" &&
            typeof s.url === "string" &&
            body.content.toLowerCase().includes(s.phrase.toLowerCase()) &&
            sitemapUrls.includes(s.url),
        );
      }
    } catch {
      log.error("Failed to parse AI link suggestions", { rawResult });
    }

    return NextResponse.json({ data: { suggestions } });
  },
});
