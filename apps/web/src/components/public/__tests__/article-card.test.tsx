import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleCard } from "@/components/public/article-card";
import { resolvePublicArticleTheme } from "@/lib/public-article-theme";
import type { Article } from "@repo/types";

const article: Article & { id: string } = {
  id: "article-1",
  blogId: "default",
  title: "Supportsheep vs 10Web",
  slug: "blogbat-vs-10web",
  body: "<p>Body copy</p>",
  draftBody: "",
  excerpt: "Excerpt",
  summary: "",
  status: "published",
  scheduledAt: null,
  publishedAt: "2026-04-15T00:00:00.000Z",
  postType: "comparison",
  category: "web-builders",
  tags: [],
  author: "Supportsheep",
  featuredImage: { url: "https://example.com/cover.jpg", alt: "Cover" },
  ogImage: "",
  metaTitle: "",
  metaDescription: "",
  keywords: [],
  seoScore: 0,
  internalLinks: [],
  externalLinks: [],
  versions: [],
  generatedBy: "manual",
  generationMeta: null,
  wordCount: 120,
  readingTime: 2,
  createdAt: "2026-04-15T00:00:00.000Z",
  updatedAt: "2026-04-15T00:00:00.000Z",
};

describe("ArticleCard", () => {
  it("renders default cards with tighter radius and no drop shadow", () => {
    const html = renderToStaticMarkup(
      <ArticleCard
        article={article}
        articleTheme={resolvePublicArticleTheme(undefined)}
      />,
    );

    expect(html).toContain("rounded-xl");
    expect(html).not.toContain("shadow-[");
  });

  it("renders elevated cards when the article theme requests shadows", () => {
    const html = renderToStaticMarkup(
      <ArticleCard
        article={article}
        variant="featured"
        articleTheme={resolvePublicArticleTheme({
          cards: {
            borderRadiusPreset: "round",
            borderRadius: "",
            shadowPreset: "elevated",
            hoverStyle: "lift",
          },
          readingLayout: {
            contentWidthPreset: "standard",
            contentWidth: "",
            bodyLineHeightPreset: "balanced",
            bodyLineHeight: "",
            summaryBoxStyle: "outlined",
          },
          tableOfContents: {
            enabled: true,
            stylePreset: "bordered",
          },
          typography: {
            fontPreset: "default",
            headingScalePreset: "balanced",
          },
        })}
      />,
    );

    expect(html).toContain("shadow-[");
  });
});
