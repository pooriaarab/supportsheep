import { describe, it, expect } from "vitest";
import {
  THIN_CONTENT_WORD_THRESHOLD,
  countWords,
  robotsForPage,
  shouldIndex,
} from "@/lib/seo/indexability";

function words(count: number): string {
  return Array.from({ length: count }, (_, i) => `word${i}`).join(" ");
}

describe("countWords", () => {
  it("returns 0 for empty content", () => {
    expect(countWords("")).toBe(0);
  });

  it("strips HTML tags before counting", () => {
    expect(countWords("<p>one two three</p>")).toBe(3);
  });

  it("strips common markdown punctuation", () => {
    // "Heading", "bold", "italic", "link", "x" -- punctuation is removed,
    // but the contents of markdown-link parens remain as words.
    expect(countWords("# Heading\n\n**bold** _italic_ [link](x)")).toBe(5);
  });

  it("collapses whitespace", () => {
    expect(countWords("one   two\n\nthree\t\tfour")).toBe(4);
  });
});

describe("shouldIndex", () => {
  it("blocks draft pages regardless of length", () => {
    expect(
      shouldIndex({
        publishStatus: "draft",
        wordCount: THIN_CONTENT_WORD_THRESHOLD + 100,
      }),
    ).toBe(false);
  });

  it("blocks pages explicitly marked noindex", () => {
    expect(
      shouldIndex({
        publishStatus: "noindex",
        wordCount: THIN_CONTENT_WORD_THRESHOLD + 100,
      }),
    ).toBe(false);
  });

  it("blocks published pages below the thin-content threshold", () => {
    expect(
      shouldIndex({
        publishStatus: "published",
        wordCount: THIN_CONTENT_WORD_THRESHOLD - 1,
      }),
    ).toBe(false);
  });

  it("indexes published pages exactly at the threshold", () => {
    expect(
      shouldIndex({
        publishStatus: "published",
        wordCount: THIN_CONTENT_WORD_THRESHOLD,
      }),
    ).toBe(true);
  });

  it("indexes published pages above the threshold", () => {
    expect(
      shouldIndex({
        publishStatus: "published",
        wordCount: THIN_CONTENT_WORD_THRESHOLD + 500,
      }),
    ).toBe(true);
  });

  it("falls back to counting uniqueContent when wordCount is zero", () => {
    expect(
      shouldIndex({
        publishStatus: "published",
        wordCount: 0,
        uniqueContent: words(THIN_CONTENT_WORD_THRESHOLD + 10),
      }),
    ).toBe(true);
  });

  it("falls back to counting uniqueContent when wordCount missing", () => {
    expect(
      shouldIndex({
        publishStatus: "published",
        wordCount: 0,
        uniqueContent: words(THIN_CONTENT_WORD_THRESHOLD - 10),
      }),
    ).toBe(false);
  });
});

describe("robotsForPage", () => {
  it("returns index:true, follow:true for indexable pages", () => {
    expect(
      robotsForPage({
        publishStatus: "published",
        wordCount: 500,
      }),
    ).toEqual({ index: true, follow: true });
  });

  it("returns index:false, follow:true for thin-content pages", () => {
    expect(
      robotsForPage({
        publishStatus: "published",
        wordCount: 100,
      }),
    ).toEqual({ index: false, follow: true });
  });

  it("returns index:false, follow:true for noindex pages", () => {
    expect(
      robotsForPage({
        publishStatus: "noindex",
        wordCount: 1000,
      }),
    ).toEqual({ index: false, follow: true });
  });
});
