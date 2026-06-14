/**
 * Pure converter from a {@link CanvasState} snapshot into a TipTap-compatible
 * ProseMirror JSON document. Used by `canvas-collaborative-editor.tsx` to feed
 * the live interview canvas editor.
 *
 * The canvas paragraphs may contain inline markdown-style mark escapes (see
 * `lib/interviews/tools/_marks.ts`). This converter expands those into the
 * proper TipTap mark nodes (`bold`, `italic`, `underline`, `strike`, `code`,
 * `link`, `highlight`) so the rendered editor shows real rich text instead of
 * literal `**bold**` characters.
 *
 * The function is intentionally side-effect free so it can be diff-applied:
 * `body-tab.tsx` only needs to convert the current canvas and ask TipTap to
 * `setContent(json, false)` (no emitUpdate) — granular update commands are
 * driven separately by the renderer based on which sections changed.
 */
import type {
  CanvasBlock,
  CanvasImage,
  CanvasSection,
  CanvasState,
} from "@/hooks/use-interview-session";

/** A minimal JSONContent shape; matches TipTap's runtime expectations. */
export type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  text?: string;
  content?: TiptapNode[];
};

export type TiptapDoc = {
  type: "doc";
  content: TiptapNode[];
};

/**
 * Convert a {@link CanvasState} into a TipTap `doc` JSON node. Empty canvas
 * returns an empty doc (single empty paragraph) so TipTap renders without
 * errors.
 */
export function canvasToTiptap(canvas: CanvasState): TiptapDoc {
  const content: TiptapNode[] = [];

  if (canvas.title) {
    content.push({
      type: "heading",
      attrs: { level: 1 },
      content: parseInlineMarkdown(canvas.title),
    });
  }

  // Featured (hero) image lands right after the title so the live in-call
  // canvas matches the saved-draft HTML shape (`save-draft.ts:renderCanvasToHtml`
  // emits the featured image immediately after the `<h1>`). Without this
  // the `request_featured_image` / `regenerate_featured_image` results
  // were silently absent from the editor even though the diff updated
  // `canvas.featuredImage` — readers saw the hero appear only on the
  // /review preview, never live during the call.
  if (canvas.featuredImage) {
    content.push(canvasImageToTiptap(canvas.featuredImage));
  }

  for (const section of canvas.sections) {
    appendSection(content, section);
  }

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}

function appendSection(out: TiptapNode[], section: CanvasSection): void {
  if (section.heading) {
    out.push({
      type: "heading",
      attrs: { level: 2 },
      content: parseInlineMarkdown(section.heading),
    });
  }

  if (section.bullets.length > 0) {
    out.push({
      type: "bulletList",
      content: section.bullets.map((bullet) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: parseInlineMarkdown(bullet),
          },
        ],
      })),
    });
  }

  for (const paragraph of section.paragraphs) {
    out.push({
      type: "paragraph",
      content: parseInlineMarkdown(paragraph),
    });
  }

  for (const quote of section.quotes) {
    const blockContent: TiptapNode[] = [
      {
        type: "paragraph",
        content: parseInlineMarkdown(quote.text),
      },
    ];
    if (quote.attributedTo) {
      blockContent.push({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: `— ${quote.attributedTo}`,
            marks: [{ type: "italic" }],
          },
        ],
      });
    }
    out.push({ type: "blockquote", content: blockContent });
  }

  if (section.blocks) {
    for (const block of section.blocks) {
      const node = canvasBlockToTiptap(block);
      if (node) out.push(node);
    }
  }

  if (section.inlineImages) {
    for (const image of section.inlineImages) {
      out.push(canvasImageToTiptap(image));
    }
  }
}

/**
 * Convert an inline {@link CanvasImage} into a TipTap `figure` node so
 * `insert_inline_image` / `replace_inline_image` results actually appear
 * in the live in-call canvas, matching the saved-draft HTML shape from
 * `save-draft.ts:renderImage` (`<figure><img/></figure>`).
 */
export function canvasImageToTiptap(image: CanvasImage): TiptapNode {
  return {
    type: "figure",
    attrs: {
      src: image.url,
      alt: image.alt ?? "",
      width: null,
      height: null,
    },
  };
}

/**
 * Convert a single {@link CanvasBlock} into a TipTap node. Returns `null`
 * for unknown block types so the rest of the doc still renders.
 */
export function canvasBlockToTiptap(block: CanvasBlock): TiptapNode | null {
  switch (block.type) {
    case "blockquote": {
      const content: TiptapNode[] = [
        {
          type: "paragraph",
          content: parseInlineMarkdown(block.text),
        },
      ];
      if (block.attribution) {
        content.push({
          type: "paragraph",
          content: [
            {
              type: "text",
              text: `— ${block.attribution}`,
              marks: [{ type: "italic" }],
            },
          ],
        });
      }
      return { type: "blockquote", content };
    }
    case "code_block":
      return {
        type: "codeBlock",
        attrs: { language: block.language || null },
        content: block.code
          ? [{ type: "text", text: block.code }]
          : undefined,
      };
    case "callout":
      return {
        type: "callout",
        attrs: { variant: block.kind },
        content: [
          ...(block.title
            ? [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: block.title,
                      marks: [{ type: "bold" }],
                    },
                  ],
                },
              ]
            : []),
          {
            type: "paragraph",
            content: parseInlineMarkdown(block.body),
          },
        ],
      };
    case "divider":
      return { type: "horizontalRule" };
    case "table": {
      const rows: TiptapNode[] = [];
      if (block.headers && block.headers.length > 0) {
        rows.push({
          type: "tableRow",
          content: block.headers.map((h) => ({
            type: "tableHeader",
            content: [
              {
                type: "paragraph",
                content: h ? [{ type: "text", text: h }] : undefined,
              },
            ],
          })),
        });
      }
      for (let r = 0; r < block.rows; r += 1) {
        rows.push({
          type: "tableRow",
          content: Array.from({ length: block.cols }).map(() => ({
            type: "tableCell",
            content: [{ type: "paragraph" }],
          })),
        });
      }
      return { type: "table", content: rows };
    }
    case "embed":
      return {
        type: "embed",
        attrs: { kind: block.kind, src: block.src },
      };
    default:
      return null;
  }
}

/**
 * Parse a paragraph string containing markdown-style mark escapes into
 * a sequence of TipTap text nodes with the matching marks applied.
 *
 * Supported escapes (kept in lockstep with `lib/interviews/tools/_marks.ts`):
 * - `**bold**`, `*italic*`
 * - `~~strike~~`
 * - `` `code` ``
 * - `[text](url)` for links
 * - `<u>...</u>` for underline
 * - `<mark data-color="...">...</mark>` for highlight
 *
 * Unmatched delimiters are emitted as literal text so a half-streamed
 * paragraph (e.g. `"Hello **wor"`) never crashes the renderer.
 */
export function parseInlineMarkdown(input: string): TiptapNode[] {
  if (!input) return [];

  const tokens = tokenizeInline(input);
  return tokens.length > 0 ? tokens : [{ type: "text", text: input }];
}

type Mark = { type: string; attrs?: Record<string, unknown> };

interface ScanResult {
  text: string;
  consumed: number;
  marks: Mark[];
}

/**
 * Single-pass tokenizer that walks the string and tries each pattern at
 * the current index. Falls back to emitting one literal character at a
 * time when no pattern matches, then coalesces adjacent literal chars
 * into a single text node.
 */
function tokenizeInline(input: string): TiptapNode[] {
  const out: TiptapNode[] = [];
  let buffer = "";
  let i = 0;

  const flush = () => {
    if (buffer) {
      out.push({ type: "text", text: buffer });
      buffer = "";
    }
  };

  while (i < input.length) {
    const result = tryMatchInline(input, i);
    if (result) {
      flush();
      const node: TiptapNode = { type: "text", text: result.text };
      if (result.marks.length > 0) node.marks = result.marks;
      out.push(node);
      i += result.consumed;
      continue;
    }
    buffer += input[i];
    i += 1;
  }

  flush();
  return out;
}

function tryMatchInline(input: string, start: number): ScanResult | null {
  // Order matters: longer delimiters first so `**` is not misread as `*`.
  return (
    matchDelimiter(input, start, "**", "**", "bold") ||
    matchDelimiter(input, start, "~~", "~~", "strike") ||
    matchDelimiter(input, start, "*", "*", "italic") ||
    matchDelimiter(input, start, "`", "`", "code") ||
    matchUnderline(input, start) ||
    matchHighlight(input, start) ||
    matchLink(input, start)
  );
}

function matchDelimiter(
  input: string,
  start: number,
  open: string,
  close: string,
  markType: string,
): ScanResult | null {
  if (!input.startsWith(open, start)) return null;
  const contentStart = start + open.length;
  const closeIdx = input.indexOf(close, contentStart);
  if (closeIdx === -1) return null;
  // Require non-empty content so an isolated `**` doesn't swallow text.
  if (closeIdx === contentStart) return null;
  return {
    text: input.slice(contentStart, closeIdx),
    consumed: closeIdx + close.length - start,
    marks: [{ type: markType }],
  };
}

function matchUnderline(input: string, start: number): ScanResult | null {
  const open = "<u>";
  const close = "</u>";
  if (!input.startsWith(open, start)) return null;
  const closeIdx = input.indexOf(close, start + open.length);
  if (closeIdx === -1) return null;
  return {
    text: input.slice(start + open.length, closeIdx),
    consumed: closeIdx + close.length - start,
    marks: [{ type: "underline" }],
  };
}

function matchHighlight(input: string, start: number): ScanResult | null {
  // <mark> with optional data-color attribute, anchored at start.
  const tagMatch = /^<mark(\s+data-color="([^"]*)")?>/.exec(input.slice(start));
  if (!tagMatch) return null;
  const openLen = tagMatch[0].length;
  const closeIdx = input.indexOf("</mark>", start + openLen);
  if (closeIdx === -1) return null;
  const attrs: Record<string, unknown> = {};
  if (tagMatch[2]) attrs.color = tagMatch[2];
  const mark: Mark = { type: "highlight" };
  if (Object.keys(attrs).length > 0) mark.attrs = attrs;
  return {
    text: input.slice(start + openLen, closeIdx),
    consumed: closeIdx + "</mark>".length - start,
    marks: [mark],
  };
}

function matchLink(input: string, start: number): ScanResult | null {
  if (input[start] !== "[") return null;
  // Find the closing `]` followed immediately by `(`.
  const closeBracket = input.indexOf("]", start + 1);
  if (closeBracket === -1) return null;
  if (input[closeBracket + 1] !== "(") return null;
  const closeParen = input.indexOf(")", closeBracket + 2);
  if (closeParen === -1) return null;
  const text = input.slice(start + 1, closeBracket);
  const href = input.slice(closeBracket + 2, closeParen);
  if (!text) return null;
  return {
    text,
    consumed: closeParen + 1 - start,
    marks: [{ type: "link", attrs: { href } }],
  };
}
