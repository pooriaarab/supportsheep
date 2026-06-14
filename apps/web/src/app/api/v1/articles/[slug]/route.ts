/**
 * Single Article API
 *
 * GET /api/v1/articles/:slug -- Get article by slug
 * PATCH /api/v1/articles/:slug -- Update article (action-based)
 * DELETE /api/v1/articles/:slug -- Delete article
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";
import { updateArticleSchema } from "@/lib/schemas";
import type { Article } from "@repo/types";
import type { z } from "zod";
import { getBlogConfig } from "@/lib/blog-config";
import { preparePublishedArticleUpdate } from "@/lib/article-publish";
import { sendGuestPublishedEmail } from "@/lib/interviews/send-guest-published-email";
import { createLogger } from "@/lib/logger";
import {
  getArticleBySlug,
  updateArticleBySlug,
  deleteArticleBySlug,
} from "@/lib/articles/repository";

const log = createLogger("api:articles:slug");

/**
 * GET /api/v1/articles/:slug
 */
export const GET = createApiHandler<unknown, { slug: string }>({
  auth: "user",
  handler: async ({ params, blogId }) => {
    const article = await getArticleBySlug(blogId, params.slug);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    return NextResponse.json(article);
  },
});

/**
 * PATCH /api/v1/articles/:slug
 * Action-based updates: save-draft, publish, unpublish, schedule, update-meta
 */
export const PATCH = createApiHandler<
  z.infer<typeof updateArticleSchema>,
  { slug: string }
>({
  auth: "user",
  input: updateArticleSchema,
  audit: "update_article",
  handler: async ({ body, params, blogId }) => {
    const article = await getArticleBySlug(blogId, params.slug);
    if (!article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    let patch: Partial<Article> = {};

    switch (body.action) {
      case "save-draft": {
        const existingVersions = Array.isArray(article.versions) ? article.versions : [];
        const sanitizedDraft = sanitizeArticleHtml(body.draftBody);
        patch = {
          draftBody: sanitizedDraft,
          versions: [
            ...existingVersions,
            {
              body: sanitizedDraft,
              savedAt: new Date().toISOString(),
              note: body.note || "",
            },
          ],
        };
        break;
      }
      case "publish": {
        const config = await getBlogConfig();
        const prepared = await preparePublishedArticleUpdate({
          article: {
            slug: article.slug,
            category: article.category || "",
            canonicalPath: article.canonicalPath,
            body: article.body || "",
            draftBody: article.draftBody || "",
            submissionStatus: article.submissionStatus,
          },
          config,
        });
        patch = {
          body: prepared.body,
          status: "published",
          publishedAt: new Date().toISOString(),
          wordCount: prepared.wordCount,
          readingTime: prepared.readingTime,
          submissionStatus: prepared.submissionStatus,
        };

        if (article.generatedBy === "interview" && article.guestAttribution?.email) {
          try {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://supportsheep.com";
            await sendGuestPublishedEmail({
              to: article.guestAttribution.email,
              guestName: article.guestAttribution.name ?? null,
              articleTitle: article.title,
              articleUrl: `${baseUrl}/${article.slug}`,
            });
          } catch (error) {
            log.error("Failed to send article published email to guest", { error });
          }
        }
        break;
      }
      case "unpublish": {
        patch = { status: "draft" };
        break;
      }
      case "schedule": {
        patch = {
          status: "scheduled",
          scheduledAt: body.scheduledAt,
        };
        break;
      }
      case "update-meta": {
        const { action: _action, ...meta } = body;
        const updates: Partial<Article> = {};
        for (const [key, value] of Object.entries(meta)) {
          if (value !== undefined) {
            (updates as Record<string, unknown>)[key] = value;
          }
        }

        if (updates.slug && updates.slug !== article.slug) {
          if (article.status !== "draft") {
            return NextResponse.json(
              { error: "Slug can only be changed while an article is a draft" },
              { status: 400 },
            );
          }
          const existing = await getArticleBySlug(blogId, updates.slug as string);
          if (existing && existing.id !== article.id) {
            return NextResponse.json(
              { error: "Article slug already exists" },
              { status: 409 },
            );
          }
        } else if (updates.title) {
          const newSlug = String(updates.title)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 80);
          if (article.status === "draft") {
            const existing = await getArticleBySlug(blogId, newSlug);
            if (!existing || existing.id === article.id) {
              updates.slug = newSlug;
            }
          }
        }

        patch = updates;
        break;
      }
    }

    const updated = await updateArticleBySlug(blogId, params.slug, patch);
    if (!updated) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  },
});

/**
 * DELETE /api/v1/articles/:slug
 */
export const DELETE = createApiHandler<unknown, { slug: string }>({
  auth: "user",
  audit: "delete_article",
  handler: async ({ params, blogId }) => {
    const deleted = await deleteArticleBySlug(blogId, params.slug);
    if (!deleted) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  },
});
