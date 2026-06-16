/**
 * WordPress WXR XML Import Parser and Importer
 *
 * Parses WordPress export files (WXR format) and imports posts
 * into the D1 articles collection.
 */

import "server-only";

import { createLogger } from "@/lib/logger";
import { calculateSeoScore } from "@/lib/seo/scoring";
import { getBlogConfig } from "@/lib/blog-config";
import { buildArticlePaths, getPermalinkSettings } from "@/lib/permalinks";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";
import type { PostType } from "@repo/types";
import {
  getImport,
  updateImport,
} from "@/lib/import/imports-repository";
import {
  getArticleByWordPressPostId,
  getArticleBySlug,
  upsertArticleForImport,
} from "@/lib/articles/repository";
import { createMedia } from "@/lib/media/repository";
import { getMediaBucket } from "@/lib/media/bucket";
import {
  listCategories,
  createCategory,
} from "@/lib/categories/repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";

const log = createLogger("lib:import:wordpress");

export interface WordPressPost {
  wordpressPostId: string;
  sourceUrl: string;
  sourcePath: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  categories: string[];
  tags: string[];
  featuredImage: string;
  publishDate: string;
  modifiedDate: string;
  status: "draft" | "published";
  author: string;
  focusKeyword: string;
  metaTitle: string;
  metaDescription: string;
}

/**
 * Parse WordPress WXR XML content into structured post objects.
 * Uses regex-based parsing to avoid heavy XML library dependencies.
 */
export function parseWordPressXml(xmlContent: string): WordPressPost[] {
  const posts: WordPressPost[] = [];

  // First pass: build attachment ID → URL map for resolving featured images
  const attachmentMap = new Map<string, string>();
  const attachmentRegex = /<item>([\s\S]*?)<\/item>/g;
  let attachMatch: RegExpExecArray | null;

  while ((attachMatch = attachmentRegex.exec(xmlContent)) !== null) {
    const item = attachMatch[1];
    if (extractTag(item, "wp:post_type") === "attachment") {
      const postId = extractTag(item, "wp:post_id");
      const url =
        extractCdata(item, "wp:attachment_url") ||
        extractTag(item, "wp:attachment_url");
      if (postId && url) attachmentMap.set(postId, url);
    }
  }

  log.info(`Built attachment map with ${attachmentMap.size} entries`);

  // Second pass: extract posts
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xmlContent)) !== null) {
    const item = match[1];

    // Only process posts (not pages, attachments, etc.)
    const postType = extractTag(item, "wp:post_type");
    if (postType !== "POST") continue;

    const wpStatus = extractTag(item, "wp:status");

    // Extract CDATA content for body and excerpt
    const rawBody = extractCdata(item, "content:encoded");
    const excerpt = extractCdata(item, "excerpt:encoded");

    const title = extractTag(item, "title") || "Untitled";
    const wordpressPostId = extractTag(item, "wp:post_id");
    const sourceUrl = extractTag(item, "link");
    const sourcePath = extractPathFromUrl(sourceUrl);
    const slug = extractTag(item, "wp:post_name") || generateSlug(title);
    // Prefer the _gmt variants — wp:post_date is site-local time.
    // WordPress writes "0000-00-00 00:00:00" for drafts or mis-timezoned posts;
    // treat that sentinel as absent so the local variant is used.
    const publishDate =
      nonSentinelDate(extractTag(item, "wp:post_date_gmt")) ||
      extractTag(item, "wp:post_date") ||
      new Date().toISOString();
    const modifiedDate =
      nonSentinelDate(extractTag(item, "wp:post_modified_gmt")) ||
      extractTag(item, "wp:post_modified") ||
      publishDate;

    // Extract author from dc:creator
    const author =
      extractCdata(item, "dc:creator") || extractTag(item, "dc:creator") || "";

    // Extract categories and tags
    const categories = extractCategories(item, "category");
    const tags = extractCategories(item, "post_tag");

    // Resolve featured image: _thumbnail_id is a WP post ID, not a URL
    const thumbnailId = extractMetaValue(item, "_thumbnail_id");
    const featuredImage = thumbnailId
      ? attachmentMap.get(thumbnailId) || ""
      : "";

    // Extract Yoast SEO metadata
    const focusKeyword = extractMetaValue(item, "_yoast_wpseo_focuskw") || "";
    const metaTitle = extractMetaValue(item, "_yoast_wpseo_title") || "";
    const metaDescription =
      extractMetaValue(item, "_yoast_wpseo_metadesc") || "";

    // Detect BlockNote JSON vs HTML content and convert accordingly
    const body = isBlockNoteJson(rawBody)
      ? convertBlockNoteToHtml(rawBody)
      : cleanWordPressHtml(rawBody);

    posts.push({
      wordpressPostId,
      sourceUrl,
      sourcePath,
      title,
      slug,
      body,
      excerpt: stripHtml(excerpt),
      categories,
      tags,
      featuredImage,
      publishDate,
      modifiedDate,
      status: wpStatus === "publish" ? "published" : "draft",
      author,
      focusKeyword,
      metaTitle,
      metaDescription,
    });
  }

  return posts;
}

export function selectImportMatch(input: {
  existingByWordPressId: { id: string } | null;
  existingBySlug: { id: string; wordpressPostId?: string | null } | null;
}):
  | { kind: "create" }
  | { kind: "update"; targetId: string }
  | { kind: "conflict"; targetId: string } {
  if (input.existingByWordPressId) {
    return { kind: "update", targetId: input.existingByWordPressId.id };
  }

  if (input.existingBySlug) {
    if (
      input.existingBySlug.wordpressPostId &&
      input.existingBySlug.wordpressPostId !== null
    ) {
      return { kind: "conflict", targetId: input.existingBySlug.id };
    }

    return { kind: "update", targetId: input.existingBySlug.id };
  }

  return { kind: "create" };
}

export function findMissingPublishedSlugs(input: {
  xmlPublishedSlugs: string[];
  firestoreSlugs: string[];
}): string[] {
  const firestoreSlugSet = new Set(input.firestoreSlugs);
  return input.xmlPublishedSlugs.filter((slug) => !firestoreSlugSet.has(slug));
}

/**
 * Import parsed WordPress posts into D1.
 * Updates import job progress as it goes.
 */
export async function importWordPressPosts(
  posts: WordPressPost[],
  importId: string,
  blogId: string = DEFAULT_blog_id,
): Promise<void> {
  const failedPosts: Array<{ slug: string; error: string }> = [];
  let importedCount = 0;
  let rehostedImages = 0;
  const permalinkSettings = getPermalinkSettings(await getBlogConfig());

  // Pre-create all unique categories upfront
  const allCategories = new Set(posts.flatMap((p) => p.categories));
  for (const category of allCategories) {
    await ensureCategory(category, blogId);
  }

  for (const post of posts) {
    try {
      // Check if import was cancelled
      const job = await getImport(blogId, importId);
      if (job?.status === "failed") {
        log.info(`Import ${importId} was cancelled, stopping`);
        return;
      }

      const existingByWordPressId = post.wordpressPostId
        ? await getArticleByWordPressPostId(blogId, post.wordpressPostId)
        : null;

      const existingBySlug = await getArticleBySlug(blogId, post.slug);

      const match = selectImportMatch({
        existingByWordPressId: existingByWordPressId
          ? { id: existingByWordPressId.id }
          : null,
        existingBySlug: existingBySlug
          ? {
              id: existingBySlug.id,
              wordpressPostId: existingBySlug.wordpressPostId ?? null,
            }
          : null,
      });

      if (match.kind === "conflict") {
        throw new Error(
          `Slug ${post.slug} is already linked to another WordPress post`,
        );
      }

      const existingArticle =
        existingByWordPressId ?? existingBySlug ?? null;

      // Re-host external images into R2 (non-fatal: a missing or failing
      // media bucket simply leaves the original external URL in place).
      let featuredImage = existingArticle?.featuredImage?.url || post.featuredImage;
      let body = existingArticle?.body || post.body;

      if (match.kind === "create") {
        if (post.featuredImage) {
          const rehosted = await rehostImage(post.featuredImage);
          if (rehosted) {
            featuredImage = rehosted.url;
            await saveToMediaCollection(rehosted, blogId);
            rehostedImages++;
          }
        }

        body = await rehostBodyImages(post.body, blogId);
        const bodyImgCount =
          body !== post.body
            ? [
                ...post.body.matchAll(
                  /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi,
                ),
              ].length
            : 0;
        rehostedImages += bodyImgCount;
      }

      body = sanitizeArticleHtml(body);
      const wordCount = body.split(/\s+/).filter(Boolean).length;

      const postType: PostType = "blog_post";
      const metaTitle = post.metaTitle || post.title;
      const metaDescription =
        post.metaDescription || post.excerpt.slice(0, 160);
      const keywords = post.focusKeyword
        ? [post.focusKeyword, ...post.tags.slice(0, 9)]
        : post.tags.slice(0, 10);

      const seoResult = calculateSeoScore({
        body,
        metaTitle,
        metaDescription,
        keywords,
        postType,
      });

      const canonicalPaths = buildArticlePaths(
        {
          slug: post.slug,
          category: post.categories[0] || "uncategorized",
        },
        permalinkSettings,
      );

      const now = new Date().toISOString();
      const parsedPublishDate = parseWordPressDate(post.publishDate);
      const parsedModifiedDate = parseWordPressDate(post.modifiedDate);

      const articleData = {
        blogId,
        wordpressPostId: post.wordpressPostId,
        sourceUrl: post.sourceUrl || null,
        sourcePath: post.sourcePath || null,
        title: post.title,
        slug: post.slug,
        canonicalPath: canonicalPaths.canonicalPath,
        legacyPaths: canonicalPaths.legacyPaths,
        body,
        draftBody: body,
        excerpt: post.excerpt,
        summary: "",
        status: post.status,
        scheduledAt: null,
        publishedAt:
          post.status === "published" ? (parsedPublishDate ?? now) : null,
        postType,
        category: post.categories[0] || "",
        tags: post.tags,
        author: post.author,
        featuredImage: { url: featuredImage, alt: "" },
        ogImage: featuredImage,
        metaTitle,
        metaDescription,
        keywords,
        seoScore: seoResult.total,
        internalLinks: [] as { anchor: string; url: string }[],
        externalLinks: [] as { anchor: string; url: string }[],
        versions: [],
        generatedBy: null,
        generationMeta: null,
        wordCount,
        readingTime: Math.max(1, Math.ceil(wordCount / 200)),
        createdAt: parsedPublishDate ?? now,
        updatedAt: parsedModifiedDate ?? now,
      };

      await upsertArticleForImport(
        blogId,
        match.kind === "create" ? null : match.targetId,
        articleData,
      );

      importedCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      log.error(`Failed to import post: ${post.slug}`, { error: message });
      failedPosts.push({ slug: post.slug, error: message });
    }

    // Update progress every 5 posts
    if ((importedCount + failedPosts.length) % 5 === 0) {
      await updateImport(blogId, importId, {
        importedPosts: importedCount,
        failedPosts,
      });
    }
  }

  // Final update
  await updateImport(blogId, importId, {
    status: failedPosts.length === posts.length ? "failed" : "completed",
    importedPosts: importedCount,
    rehostedImages,
    failedPosts,
    completedAt: Date.now(),
  });
}

/* -------------------------------------------------------------------------- */
/* Image Re-hosting                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Download an image from a URL and upload it into the R2 media bucket.
 * Returns null on failure (non-fatal — caller keeps original URL). A
 * missing/unconfigured media bucket throws inside `getMediaBucket()`,
 * which the try/catch turns into the same null fallback.
 */
async function rehostImage(imageUrl: string): Promise<{
  url: string;
  filename: string;
  contentType: string;
  size: number;
  storagePath: string;
} | null> {
  if (!imageUrl) return null;

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/jpeg";

    const urlPath = new URL(imageUrl).pathname;
    const filename = urlPath.split("/").pop() || `imported-${Date.now()}.jpg`;
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

    const key = `media/imported/${Date.now()}-${sanitized}`;
    await getMediaBucket().put(
      key,
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer,
      { httpMetadata: { contentType } },
    );

    return {
      url: `/api/v1/media/file/${key}`,
      filename: sanitized,
      contentType,
      size: buffer.length,
      storagePath: key,
    };
  } catch {
    // Non-fatal: keep original URL
    return null;
  }
}

/**
 * Save a re-hosted image to the D1 media table
 * so it appears in the media browser.
 */
async function saveToMediaCollection(
  result: {
    url: string;
    filename: string;
    contentType: string;
    size: number;
    storagePath: string;
  },
  blogId: string,
): Promise<void> {
  try {
    await createMedia(blogId, {
      filename: result.filename,
      url: result.url,
      storagePath: result.storagePath,
      mimeType: result.contentType,
      size: result.size,
      width: 0,
      height: 0,
      alt: "",
      uploadedBy: "",
    });
  } catch {
    // Non-fatal
  }
}

/**
 * Scan HTML for externally-hosted image URLs and replace them
 * with re-hosted R2 media URLs.
 */
async function rehostBodyImages(
  html: string,
  blogId: string,
): Promise<string> {
  if (!html) return html;

  const imgRegex = /<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi;
  const matches = [...html.matchAll(imgRegex)];

  let result = html;
  for (const match of matches) {
    const originalUrl = match[1];
    const rehosted = await rehostImage(originalUrl);
    if (rehosted) {
      result = result.split(originalUrl).join(rehosted.url);
      await saveToMediaCollection(rehosted, blogId);
    }
    // Rate limit between downloads
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function nonSentinelDate(raw: string): string {
  return raw === "0000-00-00 00:00:00" ? "" : raw;
}

/**
 * Parse a WordPress date string (e.g. "2025-11-19 00:22:52" or ISO 8601)
 * into an ISO-8601 string. Returns null on failure so callers can fall
 * back to the current time.
 */
function parseWordPressDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // WordPress exports dates as "YYYY-MM-DD HH:MM:SS" (space, no timezone).
  // Treat space-separated form as UTC by replacing the space with "T" and
  // appending "Z"; pass through anything already in ISO form.
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? `${raw.replace(" ", "T")}Z`
    : raw;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    log.warn("Failed to parse WordPress date, falling back to server time", {
      raw,
    });
    return null;
  }
  return date.toISOString();
}

function extractTag(xml: string, tagName: string): string {
  // Handle both <tag>value</tag> and <tag><![CDATA[value]]></tag>
  const regex = new RegExp(
    `<${escapeRegex(tagName)}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</${escapeRegex(tagName)}>`,
  );
  const m = regex.exec(xml);
  return m ? (m[1] ?? m[2] ?? "").trim() : "";
}

function extractCdata(xml: string, tagName: string): string {
  const regex = new RegExp(
    `<${escapeRegex(tagName)}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${escapeRegex(tagName)}>`,
  );
  const m = regex.exec(xml);
  return m ? m[1].trim() : extractTag(xml, tagName);
}

function extractCategories(xml: string, domain: string): string[] {
  const categories: string[] = [];
  const regex = new RegExp(
    `<category domain="${escapeRegex(domain)}"[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></category>`,
    "g",
  );
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    const value = m[1].trim();
    if (value) categories.push(value);
  }
  return categories;
}

function extractMetaValue(xml: string, metaKey: string): string {
  // Meta keys may be wrapped in CDATA or plain text:
  //   <wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key>
  //   <wp:meta_key>_thumbnail_id</wp:meta_key>
  const keyPattern = `<wp:meta_key>(?:<!\\[CDATA\\[)?${escapeRegex(metaKey)}(?:\\]\\]>)?</wp:meta_key>`;
  const valuePattern = `<wp:meta_value>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))</wp:meta_value>`;
  const regex = new RegExp(`${keyPattern}\\s*${valuePattern}`);
  const m = regex.exec(xml);
  return m ? (m[1] ?? m[2] ?? "").trim() : "";
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractPathFromUrl(url: string): string {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "";
  }
}

/** Check if content is BlockNote JSON (starts with a JSON array) */
function isBlockNoteJson(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed.startsWith("[")) return false;
  try {
    const parsed = JSON.parse(trimmed);
    return (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      typeof parsed[0] === "object" &&
      "type" in parsed[0]
    );
  } catch {
    return false;
  }
}

interface BlockNoteInline {
  type: string;
  text?: string;
  styles?: Record<string, boolean>;
  href?: string;
  content?: BlockNoteInline[];
}

interface BlockNoteBlock {
  type: string;
  props?: Record<string, unknown>;
  content?:
    | BlockNoteInline[]
    | {
        type: string;
        rows?: Array<{ cells: Array<{ content: BlockNoteInline[] }> }>;
      };
  children?: BlockNoteBlock[];
}

/** Convert BlockNote JSON blocks to HTML */
function convertBlockNoteToHtml(jsonContent: string): string {
  let blocks: BlockNoteBlock[];
  try {
    blocks = JSON.parse(jsonContent.trim()) as BlockNoteBlock[];
  } catch (err) {
    log.error("Failed to parse BlockNote JSON, returning raw content", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
    return jsonContent;
  }

  const htmlParts: string[] = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];

    // Collect consecutive list items into proper list elements
    if (block.type === "bulletListItem") {
      const items: string[] = [];
      while (i < blocks.length && blocks[i].type === "bulletListItem") {
        items.push(`<li>${renderInlineContent(blocks[i].content)}</li>`);
        i++;
      }
      htmlParts.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    if (block.type === "numberedListItem") {
      const items: string[] = [];
      while (i < blocks.length && blocks[i].type === "numberedListItem") {
        items.push(`<li>${renderInlineContent(blocks[i].content)}</li>`);
        i++;
      }
      htmlParts.push(`<ol>${items.join("")}</ol>`);
      continue;
    }

    htmlParts.push(renderBlock(block));
    i++;
  }

  return htmlParts.filter(Boolean).join("\n");
}

/** Render a single BlockNote block to HTML */
function renderBlock(block: BlockNoteBlock): string {
  switch (block.type) {
    case "paragraph":
      return `<p>${renderInlineContent(block.content)}</p>`;

    case "heading": {
      const level = (block.props?.level as number) || 2;
      const tag = `h${Math.min(Math.max(level, 1), 6)}`;
      return `<${tag}>${renderInlineContent(block.content)}</${tag}>`;
    }

    case "image": {
      const url = (block.props?.url as string) || "";
      const caption = (block.props?.caption as string) || "";
      if (!url) return "";
      return caption
        ? `<figure><img src="${url}" alt="${escapeHtml(caption)}" /><figcaption>${escapeHtml(caption)}</figcaption></figure>`
        : `<img src="${url}" alt="" />`;
    }

    case "table": {
      const tableContent = block.content as
        | {
            type: string;
            rows?: Array<{ cells: Array<{ content: BlockNoteInline[] }> }>;
          }
        | undefined;
      if (
        !tableContent ||
        tableContent.type !== "tableContent" ||
        !tableContent.rows
      )
        return "";
      const rows = tableContent.rows
        .map((row) => {
          const cells = row.cells
            .map((cell) => `<td>${renderInlineArray(cell.content)}</td>`)
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");
      return `<table>${rows}</table>`;
    }

    case "codeBlock": {
      const text = renderInlineContent(block.content);
      return `<pre><code>${text}</code></pre>`;
    }

    case "blockquote":
      return `<blockquote>${renderInlineContent(block.content)}</blockquote>`;

    default:
      // Fallback: render any inline content as a paragraph
      return renderInlineContent(block.content)
        ? `<p>${renderInlineContent(block.content)}</p>`
        : "";
  }
}

/** Render block content (may be inline array or structured content) */
function renderInlineContent(
  content:
    | BlockNoteInline[]
    | {
        type: string;
        rows?: Array<{ cells: Array<{ content: BlockNoteInline[] }> }>;
      }
    | undefined,
): string {
  if (!content) return "";
  if (Array.isArray(content)) return renderInlineArray(content);
  return "";
}

/** Render an array of inline elements to HTML */
function renderInlineArray(items: BlockNoteInline[]): string {
  return items
    .map((item) => {
      if (item.type === "text") {
        let html = escapeHtml(item.text || "");
        if (item.styles?.bold) html = `<strong>${html}</strong>`;
        if (item.styles?.italic) html = `<em>${html}</em>`;
        if (item.styles?.underline) html = `<u>${html}</u>`;
        if (item.styles?.strikethrough) html = `<s>${html}</s>`;
        if (item.styles?.code) html = `<code>${html}</code>`;
        return html;
      }
      if (item.type === "link") {
        const innerHtml = item.content
          ? renderInlineArray(item.content)
          : escapeHtml(item.text || "");
        return `<a href="${escapeHtml(item.href || "")}">${innerHtml}</a>`;
      }
      return escapeHtml(item.text || "");
    })
    .join("");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Remove WordPress shortcodes and fix common HTML issues */
function cleanWordPressHtml(html: string): string {
  return (
    html
      // Remove WordPress shortcodes like [gallery ids="1,2,3"]
      .replace(/\[[\w-]+(?:\s[^\]]*?)?\](?:[\s\S]*?\[\/[\w-]+\])?/g, "")
      // Remove empty paragraphs
      .replace(/<p>\s*<\/p>/g, "")
      // Fix double line breaks
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/** Strip all HTML tags from a string */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function ensureCategory(
  categoryName: string,
  blogId: string,
): Promise<void> {
  const slug = categoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  const existing = await listCategories(blogId);
  if (existing.some((c) => c.slug === slug)) return;

  const result = await createCategory(blogId, {
    slug,
    displayName: categoryName,
    icon: "",
    description: "Imported from WordPress",
  });

  // Ignore duplicate errors — concurrent imports may race
  if (!result.ok && result.reason !== "duplicate") {
    log.warn(`Failed to create category: ${categoryName}`, {
      reason: result.reason,
    });
  }
}
