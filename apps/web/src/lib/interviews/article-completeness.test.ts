import { describe, expect, it } from "vitest";
import {
  shouldRegenerateImage,
  extractSeoMeta,
  computeEeatScore,
} from "./article-completeness";

describe("article-completeness", () => {
  describe("shouldRegenerateImage", () => {
    it("returns false if next title is empty", () => {
      expect(shouldRegenerateImage("Old Title", null)).toBe(false);
      expect(shouldRegenerateImage("Old Title", "")).toBe(false);
    });

    it("returns true if prev title is empty and next is set", () => {
      expect(shouldRegenerateImage(null, "New Title")).toBe(true);
      expect(shouldRegenerateImage("", "New Title")).toBe(true);
    });

    it("returns false if titles are similar (word overlap >= 70%)", () => {
      expect(shouldRegenerateImage("The quick brown fox", "The quick brown fox jumps")).toBe(false);
    });

    it("returns true if titles are significantly different (word overlap < 70%)", () => {
      expect(shouldRegenerateImage("The quick brown fox", "Lions hunting in the African Savannah")).toBe(true);
    });
  });

  describe("extractSeoMeta", () => {
    it("extracts meta title, description, and tags from html body", () => {
      const html = `
        <h1>Modern Frontend Best Practices</h1>
        <p>This is a guide to modern frontend development. We discuss React, TypeScript, Tailwind, and frameworks.</p>
        <p>In this guide, frontend development is highly valued. We like frontend and frameworks.</p>
      `;

      const meta = extractSeoMeta(html);

      expect(meta.metaTitle).toBe("Modern Frontend Best Practices");
      expect(meta.metaDescription).toBe(
        "This is a guide to modern frontend development. We discuss React, TypeScript, Tailwind, and frameworks."
      );
      // Suggested tags should exclude <5 letter words, HTML tags, and sort by frequency of remaining words like 'frontend' and 'frameworks'
      expect(meta.suggestedTags).toContain("frontend");
      expect(meta.suggestedTags).toHaveLength(5);
    });

    it("limits meta description length to 155 chars with ellipsis", () => {
      const longPrg = "a".repeat(200);
      const html = `<p>${longPrg}</p>`;
      const meta = extractSeoMeta(html);
      expect(meta.metaDescription).toHaveLength(155);
      expect(meta.metaDescription?.endsWith("...")).toBe(true);
    });
  });

  describe("computeEeatScore", () => {
    it("scores 0% when no EEAT signals are present", () => {
      const result = computeEeatScore("<p>Just plain text with no quotes, links, or numbers.</p>", null);
      expect(result.hasGuestAttribution).toBe(false);
      expect(result.hasQuotes).toBe(false);
      expect(result.hasSourceCitations).toBe(false);
      expect(result.hasMetrics).toBe(false);
      expect(result.score).toBe(0);
    });

    it("scores 100% when all EEAT signals are present", () => {
      const html = `
        <blockquote class="quote">Verbatim quotes are highly valuable for EEAT.</blockquote>
        <p>Our metrics show 95% user satisfaction across 10k customers.</p>
        <p>Read more at <a href="https://authority.org">Authoritative Source</a>.</p>
      `;
      const result = computeEeatScore(html, { name: "John Doe" });
      expect(result.hasGuestAttribution).toBe(true);
      expect(result.hasQuotes).toBe(true);
      expect(result.hasSourceCitations).toBe(true);
      expect(result.hasMetrics).toBe(true);
      expect(result.score).toBe(100);
    });

    it("scores partial percentage when some signals are present", () => {
      // 2 signals: quotes + citations -> 50%
      const html = `
        <blockquote>Quote here</blockquote>
        <p>Refer to <a href="https://example.com">this citation</a>.</p>
      `;
      const result = computeEeatScore(html, null);
      expect(result.score).toBe(50);
    });
  });
});
