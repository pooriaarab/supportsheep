/**
 * MCP SEO Tools
 *
 * Tools for analyzing SEO scores and suggesting internal links.
 */

import { z } from "zod/v3";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  getArticleBySlug as repoGetArticleBySlug,
  listArticles,
} from "@/lib/articles/repository";
import type { McpToolContext } from "./context";

function textResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Simple SEO scoring based on content analysis */
function analyzeSeo(article: Record<string, unknown>): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  const title = String(article.title || "");
  const body = String(article.body || article.draftBody || "");
  const metaTitle = String(article.metaTitle || "");
  const metaDescription = String(article.metaDescription || "");
  const keywords = Array.isArray(article.keywords) ? article.keywords : [];
  const wordCount = body.split(/\s+/).filter(Boolean).length;

  // Title checks
  if (!title) {
    issues.push("Missing title");
    score -= 20;
  } else if (title.length > 60) {
    suggestions.push(
      "Title is over 60 characters, consider shortening for search results",
    );
    score -= 5;
  }

  // Meta description
  if (!metaDescription) {
    issues.push("Missing meta description");
    score -= 15;
  } else if (metaDescription.length < 120) {
    suggestions.push("Meta description is short, aim for 120-160 characters");
    score -= 5;
  }

  // Meta title
  if (!metaTitle) {
    suggestions.push("No custom meta title set, will use article title");
    score -= 5;
  }

  // Word count
  if (wordCount < 300) {
    issues.push(`Content is only ${wordCount} words, aim for at least 300`);
    score -= 15;
  } else if (wordCount < 800) {
    suggestions.push(
      `Content is ${wordCount} words, longer content (1000+) tends to rank better`,
    );
    score -= 5;
  }

  // Keywords
  if (keywords.length === 0) {
    issues.push("No keywords defined");
    score -= 10;
  } else {
    const bodyLower = body.toLowerCase();
    const lowDensityKeywords = keywords.filter((kw: string) => {
      const count = (bodyLower.match(new RegExp(kw.toLowerCase(), "g")) || [])
        .length;
      const density = wordCount > 0 ? (count / wordCount) * 100 : 0;
      return density < 0.8;
    });
    if (lowDensityKeywords.length > 0) {
      suggestions.push(
        `Low keyword density for: ${lowDensityKeywords.join(", ")}`,
      );
      score -= 5;
    }
  }

  // Internal links
  const internalLinks = Array.isArray(article.internalLinks)
    ? article.internalLinks
    : [];
  if (internalLinks.length === 0 && wordCount > 300) {
    suggestions.push("No internal links found, consider adding some");
    score -= 5;
  }

  return { score: Math.max(0, score), issues, suggestions };
}

export function registerSeoTools(
  server: McpServer,
  { blogId }: McpToolContext,
) {
  server.tool(
    "get_seo_score",
    "Analyze SEO score for an article by slug",
    { slug: z.string().describe("Article slug to analyze") },
    async ({ slug }) => {
      const article = await repoGetArticleBySlug(blogId, slug);

      if (!article) {
        return textResult({ error: "Article not found" });
      }

      const analysis = analyzeSeo(article as unknown as Record<string, unknown>);

      return textResult({
        slug,
        title: article.title,
        seoScore: analysis.score,
        issues: analysis.issues,
        suggestions: analysis.suggestions,
      });
    },
  );

  server.tool(
    "suggest_internal_links",
    "Suggest internal links for an article based on sitemap URLs",
    {
      slug: z.string().describe("Article slug to find link opportunities for"),
    },
    async ({ slug }) => {
      const article = await repoGetArticleBySlug(blogId, slug);

      if (!article) {
        return textResult({ error: "Article not found" });
      }

      const body = String(article.body || article.draftBody || "");

      // Get other published articles as link targets
      const { articles: published } = await listArticles(blogId, {
        status: "published",
        limit: 50,
      });

      const suggestions = published.flatMap((a) => {
        if (a.slug === slug) return [];
        const title = String(a.title || "");
        if (!body.toLowerCase().includes(title.toLowerCase().slice(0, 20))) {
          return [];
        }
        return [
          {
            phrase: title,
            targetSlug: a.slug,
            reason: "Title phrase appears in article body",
          },
        ];
      });

      return textResult({ articleSlug: slug, suggestions });
    },
  );
}
