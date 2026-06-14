import { describe, expect, it } from "vitest";
import { slugifyHeading, transformArticleBody } from "@/lib/article-body";

describe("slugifyHeading", () => {
  it("produces stable kebab-case slugs", () => {
    expect(slugifyHeading("Getting Started with BlogBat")).toBe(
      "getting-started-with-blogbat",
    );
  });

  it("strips punctuation and normalizes diacritics", () => {
    expect(slugifyHeading("Déjà vu: it's working!")).toBe("deja-vu-its-working");
  });

  it("collapses whitespace and trims dashes", () => {
    expect(slugifyHeading("  Hello   world  ")).toBe("hello-world");
  });
});

describe("transformArticleBody", () => {
  it("returns empty result for empty input", () => {
    expect(transformArticleBody("")).toEqual({ html: "", headings: [] });
  });

  it("injects ids on h2, h3, and h4 headings and collects them in order", () => {
    const body = `
      <h2>First Section</h2>
      <p>Intro</p>
      <h3>Sub point</h3>
      <h4>Deeper note</h4>
      <h2>Second Section</h2>
    `;

    const { html, headings } = transformArticleBody(body);

    expect(html).toContain('<h2 id="first-section">First Section</h2>');
    expect(html).toContain('<h3 id="sub-point">Sub point</h3>');
    expect(html).toContain('<h4 id="deeper-note">Deeper note</h4>');
    expect(html).toContain('<h2 id="second-section">Second Section</h2>');

    expect(headings).toEqual([
      { id: "first-section", text: "First Section", level: 2 },
      { id: "sub-point", text: "Sub point", level: 3 },
      { id: "deeper-note", text: "Deeper note", level: 4 },
      { id: "second-section", text: "Second Section", level: 2 },
    ]);
  });

  it("disambiguates colliding slugs with numeric suffixes", () => {
    const body = "<h2>Overview</h2><h2>Overview</h2><h2>Overview</h2>";
    const { html, headings } = transformArticleBody(body);

    expect(html).toContain('id="overview"');
    expect(html).toContain('id="overview-2"');
    expect(html).toContain('id="overview-3"');
    expect(headings.map((h) => h.id)).toEqual([
      "overview",
      "overview-2",
      "overview-3",
    ]);
  });

  it("preserves pre-existing ids and still tracks them", () => {
    const body = '<h2 id="custom">Custom Anchor</h2>';
    const { html, headings } = transformArticleBody(body);

    expect(html).toContain('id="custom"');
    expect(headings).toEqual([
      { id: "custom", text: "Custom Anchor", level: 2 },
    ]);
  });

  it("uses text content from nested elements inside a heading", () => {
    const body = "<h2>Read <strong>the manual</strong></h2>";
    const { html, headings } = transformArticleBody(body);

    expect(html).toContain('id="read-the-manual"');
    expect(headings[0]).toEqual({
      id: "read-the-manual",
      text: "Read the manual",
      level: 2,
    });
  });

  it("skips headings that are empty after trimming", () => {
    const body = "<h2>   </h2><h2>Real heading</h2>";
    const { headings } = transformArticleBody(body);

    expect(headings).toEqual([
      { id: "real-heading", text: "Real heading", level: 2 },
    ]);
  });

  it("leaves non-heading elements untouched", () => {
    const body = "<p>Just a paragraph</p>";
    const { html, headings } = transformArticleBody(body);

    expect(html).toContain("<p>Just a paragraph</p>");
    expect(headings).toEqual([]);
  });
});
