import { describe, it, expect } from "vitest";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";

describe("sanitizeArticleHtml", () => {
  it("returns empty string for empty input", () => {
    expect(sanitizeArticleHtml("")).toBe("");
  });

  it("strips <script> tags entirely", () => {
    const html = "<p>hi</p><script>alert('xss')</script>";
    const out = sanitizeArticleHtml(html);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("alert");
    expect(out).toContain("<p>hi</p>");
  });

  it("strips inline event handlers like onclick", () => {
    const html = `<p onclick="alert('x')">click me</p>`;
    const out = sanitizeArticleHtml(html);
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("alert");
    expect(out).toContain("click me");
  });

  it("strips javascript: URLs in href", () => {
    const html = `<a href="javascript:alert(1)">bad link</a>`;
    const out = sanitizeArticleHtml(html);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toContain("bad link");
  });

  it("preserves YouTube iframe embeds", () => {
    const html = `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" allowfullscreen frameborder="0" allow="autoplay" width="560" height="315"></iframe>`;
    const out = sanitizeArticleHtml(html);
    expect(out).toContain("<iframe");
    expect(out).toContain('src="https://www.youtube.com/embed/dQw4w9WgXcQ"');
    expect(out).toContain("allowfullscreen");
  });

  it("preserves youtube-nocookie.com embed URLs", () => {
    const html = `<iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe>`;
    const out = sanitizeArticleHtml(html);
    expect(out).toContain("youtube-nocookie.com/embed/abc123");
  });

  it("preserves Vimeo player embeds", () => {
    const html = `<iframe src="https://player.vimeo.com/video/12345"></iframe>`;
    const out = sanitizeArticleHtml(html);
    expect(out).toContain("player.vimeo.com/video/12345");
  });

  it("strips iframes pointing at untrusted hosts", () => {
    const html = `<iframe src="https://evil.example.com/pwn"></iframe>`;
    const out = sanitizeArticleHtml(html);
    expect(out).not.toContain("<iframe");
    expect(out).not.toContain("evil.example.com");
  });

  it("strips iframes with no src", () => {
    const html = `<iframe></iframe>`;
    const out = sanitizeArticleHtml(html);
    expect(out).not.toContain("<iframe");
  });

  it("preserves safe structural tags", () => {
    const html =
      "<h2>Title</h2>" +
      "<p>Hello <strong>world</strong> <em>emphasis</em></p>" +
      "<ul><li>one</li><li>two</li></ul>" +
      "<blockquote>quote</blockquote>" +
      "<pre><code>code</code></pre>" +
      "<table><thead><tr><th>h</th></tr></thead><tbody><tr><td>c</td></tr></tbody></table>";
    const out = sanitizeArticleHtml(html);
    expect(out).toContain("<h2>Title</h2>");
    expect(out).toContain("<strong>world</strong>");
    expect(out).toContain("<em>emphasis</em>");
    expect(out).toContain("<ul>");
    expect(out).toContain("<li>one</li>");
    expect(out).toContain("<blockquote>quote</blockquote>");
    expect(out).toContain("<pre>");
    expect(out).toContain("<code>code</code>");
    expect(out).toContain("<table>");
    expect(out).toContain("<thead>");
    expect(out).toContain("<tbody>");
  });

  it("preserves callout and figure classes used by renderer", () => {
    const html =
      `<aside class="callout" data-variant="info" data-block="callout"><p>Note</p></aside>` +
      `<figure class="image-figure"><img src="https://cdn.example.com/a.png" alt="alt"/><figcaption>caption</figcaption></figure>`;
    const out = sanitizeArticleHtml(html);
    expect(out).toContain("<aside");
    expect(out).toContain('class="callout"');
    expect(out).toContain('data-variant="info"');
    expect(out).toContain('data-block="callout"');
    expect(out).toContain("<figure");
    expect(out).toContain('class="image-figure"');
    expect(out).toContain("<figcaption>caption</figcaption>");
    expect(out).toContain("<img");
    expect(out).toContain('alt="alt"');
  });

  it("preserves safe link attributes", () => {
    const html = `<a href="https://example.com" target="_blank" rel="noopener noreferrer" title="ex">link</a>`;
    const out = sanitizeArticleHtml(html);
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('title="ex"');
  });

  it("preserves colspan and rowspan on table cells", () => {
    const html =
      '<table><tbody>' +
      '<tr><td colspan="2" rowspan="2">merged</td></tr>' +
      '<tr><td colwidth="150">cell</td></tr>' +
      '</tbody></table>';
    const out = sanitizeArticleHtml(html);
    expect(out).toContain('colspan="2"');
    expect(out).toContain('rowspan="2"');
    expect(out).toContain('colwidth="150"');
  });

  it("preserves mark, sub, and sup tags used by TipTap Highlight/Subscript/Superscript", () => {
    const html =
      "<p>H<sub>2</sub>O and e=mc<sup>2</sup>, <mark>highlight</mark></p>";
    const out = sanitizeArticleHtml(html);
    expect(out).toContain("<sub>2</sub>");
    expect(out).toContain("<sup>2</sup>");
    expect(out).toContain("<mark>highlight</mark>");
  });

  it("preserves text-align styles emitted by TipTap TextAlign", () => {
    const html =
      '<p style="text-align: center">centered</p>' +
      '<h2 style="text-align: right">right</h2>';
    const out = sanitizeArticleHtml(html);
    expect(out).toMatch(/<p[^>]*style="text-align: center"/);
    expect(out).toMatch(/<h2[^>]*style="text-align: right"/);
    expect(out).toContain("centered");
    expect(out).toContain("right");
  });

  it("preserves safe color styles from TextStyle/Color but drops disallowed properties", () => {
    const html =
      '<span style="color: #ff0000; background-color: rgb(0, 255, 0); position: absolute; top: 0">x</span>';
    const out = sanitizeArticleHtml(html);
    expect(out).toContain("color: #ff0000");
    expect(out).toContain("background-color: rgb(0, 255, 0)");
    expect(out).not.toContain("position");
    expect(out).not.toContain("absolute");
    expect(out).not.toContain("top: 0");
  });

  it("strips url() and expression() in style values", () => {
    const html =
      '<p style="background-color: url(javascript:alert(1))">x</p>' +
      '<p style="color: expression(alert(1))">y</p>';
    const out = sanitizeArticleHtml(html);
    expect(out).not.toContain("url(");
    expect(out).not.toContain("expression(");
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toContain("alert");
  });

  it("strips unknown style properties entirely while preserving the tag", () => {
    const html = '<p style="font-family: Comic Sans; margin: 10px">hello</p>';
    const out = sanitizeArticleHtml(html);
    expect(out).toContain("hello");
    expect(out).not.toContain("font-family");
    expect(out).not.toContain("margin");
    // When no allowed properties survive, the style attribute should be removed.
    expect(out).not.toMatch(/<p[^>]*style=/);
  });

  it("is idempotent -- re-sanitizing sanitized HTML is a no-op", () => {
    const html =
      '<p style="text-align: center">hi</p>' +
      '<iframe src="https://www.youtube.com/embed/abc" allowfullscreen></iframe>' +
      '<table><tr><td colspan="2">x</td></tr></table>' +
      "<mark>m</mark>";
    const once = sanitizeArticleHtml(html);
    const twice = sanitizeArticleHtml(once);
    expect(twice).toBe(once);
  });

  it("does not leave a loadable iframe src when dropping foreign iframes", () => {
    const html = `<div><iframe src="https://evil.example.com/x"></iframe></div>`;
    const out = sanitizeArticleHtml(html);
    // Whether the node was removed or neutralized, the external src must not
    // survive in the output.
    expect(out).not.toContain("evil.example.com");
    expect(out).not.toMatch(/<iframe[^>]+src="https:\/\/evil/);
  });
});
