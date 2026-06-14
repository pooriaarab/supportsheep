import "server-only";

import { z } from "zod";
import type { Article } from "@repo/types";

type WebhookProviderHint = "generic" | "outrank";

type NormalizedWebhookArticle = {
  title: string;
  body: string;
  excerpt: string;
  metaDescription: string;
  tags: string[];
  slugHint: string;
  source: NonNullable<Article["source"]>;
};

const outrankArticleSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Article title is required"),
  content_markdown: z.string().optional(),
  content_html: z.string().optional(),
  meta_description: z.string().optional(),
  created_at: z.string().optional(),
  image_url: z.string().optional(),
  slug: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const outrankPayloadSchema = z.object({
  event_type: z.literal("publish_articles"),
  timestamp: z.string().min(1, "Timestamp is required"),
  data: z.object({
    articles: z.array(outrankArticleSchema).min(1, "At least one article is required"),
  }),
});

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function markdownToParagraphHtml(markdown: string) {
  return `<p>${escapeHtml(markdown)}</p>`;
}

export function normalizeArticleWebhookPayload({
  providerHint,
  integrationId,
  payload,
}: {
  providerHint: WebhookProviderHint;
  integrationId: string;
  payload: unknown;
}): NormalizedWebhookArticle[] {
  const parsed = outrankPayloadSchema.parse(payload);

  return parsed.data.articles.map((article) => ({
    title: article.title,
    body:
      article.content_html?.trim() ||
      markdownToParagraphHtml(article.content_markdown?.trim() || ""),
    excerpt: article.meta_description || "",
    metaDescription: article.meta_description || "",
    tags: article.tags || [],
    slugHint: article.slug || article.title,
    source: {
      kind: "webhook",
      integrationId,
      provider: providerHint,
      externalArticleId: article.id || null,
      receivedAt: parsed.timestamp,
    },
  }));
}

export type { NormalizedWebhookArticle, WebhookProviderHint };
