import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { toString as hastToString } from "hast-util-to-string";
import type { Element, Root } from "hast";

export interface ArticleHeading {
  id: string;
  text: string;
  level: 2 | 3 | 4;
}

export interface TransformedArticleBody {
  html: string;
  headings: ArticleHeading[];
}

const TRACKED_LEVELS: ReadonlySet<string> = new Set(["h2", "h3", "h4"]);

/**
 * Slugifies heading text into a stable URL fragment.
 * Lowercases, strips non-word chars, collapses whitespace to dashes.
 */
export function slugifyHeading(text: string): string {
  const normalized = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  return normalized.replace(/^-+|-+$/g, "");
}

/**
 * Parses an article HTML body, injects stable `id` attributes onto
 * `<h2>`, `<h3>`, and `<h4>` elements, and returns the transformed
 * HTML along with a flat list of the headings found (for a ToC).
 *
 * Collisions are resolved with numeric suffixes (`-2`, `-3`, ...).
 * Headings that already declare an `id` are preserved but still tracked.
 */
export function transformArticleBody(body: string): TransformedArticleBody {
  if (!body) {
    return { html: "", headings: [] };
  }

  const headings: ArticleHeading[] = [];
  const usedIds = new Set<string>();

  const ensureUniqueId = (base: string): string => {
    if (!base) {
      base = "section";
    }
    if (!usedIds.has(base)) {
      usedIds.add(base);
      return base;
    }
    let suffix = 2;
    while (usedIds.has(`${base}-${suffix}`)) {
      suffix += 1;
    }
    const unique = `${base}-${suffix}`;
    usedIds.add(unique);
    return unique;
  };

  const processor = unified()
    .use(rehypeParse, { fragment: true })
    .use(() => (tree: Root) => {
      visit(tree, "element", (node: Element) => {
        if (!TRACKED_LEVELS.has(node.tagName)) {
          return;
        }

        const level = Number.parseInt(node.tagName.slice(1), 10) as 2 | 3 | 4;
        const text = hastToString(node).trim();
        if (!text) {
          return;
        }

        node.properties = node.properties ?? {};
        const existingId =
          typeof node.properties.id === "string" && node.properties.id.length > 0
            ? node.properties.id
            : null;
        const id = existingId
          ? ensureUniqueId(existingId)
          : ensureUniqueId(slugifyHeading(text));
        node.properties.id = id;

        headings.push({ id, text, level });
      });
    })
    // `allowDangerousHtml` is required so inline HTML inside rich-text
    // articles (e.g. `<strong>`, `<em>`, editor-emitted `<figure>`) survives
    // the rehype parse/stringify round-trip. The security posture is
    // unchanged from the pre-existing `dangerouslySetInnerHTML` render path —
    // untrusted input must be sanitized upstream (see sanitizeArticleHtml).
    .use(rehypeStringify, { allowDangerousHtml: true });

  const html = String(processor.processSync(body));
  return { html, headings };
}
