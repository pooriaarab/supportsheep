import "server-only";
import { getWorker } from "./writer-worker-registry";
import { buildArticleCreateDocument } from "@/lib/articles/create-article-record";
import {
  slugExists as d1SlugExists,
  createArticle,
} from "@/lib/articles/repository";
import { stripUndefined } from "@/lib/strip-undefined";
import { updateInterview, getInterview } from "@/lib/interviews/interviews-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";
import type { ArticleStatus, UserRole } from "@repo/types";
import type {
  CanvasBlock,
  CanvasImage,
  CanvasList,
  CanvasSection,
  CanvasState,
} from "./writer-worker";
import { createLogger } from "@/lib/logger";

const log = createLogger("interviews:save-draft");

export interface SaveDraftResult {
  articleId: string;
  slug: string;
  requiresReview: boolean;
}

export async function saveDraft(
  interviewId: string,
  customCanvas?: CanvasState,
  blogId: string = DEFAULT_BLOG_ID,
): Promise<SaveDraftResult> {
  // Load the interview row from D1
  const interview = await getInterview(blogId, interviewId);
  if (!interview) throw new Error(`Interview ${interviewId} not found`);

  // Resolve the canvas in priority order:
  //   1. explicit `customCanvas` arg (e.g. async stitcher result),
  //   2. in-memory worker on this lambda instance (freshest),
  //   3. persisted `canvasSnapshot` on the interview row (cross-instance
  //      fallback for serverless deployments where /stream and /end can
  //      land on different containers — without this fallback, the writer
  //      canvas built up during the interview is invisible to /end and the
  //      saved draft body is an empty string).
  const workerCanvas = getWorker(interviewId)?.getCanvas();
  // canvasSnapshot is typed as Record<string,unknown>|null in InterviewRow
  // but the actual stored value is always a CanvasState JSON — cast it.
  const snapshotCanvas = interview.canvasSnapshot as CanvasState | null | undefined;
  const canvas = customCanvas ?? workerCanvas ?? snapshotCanvas ?? undefined;
  const canvasSource = customCanvas
    ? "custom"
    : workerCanvas
      ? "worker"
      : snapshotCanvas
        ? "snapshot"
        : "none";
  const bodyHtml = canvas ? renderCanvasToHtml(canvas) : "";

  const role = (interview.startedByRole ?? "guest") as UserRole;
  const directPublish = role === "owner" || role === "admin" || role === "editor";
  const articleStatus: ArticleStatus = directPublish ? "draft" : "pending_review";

  // Persist the FULL canvas state to the article doc — not just title
  // and body. metaTitle, metaDescription, keywords, tags, categories, and
  // featuredImage are all surfaced to the editor on /[postId]/edit, so
  // they must round-trip through the interview → article handoff or the
  // user has to re-enter every SEO field they set during the session.
  const canvasFeaturedImage = canvas?.featuredImage
    ? { url: canvas.featuredImage.url, alt: canvas.featuredImage.alt }
    : undefined;

  const articleDoc = await buildArticleCreateDocument(
    {
      title: canvas?.title ?? interview.topic ?? `Interview ${interviewId}`,
      body: bodyHtml,
      draftBody: bodyHtml,
      status: articleStatus,
      slugHint: canvas?.slug ?? canvas?.title ?? interview.topic ?? `interview-${interviewId}`,
      metaTitle: canvas?.metaTitle ?? undefined,
      metaDescription: canvas?.metaDescription ?? canvas?.meta?.description ?? undefined,
      keywords: canvas?.keywords,
      tags: canvas?.tags ?? canvas?.meta?.tags,
      categories: canvas?.categories,
      featuredImage: canvasFeaturedImage,
    },
    (slug) => d1SlugExists(blogId, slug),
  );

  // Attach interview-specific fields to the article doc
  articleDoc.generatedBy = "interview";
  (articleDoc as unknown as Record<string, unknown>).interviewId = interviewId;
  // Persist the full canvas snapshot alongside the rendered HTML so
  // downstream tooling (the /[postId]/edit canvas restorer, future
  // re-rendering with new templates) has lossless access to every
  // section / block / list / inline image / featured image the live
  // interview produced.
  if (canvas) {
    (articleDoc as unknown as Record<string, unknown>).interviewCanvas = canvas;
  }
  if (interview.guestName && interview.guestEmail) {
    (articleDoc as unknown as Record<string, unknown>).guestAttribution = {
      name: interview.guestName,
      email: interview.guestEmail,
    };
  }

  // Write the article to D1 via the articles repository.
  // Strip undefined fields before writing — `buildArticleCreateDocument` can
  // produce undefined values for optional fields (primaryCategory, categories,
  // authorId, source) when the canvas never populated them. JSON.stringify would
  // silently drop them, but we strip them here so callers and tests see a clean
  // object without any `undefined` properties.
  const createResult = await createArticle(blogId, stripUndefined(articleDoc) as typeof articleDoc);
  if (!createResult.ok) {
    // Slug collision — resolve via fallback slug that includes the interview id
    const fallbackSlug = `interview-${interviewId}-${Date.now().toString(36)}`;
    // Build a fresh doc with the fallback slug, bypassing the collision
    const fallbackDoc = { ...stripUndefined(articleDoc), slug: fallbackSlug };
    const fallbackResult = await createArticle(blogId, fallbackDoc);
    if (!fallbackResult.ok) {
      throw new Error(`Failed to create article for interview ${interviewId}: duplicate slug`);
    }
    const savedArticle = fallbackResult.article;
    await updateInterview(blogId, interviewId, {
      articleId: savedArticle.id,
      publishedDirect: directPublish,
    });
    log.info("Saved interview draft (fallback slug)", {
      interviewId,
      articleId: savedArticle.id,
      status: articleStatus,
      canvasSource,
      bodyLength: bodyHtml.length,
    });
    return { articleId: savedArticle.id, slug: savedArticle.slug, requiresReview: !directPublish };
  }

  const savedArticle = createResult.article;

  // Update the interview with the article reference
  await updateInterview(blogId, interviewId, {
    articleId: savedArticle.id,
    publishedDirect: directPublish,
  });

  log.info("Saved interview draft", {
    interviewId,
    articleId: savedArticle.id,
    status: articleStatus,
    canvasSource,
    bodyLength: bodyHtml.length,
  });

  return { articleId: savedArticle.id, slug: savedArticle.slug, requiresReview: !directPublish };
}

/**
 * Server-side renderer that walks the full {@link CanvasState} and emits
 * HTML the public `/[slug]` route can render via `<ArticleBodyRenderer>`.
 *
 * Pure (no DOM, no TipTap `generateHTML`) so it runs unchanged in
 * Vitest's node env and on Netlify Functions. Mirrors the node coverage
 * of `canvasToTiptap` (used by the live in-call canvas) plus the canvas
 * fields the in-call editor doesn't yet render via TipTap (featured
 * image, inline images, subtitle, lists). Every block the writer-worker
 * can emit MUST land in the article body — otherwise the saved draft
 * loses fidelity vs. what the user just watched the AI build.
 *
 * Exported for testability so the W25j pipeline test can pin the
 * canvas → HTML → sanitize → renderer contract end-to-end.
 */
export function renderCanvasToHtml(canvas: CanvasState): string {
  const parts: string[] = [];
  if (canvas.title) parts.push(`<h1>${renderInlineMarks(canvas.title)}</h1>`);
  if (canvas.subtitle) parts.push(`<p class="article-subtitle">${renderInlineMarks(canvas.subtitle)}</p>`);
  if (canvas.featuredImage) parts.push(renderImage(canvas.featuredImage));
  for (const section of canvas.sections) {
    renderSection(parts, section);
  }
  return parts.join("\n");
}

function renderSection(parts: string[], section: CanvasSection): void {
  if (section.heading) {
    const level = section.level ?? 2;
    parts.push(`<h${level}>${renderInlineMarks(section.heading)}</h${level}>`);
  }
  for (const p of section.paragraphs) parts.push(`<p>${renderInlineMarks(p)}</p>`);
  if (section.bullets.length > 0) {
    parts.push("<ul>");
    for (const b of section.bullets) parts.push(`<li>${renderInlineMarks(b)}</li>`);
    parts.push("</ul>");
  }
  for (const q of section.quotes) {
    parts.push(
      `<blockquote><p>${renderInlineMarks(q.text)}</p>${q.attributedTo ? `<p>— ${renderInlineMarks(q.attributedTo)}</p>` : ""}</blockquote>`,
    );
  }
  if (section.lists) {
    for (const list of section.lists) {
      parts.push(renderList(list));
    }
  }
  if (section.blocks) {
    for (const block of section.blocks) {
      const html = renderBlock(block);
      if (html) parts.push(html);
    }
  }
  if (section.inlineImages) {
    for (const image of section.inlineImages) {
      parts.push(renderImage(image));
    }
  }
}

function renderList(list: CanvasList): string {
  const tag = list.kind === "numbered" ? "ol" : "ul";
  const classAttr =
    list.kind === "checklist"
      ? ' class="task-list" data-type="taskList"'
      : "";
  const items = list.items
    .map((item) => {
      const checked =
        list.kind === "checklist"
          ? ` data-checked="${item.checked ? "true" : "false"}"`
          : "";
      return `<li${checked}>${renderInlineMarks(item.text)}</li>`;
    })
    .join("");
  return `<${tag}${classAttr}>${items}</${tag}>`;
}

function renderBlock(block: CanvasBlock): string | null {
  switch (block.type) {
    case "blockquote":
      return `<blockquote><p>${renderInlineMarks(block.text)}</p>${block.attribution ? `<p>— ${renderInlineMarks(block.attribution)}</p>` : ""}</blockquote>`;
    case "code_block":
      // Code block content is shown verbatim — never run through the
      // inline-mark renderer so backticks and asterisks inside source
      // code stay literal.
      return `<pre><code${block.language ? ` class="language-${escapeHtml(block.language)}"` : ""}>${escapeHtml(block.code)}</code></pre>`;
    case "callout":
      return `<aside class="callout" data-variant="${escapeHtml(block.kind)}">${block.title ? `<p><strong>${renderInlineMarks(block.title)}</strong></p>` : ""}<p>${renderInlineMarks(block.body)}</p></aside>`;
    case "divider":
      return "<hr />";
    case "table": {
      const headerRow = block.headers && block.headers.length > 0
        ? `<thead><tr>${block.headers
            .map((h) => `<th>${renderInlineMarks(h)}</th>`)
            .join("")}</tr></thead>`
        : "";
      const bodyRows = Array.from({ length: block.rows })
        .map(
          () =>
            `<tr>${Array.from({ length: block.cols })
              .map(() => "<td></td>")
              .join("")}</tr>`,
        )
        .join("");
      return `<table>${headerRow}<tbody>${bodyRows}</tbody></table>`;
    }
    case "embed":
      return `<figure class="embed" data-kind="${escapeHtml(block.kind)}"><iframe src="${escapeHtml(block.src)}" allowfullscreen></iframe></figure>`;
    default:
      return null;
  }
}

function renderImage(image: CanvasImage): string {
  const alt = escapeHtml(image.alt ?? "");
  const src = escapeHtml(image.url);
  return `<figure><img src="${src}" alt="${alt}" /></figure>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Render the inline markdown-style mark escapes the canvas stores in
 * its plain `paragraphs: string[]`, `bullets: string[]`, and quote text
 * fields (see `lib/interviews/tools/_marks.ts`) into the HTML tags the
 * public renderer / `ArticleBodyRenderer` expects:
 *
 * - `**bold**`               → `<strong>bold</strong>`
 * - `*italic*`               → `<em>italic</em>`
 * - `~~strike~~`             → `<s>strike</s>`
 * - `` `code` ``             → `<code>code</code>`
 * - `[text](url)`            → `<a href="url">text</a>`
 * - `<u>...</u>`             → `<u>...</u>` (passed through)
 * - `<mark data-color="…">…</mark>` → `<mark data-color="…">…</mark>` (passed through)
 *
 * Without this step the public-route body persists the literal markdown
 * delimiters — bold/italic/link marks from the live in-call canvas vanish
 * into escaped text and the COMPILED DRAFT PREVIEW on /review renders
 * plain text instead of the formatted prose the user just watched the
 * AI build.
 *
 * Unmatched delimiters (e.g. a half-streamed `**wor`) are emitted as
 * literal text so a partial paragraph never crashes the renderer.
 *
 * Kept in lockstep with `parseInlineMarkdown` in `canvas-to-tiptap.ts`:
 * both pipelines must understand the same delimiter set so the in-call
 * canvas and the saved-draft preview render identically.
 */
export function renderInlineMarks(input: string): string {
  if (!input) return "";
  const out: string[] = [];
  let buffer = "";
  let i = 0;
  const flush = () => {
    if (buffer) {
      out.push(escapeHtml(buffer));
      buffer = "";
    }
  };
  while (i < input.length) {
    const match = tryMatchInlineMark(input, i);
    if (match) {
      flush();
      out.push(match.html);
      i += match.consumed;
      continue;
    }
    buffer += input[i];
    i += 1;
  }
  flush();
  return out.join("");
}

interface InlineMarkMatch {
  html: string;
  consumed: number;
}

function tryMatchInlineMark(input: string, start: number): InlineMarkMatch | null {
  // Order matters: longer delimiters first so `**` isn't misread as `*`.
  return (
    matchInlineDelimiter(input, start, "**", "**", "strong") ||
    matchInlineDelimiter(input, start, "~~", "~~", "s") ||
    matchInlineDelimiter(input, start, "*", "*", "em") ||
    matchInlineDelimiter(input, start, "`", "`", "code") ||
    matchInlineUnderline(input, start) ||
    matchInlineHighlight(input, start) ||
    matchInlineLink(input, start)
  );
}

function matchInlineDelimiter(
  input: string,
  start: number,
  open: string,
  close: string,
  tag: string,
): InlineMarkMatch | null {
  if (!input.startsWith(open, start)) return null;
  const contentStart = start + open.length;
  const closeIdx = input.indexOf(close, contentStart);
  if (closeIdx === -1) return null;
  if (closeIdx === contentStart) return null;
  const inner = input.slice(contentStart, closeIdx);
  // Recurse so nested marks (e.g. `**bold *and italic***`) work.
  const rendered = tag === "code" ? escapeHtml(inner) : renderInlineMarks(inner);
  return {
    html: `<${tag}>${rendered}</${tag}>`,
    consumed: closeIdx + close.length - start,
  };
}

function matchInlineUnderline(input: string, start: number): InlineMarkMatch | null {
  const open = "<u>";
  const close = "</u>";
  if (!input.startsWith(open, start)) return null;
  const closeIdx = input.indexOf(close, start + open.length);
  if (closeIdx === -1) return null;
  const inner = input.slice(start + open.length, closeIdx);
  return {
    html: `<u>${renderInlineMarks(inner)}</u>`,
    consumed: closeIdx + close.length - start,
  };
}

function matchInlineHighlight(input: string, start: number): InlineMarkMatch | null {
  const tagMatch = /^<mark(\s+data-color="([^"]*)")?>/.exec(input.slice(start));
  if (!tagMatch) return null;
  const openLen = tagMatch[0].length;
  const closeIdx = input.indexOf("</mark>", start + openLen);
  if (closeIdx === -1) return null;
  const colorAttr = tagMatch[2] ? ` data-color="${escapeHtml(tagMatch[2])}"` : "";
  const inner = input.slice(start + openLen, closeIdx);
  return {
    html: `<mark${colorAttr}>${renderInlineMarks(inner)}</mark>`,
    consumed: closeIdx + "</mark>".length - start,
  };
}

function matchInlineLink(input: string, start: number): InlineMarkMatch | null {
  if (input[start] !== "[") return null;
  const closeBracket = input.indexOf("]", start + 1);
  if (closeBracket === -1) return null;
  if (input[closeBracket + 1] !== "(") return null;
  const closeParen = input.indexOf(")", closeBracket + 2);
  if (closeParen === -1) return null;
  const text = input.slice(start + 1, closeBracket);
  const href = input.slice(closeBracket + 2, closeParen);
  if (!text) return null;
  return {
    html: `<a href="${escapeHtml(href)}">${renderInlineMarks(text)}</a>`,
    consumed: closeParen + 1 - start,
  };
}
