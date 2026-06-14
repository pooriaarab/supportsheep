/**
 * Article HTML sanitization.
 *
 * Applied on both write (API) and render (public article page) paths to
 * defend against stored XSS in article body content. Uses sanitize-html
 * (pure htmlparser2 — no jsdom) with a strict tag and attribute allowlist
 * scoped to the blog's supported markup (TipTap output, WordPress imports,
 * callouts, figures, YouTube/Vimeo embeds).
 *
 * The allowlist intentionally mirrors what our renderer is known to emit so
 * that existing content continues to render unchanged while unexpected
 * markup (script tags, event handlers, foreign iframes, javascript: URLs,
 * etc.) is stripped.
 */

import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "a",
  "b",
  "strong",
  "em",
  "i",
  "u",
  "s",
  "mark",
  "sub",
  "sup",
  "code",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "img",
  "figure",
  "figcaption",
  "iframe",
  "section",
  "aside",
  "div",
  "span",
  "br",
  "hr",
];

const ALLOWED_ATTR = [
  "href",
  "src",
  "alt",
  "title",
  "class",
  "id",
  "data-variant",
  "data-block",
  "data-kind",
  "data-type",
  "data-checked",
  "data-color",
  "target",
  "rel",
  "loading",
  "width",
  "height",
  "colspan",
  "rowspan",
  "colwidth",
  "style",
  "allow",
  "allowfullscreen",
  "frameborder",
];

/**
 * Safe CSS properties allowed when `style` attributes survive the allowlist.
 * TipTap's TextAlign extension emits `style="text-align: ..."` on headings
 * and paragraphs, and TextStyle/Color can emit `style="color: ..."` on spans.
 */
const ALLOWED_STYLE_PROPERTIES = new Set([
  "text-align",
  "color",
  "background-color",
]);

const SAFE_STYLE_VALUE = /^[a-zA-Z0-9#.,\s()%\-_]+$/;

function sanitizeStyleAttribute(style: string): string {
  const declarations = style.split(";");
  const kept: string[] = [];
  for (const decl of declarations) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (!prop || !value) continue;
    if (!ALLOWED_STYLE_PROPERTIES.has(prop)) continue;
    if (!SAFE_STYLE_VALUE.test(value)) continue;
    if (/url\s*\(/i.test(value) || /expression\s*\(/i.test(value)) continue;
    kept.push(`${prop}: ${value}`);
  }
  return kept.join("; ");
}

/**
 * Iframe sources are restricted to known-good video embed providers. Every
 * other iframe is stripped. Matches youtube.com, youtube-nocookie.com embed
 * URLs, and Vimeo player URLs.
 */
const IFRAME_SRC_ALLOWLIST = [
  /^https:\/\/(www\.)?youtube(-nocookie)?\.com\/embed\//,
  /^https:\/\/player\.vimeo\.com\/video\//,
];

function isAllowedIframeSrc(src: string | undefined): boolean {
  if (!src) return false;
  return IFRAME_SRC_ALLOWLIST.some((pattern) => pattern.test(src));
}

/**
 * Sanitize user-authored article body HTML.
 *
 * Safe to call with an empty string or on content that is already
 * sanitized — idempotent.
 */
export function sanitizeArticleHtml(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { "*": ALLOWED_ATTR },
    // We do our own style sanitisation in transformTags below and rely on the
    // exact string we emit surviving to the output. The default parser strips
    // whitespace after the colon, which would silently break our tests and
    // change what downstream CSS selectors match.
    parseStyleAttributes: false,
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowedIframeHostnames: [
      "www.youtube.com",
      "youtube.com",
      "www.youtube-nocookie.com",
      "youtube-nocookie.com",
      "player.vimeo.com",
    ],
    transformTags: {
      "*": (tagName, attribs) => {
        if (attribs.style) {
          const safe = sanitizeStyleAttribute(attribs.style);
          if (safe) {
            attribs.style = safe;
          } else {
            delete attribs.style;
          }
        }
        return { tagName, attribs };
      },
    },
    exclusiveFilter: (frame) =>
      frame.tag === "iframe" && !isAllowedIframeSrc(frame.attribs.src),
  });
}
