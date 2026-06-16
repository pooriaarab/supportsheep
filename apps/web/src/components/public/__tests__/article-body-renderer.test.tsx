import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleBodyRenderer } from "@/components/public/article-body-renderer";

describe("ArticleBodyRenderer", () => {
  it("renders the prose container with semantic prose classes", () => {
    const html = renderToStaticMarkup(
      <ArticleBodyRenderer
        articleId="test-article"
        htmlBody="<p>Hello</p>"
      />,
    );
    // Prose styling is applied by the default public-article theme, so the
    // exact class string varies — but Tailwind Typography always starts with
    // `prose`. Asserting on that prefix keeps the test stable across theme
    // changes while still proving the shared renderer wires up its theme.
    expect(html).toMatch(/class="[^"]*\bprose\b/);
    expect(html).toContain("<p>Hello</p>");
  });

  it("opts into dark:prose-invert so dark hosts keep body text legible", () => {
    // The shared renderer is used by both the published article page and the
    // in-call interview canvas. The canvas surface inherits next-themes'
    // `.dark` class when the host system prefers dark, so the prose body
    // palette must invert; otherwise body text collapses to the prose default
    // gray-700 against the dark surface (the W19a contrast bug).
    const html = renderToStaticMarkup(
      <ArticleBodyRenderer articleId="test-article" htmlBody="<p>Hi</p>" />,
    );
    expect(html).toMatch(/dark:prose-invert/);
  });

  it("injects heading anchor ids so the ToC sibling can deep-link", () => {
    const html = renderToStaticMarkup(
      <ArticleBodyRenderer
        articleId="test-article"
        htmlBody="<h2>First Section</h2><h3>Sub Point</h3>"
      />,
    );
    expect(html).toContain('<h2 id="first-section">First Section</h2>');
    expect(html).toContain('<h3 id="sub-point">Sub Point</h3>');
  });

  it("renders nothing when given an empty body", () => {
    const html = renderToStaticMarkup(
      <ArticleBodyRenderer articleId="test-article" htmlBody="" />,
    );
    // The container still exists (so the slot stays in place), but it has
    // no rendered body content.
    expect(html).toContain('<div');
    expect(html).not.toContain("<p>");
  });

  it("renders the full interview-canvas body the saveDraft helper produces", async () => {
    // End-to-end fidelity check: the body shape the user lands on for
    // /review's COMPILED DRAFT PREVIEW (and ultimately /[postId] once
    // the article is published) MUST surface every block the canvas
    // built — heading, paragraph, list, callout, code, table, image.
    // The previous /review bug surfaced as "title only, no body" because
    // the saved body was just `<h1>Title</h1>`; this test pins the
    // renderer's contract against a representative full-canvas body.
    const { sanitizeArticleHtml } = await import(
      "@/lib/sanitize/article-html"
    );
    const body = sanitizeArticleHtml(
      [
        "<h1>What Is Supportsheep Pro?</h1>",
        '<p class="article-subtitle">A short guide.</p>',
        '<figure><img src="https://images.example.com/hero.jpg" alt="Hero" /></figure>',
        "<h2>Definition and core idea</h2>",
        "<p>Supportsheep Pro is the practice of compounding small wins.</p>",
        "<ol><li>Pick one tiny goal</li><li>Ship it before noon</li></ol>",
        '<aside class="callout" data-variant="info"><p>Velocity compounds.</p></aside>',
      ].join("\n"),
    );
    const html = renderToStaticMarkup(
      <ArticleBodyRenderer articleId="test-article" htmlBody={body} />,
    );
    expect(html).toContain("What Is Supportsheep Pro?");
    expect(html).toContain("A short guide.");
    expect(html).toContain("https://images.example.com/hero.jpg");
    expect(html).toContain("Definition and core idea");
    expect(html).toContain("Supportsheep Pro is the practice of compounding small wins.");
    expect(html).toContain("Pick one tiny goal");
    expect(html).toContain("Velocity compounds.");
    expect(html).toMatch(/data-variant="info"/);
  });
});
