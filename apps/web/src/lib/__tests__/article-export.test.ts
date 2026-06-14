import { describe, expect, it } from "vitest";
import type { Article } from "@repo/types";
import {
  buildArticleLlmsTextExport,
  buildArticleMarkdownExport,
} from "@/lib/article-export";

const article: Article & { id: string } = {
  id: "article-1",
  blogId: "default",
  title: "Ideas for Personal Websites",
  slug: "ideas-for-personal-websites",
  canonicalPath: "/ideas-for-personal-websites",
  body: `
    <h2>Why build one?</h2>
    <p>Use your site to show <strong>credibility</strong> and link to <a href="https://blogbat.com">BlogBat</a>.</p>
    <ul>
      <li>Publish work</li>
      <li>Answer common questions</li>
    </ul>
  `,
  draftBody: "",
  excerpt: "A practical guide to planning a personal site.",
  status: "published",
  scheduledAt: null,
  publishedAt: "2026-04-15T00:00:00.000Z",
  postType: "how_to",
  category: "Guides",
  tags: ["seo", "personal branding"],
  author: "BlogBat",
  featuredImage: { url: "", alt: "" },
  ogImage: "",
  metaTitle: "",
  metaDescription: "Learn how to plan a personal website that ranks and converts.",
  keywords: ["personal website", "seo"],
  seoScore: 0,
  internalLinks: [],
  externalLinks: [],
  versions: [],
  generatedBy: "manual",
  generationMeta: null,
  wordCount: 450,
  readingTime: 2,
  createdAt: "2026-04-15T00:00:00.000Z",
  updatedAt: "2026-04-16T00:00:00.000Z",
};

describe("buildArticleMarkdownExport", () => {
  it("renders markdown-friendly article output from published HTML content", () => {
    const content = buildArticleMarkdownExport(article, "https://blogbat.com");

    expect(content).toContain("# Ideas for Personal Websites");
    expect(content).toContain(
      "Source: https://blogbat.com/ideas-for-personal-websites",
    );
    expect(content).toContain("## Why build one?");
    expect(content).toContain(
      "Use your site to show credibility and link to [BlogBat](https://blogbat.com).",
    );
    expect(content).toContain("- Publish work");
    expect(content).not.toContain("<h2>");
  });
});

describe("buildArticleLlmsTextExport", () => {
  it("renders a plain-text llms export from the same article content", () => {
    const content = buildArticleLlmsTextExport(article, "https://blogbat.com");

    expect(content).toContain("# Ideas for Personal Websites");
    expect(content).toContain("Title: Ideas for Personal Websites");
    expect(content).toContain(
      "URL: https://blogbat.com/ideas-for-personal-websites",
    );
    expect(content).toContain("Category: Guides");
    expect(content).toContain("Tags: seo, personal branding");
    expect(content).toContain(
      "Use your site to show credibility and link to BlogBat.",
    );
    expect(content).not.toContain("<strong>");
    expect(content).not.toContain("[BlogBat](");
  });

  it("normalizes sparse author and malformed tags", () => {
    const malformedArticle = {
      ...article,
      author: "blogblogbatai",
      tags: "seo" as unknown as string[],
    };

    const content = buildArticleLlmsTextExport(
      malformedArticle,
      "https://blogbat.com",
    );

    expect(content).toContain("Author: BlogBat");
    expect(content).not.toContain("Tags:");
  });

  it("renders Firestore timestamp-like dates as ISO strings", () => {
    const firestoreDatedArticle = {
      ...article,
      publishedAt: {
        toDate: () => new Date("2026-04-15T00:00:00.000Z"),
      },
      updatedAt: {
        _seconds: 1776211200,
      },
    } as unknown as Article & { id: string };

    const content = buildArticleLlmsTextExport(
      firestoreDatedArticle,
      "https://blogbat.com",
    );

    expect(content).toContain("Published: 2026-04-15T00:00:00.000Z");
    expect(content).toContain("Updated: 2026-04-15T00:00:00.000Z");
    expect(content).not.toContain("[object Object]");
  });
});
