import { describe, expect, it } from "vitest";
import { normalizeArticleWebhookPayload } from "@/lib/webhooks/article-webhook";

describe("normalizeArticleWebhookPayload", () => {
  it("maps an Outrank publish_articles payload into article inputs", () => {
    const result = normalizeArticleWebhookPayload({
      providerHint: "outrank",
      integrationId: "integration-1",
      payload: {
        event_type: "publish_articles",
        timestamp: "2026-04-23T00:00:00.000Z",
        data: {
          articles: [
            {
              id: "ext-1",
              title: "Webhook Post",
              content_html: "<p>Hello world</p>",
              meta_description: "Meta description",
              slug: "webhook-post",
              tags: ["seo", "automation"],
              created_at: "2026-04-22T00:00:00.000Z",
            },
          ],
        },
      },
    });

    expect(result).toEqual([
      expect.objectContaining({
        title: "Webhook Post",
        body: "<p>Hello world</p>",
        excerpt: "Meta description",
        metaDescription: "Meta description",
        tags: ["seo", "automation"],
        slugHint: "webhook-post",
        source: expect.objectContaining({
          kind: "webhook",
          integrationId: "integration-1",
          provider: "outrank",
          externalArticleId: "ext-1",
          receivedAt: "2026-04-23T00:00:00.000Z",
        }),
      }),
    ]);
  });

  it("falls back to escaped markdown when html is absent", () => {
    const result = normalizeArticleWebhookPayload({
      providerHint: "generic",
      integrationId: "integration-2",
      payload: {
        event_type: "publish_articles",
        timestamp: "2026-04-23T00:00:00.000Z",
        data: {
          articles: [
            {
              title: "Markdown Post",
              content_markdown: "Hello <world>",
            },
          ],
        },
      },
    });

    expect(result[0]?.body).toBe("<p>Hello &lt;world&gt;</p>");
  });
});
