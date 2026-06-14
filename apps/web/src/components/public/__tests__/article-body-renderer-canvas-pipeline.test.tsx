import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleBodyRenderer } from "@/components/public/article-body-renderer";
import {
  renderCanvasToHtml,
  renderInlineMarks,
} from "@/lib/interviews/save-draft";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";
import type { CanvasState } from "@/hooks/use-interview-session";

/**
 * W25j pipeline pin: the COMPILED DRAFT PREVIEW on /review (and the
 * public /[postId] route) MUST surface every node type the canvas can
 * accumulate during an interview. Pre-fix:
 *
 *  - `renderCanvasToHtml` ran `escapeHtml` on paragraphs/bullets/quotes/
 *    list items/callout bodies/headings, so every inline mark stored as
 *    a markdown-style escape (`**bold**`, `*italic*`, `[text](url)`,
 *    `~~strike~~`, `` `code` ``, `<u>...</u>`, `<mark>...</mark>`)
 *    survived as literal text instead of becoming the matching HTML tag.
 *  - That meant the user watched the AI build a bold sentence with a
 *    link on the live in-call canvas, hit "End interview", landed on
 *    /review, and saw the same sentence rendered as `**foo** [bar](baz)`.
 *
 * This test pins the contract end-to-end: canvas -> renderCanvasToHtml
 * -> sanitizeArticleHtml -> ArticleBodyRenderer must yield rendered HTML
 * that contains every block type AND every inline mark in its semantic
 * tag form.
 */

function buildCanvasWithEveryNodeType(): CanvasState {
  return {
    title: "Supportsheep Grow: a **bold** start",
    subtitle: "An *italic* opener with a [link](https://example.com).",
    slug: "supportsheep-grow",
    metaTitle: null,
    metaDescription: null,
    featuredImage: {
      id: "img-hero",
      url: "https://images.example.com/hero.jpg",
      alt: "Hero image",
      placement: { kind: "featured" },
    },
    sections: [
      {
        id: "section-1",
        heading: "Definition and `core` idea",
        level: 2,
        bullets: [
          "Bullet with **bold**",
          "Bullet with [link](https://example.com)",
        ],
        paragraphs: [
          "Supportsheep Grow compounds **small** wins.",
          "Try ~~quitting~~ shipping with a `tiny` goal.",
          "Read the [manifesto](https://example.com/m).",
          "An <u>underlined</u> phrase and a <mark data-color=\"yellow\">highlight</mark>.",
        ],
        quotes: [
          {
            text: "Ship **today**, refine tomorrow.",
            attributedTo: "Supportsheep Founder",
          },
        ],
        blocks: [
          {
            id: "block-callout-1",
            type: "callout",
            kind: "info",
            title: "Why this matters",
            body: "Velocity compounds. **Direction** compounds harder.",
          },
          {
            id: "block-code-1",
            type: "code_block",
            language: "ts",
            code: "const ship = () => 'tomorrow';",
          },
          { id: "block-divider-1", type: "divider" },
          {
            id: "block-table-1",
            type: "table",
            rows: 1,
            cols: 2,
            headers: ["Day", "Win"],
          },
          {
            id: "block-embed-1",
            type: "embed",
            kind: "youtube",
            src: "https://www.youtube.com/embed/abc",
          },
          {
            id: "block-quote-1",
            type: "blockquote",
            text: "Supportsheep means **independent**, not isolated.",
            attribution: "Editor",
          },
        ],
        lists: [
          {
            id: "list-1",
            kind: "numbered",
            items: [
              { id: "list-1-item-1", text: "Pick **one** goal", level: 0 },
              { id: "list-1-item-2", text: "Ship before noon", level: 0 },
            ],
          },
          {
            id: "list-2",
            kind: "checklist",
            items: [
              {
                id: "list-2-item-1",
                text: "Brushed teeth",
                level: 0,
                checked: true,
              },
              {
                id: "list-2-item-2",
                text: "Sent the email",
                level: 0,
                checked: false,
              },
            ],
          },
        ],
        inlineImages: [
          {
            id: "img-inline-1",
            url: "https://images.example.com/inline.jpg",
            alt: "Inline diagram",
            placement: { kind: "inline", sectionId: "section-1" },
          },
        ],
        finalized: true,
      },
    ],
    meta: {
      description: null,
      tags: [],
      suggestedCategory: null,
    },
    keywords: [],
    tags: [],
    categories: [],
  };
}

describe("ArticleBodyRenderer — full canvas pipeline (W25j)", () => {
  it("renders every block type a CanvasState can produce", () => {
    const canvas = buildCanvasWithEveryNodeType();
    const body = renderCanvasToHtml(canvas);
    const sanitized = sanitizeArticleHtml(body);
    const rendered = renderToStaticMarkup(
      <ArticleBodyRenderer articleId="test" htmlBody={sanitized} />,
    );

    // Heading + subtitle + featured image
    expect(rendered).toContain("<h1>");
    expect(rendered).toContain("Supportsheep Grow");
    expect(rendered).toContain('class="article-subtitle"');
    expect(rendered).toContain("https://images.example.com/hero.jpg");

    // Section heading (transformArticleBody injects an id)
    expect(rendered).toMatch(/<h2[^>]*id="[^"]+"[^>]*>/);

    // Paragraphs
    expect(rendered).toContain("Supportsheep Grow compounds");
    expect(rendered).toContain("Try");

    // Bullets
    expect(rendered).toContain("<ul>");
    expect(rendered).toContain("Bullet with");

    // Section quote -> blockquote
    expect(rendered).toContain("<blockquote>");
    expect(rendered).toContain("Ship");
    expect(rendered).toContain("Supportsheep Founder");

    // Numbered list
    expect(rendered).toContain("<ol>");
    expect(rendered).toContain("Pick");

    // Checklist (task list) with checked state
    expect(rendered).toContain('data-type="taskList"');
    expect(rendered).toContain('data-checked="true"');
    expect(rendered).toContain('data-checked="false"');

    // Callout
    expect(rendered).toContain("<aside");
    expect(rendered).toContain('class="callout"');
    expect(rendered).toContain('data-variant="info"');
    expect(rendered).toContain("Why this matters");
    expect(rendered).toContain("Velocity compounds");

    // Code block — code stays verbatim, language class survives
    expect(rendered).toContain("<pre>");
    expect(rendered).toContain('class="language-ts"');
    expect(rendered).toContain("const ship");

    // Divider
    expect(rendered).toMatch(/<hr\s*\/?>/);

    // Table
    expect(rendered).toContain("<table>");
    expect(rendered).toContain("<thead>");
    expect(rendered).toContain("<th>Day</th>");
    expect(rendered).toContain("<th>Win</th>");
    expect(rendered).toContain("<tbody>");

    // Embed (youtube iframe + data-kind)
    expect(rendered).toContain('data-kind="youtube"');
    expect(rendered).toContain("<iframe");
    expect(rendered).toContain("youtube.com/embed/abc");

    // Block-level blockquote with attribution
    expect(rendered).toContain("Supportsheep means");
    expect(rendered).toContain("Editor");

    // Inline image (figure + img)
    expect(rendered).toContain("https://images.example.com/inline.jpg");
  });

  it("turns every inline mark into its rendered HTML tag (not literal markdown)", () => {
    const canvas = buildCanvasWithEveryNodeType();
    const body = renderCanvasToHtml(canvas);
    const sanitized = sanitizeArticleHtml(body);
    const rendered = renderToStaticMarkup(
      <ArticleBodyRenderer articleId="test" htmlBody={sanitized} />,
    );

    // Bold (**...**) -> <strong>
    expect(rendered).toContain("<strong>bold</strong>");
    expect(rendered).toContain("<strong>small</strong>");
    expect(rendered).toContain("<strong>today</strong>");
    expect(rendered).toContain("<strong>Direction</strong>");
    expect(rendered).toContain("<strong>independent</strong>");
    expect(rendered).toContain("<strong>one</strong>");

    // Italic (*...*) -> <em>
    expect(rendered).toContain("<em>italic</em>");

    // Strike (~~...~~) -> <s>
    expect(rendered).toContain("<s>quitting</s>");

    // Code (`...`) -> <code>
    expect(rendered).toContain("<code>tiny</code>");
    expect(rendered).toContain("<code>core</code>");

    // Link [text](url) -> <a href="url">text</a>
    expect(rendered).toContain('href="https://example.com"');
    expect(rendered).toContain('href="https://example.com/m"');
    expect(rendered).toContain(">manifesto</a>");
    expect(rendered).toContain(">link</a>");

    // Underline <u>...</u> survives
    expect(rendered).toContain("<u>underlined</u>");

    // Highlight <mark data-color="…">...</mark> survives
    expect(rendered).toContain("<mark");
    expect(rendered).toContain('data-color="yellow"');
    expect(rendered).toContain(">highlight</mark>");

    // Verify no leftover literal markdown delimiters in the rendered body
    // (the visible text equivalent — once marks are converted, the raw
    // `**` / `~~` / `` ` `` / `[…](…)` sequences should be gone).
    expect(rendered).not.toContain("**bold**");
    expect(rendered).not.toContain("~~quitting~~");
    expect(rendered).not.toContain("`tiny`");
    expect(rendered).not.toContain("[manifesto](https://example.com/m)");
  });
});

describe("renderInlineMarks (unit)", () => {
  it("returns empty string for empty input", () => {
    expect(renderInlineMarks("")).toBe("");
  });

  it("emits literal escaped text when no marks are present", () => {
    expect(renderInlineMarks("plain text")).toBe("plain text");
    expect(renderInlineMarks("a < b & c")).toBe("a &lt; b &amp; c");
  });

  it("converts every supported mark", () => {
    expect(renderInlineMarks("**b**")).toBe("<strong>b</strong>");
    expect(renderInlineMarks("*i*")).toBe("<em>i</em>");
    expect(renderInlineMarks("~~s~~")).toBe("<s>s</s>");
    expect(renderInlineMarks("`c`")).toBe("<code>c</code>");
    expect(renderInlineMarks("[t](https://x.com)")).toBe(
      '<a href="https://x.com">t</a>',
    );
    expect(renderInlineMarks("<u>u</u>")).toBe("<u>u</u>");
    expect(renderInlineMarks('<mark data-color="y">h</mark>')).toBe(
      '<mark data-color="y">h</mark>',
    );
  });

  it("treats half-streamed delimiters as literal text (no crash)", () => {
    expect(renderInlineMarks("Hello **wor")).toBe("Hello **wor");
    expect(renderInlineMarks("[missing")).toBe("[missing");
  });

  it("supports nesting marks inside link text and underline / highlight spans", () => {
    // Recursive rendering: marks inside <u>, <mark>, and link text get
    // converted, not emitted as raw delimiters.
    expect(renderInlineMarks("[**bold**](https://x.com)")).toBe(
      '<a href="https://x.com"><strong>bold</strong></a>',
    );
    expect(renderInlineMarks("<u>**bold**</u>")).toBe(
      "<u><strong>bold</strong></u>",
    );
    expect(renderInlineMarks('<mark data-color="y">*italic*</mark>')).toBe(
      '<mark data-color="y"><em>italic</em></mark>',
    );
  });

  it("keeps backticks inside code spans literal", () => {
    // The content of a code span is escaped, not re-parsed for marks.
    expect(renderInlineMarks("`**not bold**`")).toBe(
      "<code>**not bold**</code>",
    );
  });
});
