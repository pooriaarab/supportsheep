import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SeoTab } from "../seo-tab";
import type { CanvasState } from "@/hooks/use-interview-session";

const emptyCanvas: CanvasState = {
  title: null,
  sections: [],
  meta: { description: null, tags: [], suggestedCategory: null },
};

const draftedCanvas: CanvasState = {
  title: "Shipping faster matters",
  sections: [
    {
      id: "s1",
      heading: "Why velocity wins",
      bullets: ["Tighter loops", "Faster reviews"],
      paragraphs: [
        "Shipping faster means iterating closer to real customer feedback every single sprint cycle now.",
      ],
      quotes: [],
    },
  ],
  meta: { description: null, tags: [], suggestedCategory: null },
};

describe("SeoTab", () => {
  it("shows empty-state copy when canvas has no content", () => {
    const html = renderToStaticMarkup(<SeoTab canvas={emptyCanvas} />);
    expect(html).toContain("Waiting for article content");
    expect(html).toContain("Waiting for keywords");
    // Score block is hidden until an SEO score arrives.
    expect(html).not.toContain('data-testid="seo-score"');
  });

  it("derives meta from canvas body when no canvas-level SEO is set", () => {
    const html = renderToStaticMarkup(<SeoTab canvas={draftedCanvas} />);
    expect(html).toContain("Shipping faster matters");
    // Derived suggested-tags label
    expect(html).toContain("Suggested Tags");
    expect(html).toContain('data-testid="seo-keyword"');
  });

  it("prefers canvas-level metaTitle, metaDescription, keywords when populated", () => {
    const canvas: CanvasState = {
      ...draftedCanvas,
      metaTitle: "Custom meta title from AI",
      metaDescription: "Custom meta description set by the AI assistant.",
      keywords: ["velocity", "feedback", "ship"],
    };
    const html = renderToStaticMarkup(<SeoTab canvas={canvas} />);
    expect(html).toContain("Custom meta title from AI");
    expect(html).toContain("Custom meta description set by the AI assistant.");
    expect(html).toContain("Keywords");
    expect(html).toContain("velocity");
    expect(html).toContain("feedback");
  });

  it("renders the SEO score, issues, and suggestions when present", () => {
    const canvas: CanvasState = {
      ...draftedCanvas,
      seoScore: {
        score: 72,
        issues: ["Meta description too short"],
        suggestions: ["Add an internal link to /pricing"],
        scoredAt: new Date().toISOString(),
      },
    };
    const html = renderToStaticMarkup(<SeoTab canvas={canvas} />);
    expect(html).toContain('data-testid="seo-score"');
    expect(html).toContain("72%");
    expect(html).toContain("Meta description too short");
    expect(html).toContain("Add an internal link to /pricing");
  });

  it("renders internal-link suggestions when present", () => {
    const canvas: CanvasState = {
      ...draftedCanvas,
      internalLinkSuggestions: [
        {
          phrase: "shipping faster",
          targetSlug: "/blog/ship-velocity",
          reason: "Relevant prior article on the same topic.",
        },
      ],
    };
    const html = renderToStaticMarkup(<SeoTab canvas={canvas} />);
    expect(html).toContain('data-testid="seo-internal-link"');
    expect(html).toContain("/blog/ship-velocity");
    expect(html).toContain("shipping faster");
    expect(html).toContain("Relevant prior article on the same topic");
  });
});
