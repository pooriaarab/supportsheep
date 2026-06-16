import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIntegration: vi.fn(),
  createArticle: vi.fn(),
  slugExists: vi.fn(async () => false),
  normalizePayload: vi.fn(),
  buildArticle: vi.fn(),
}));

vi.mock("@/lib/integrations/repository", () => ({
  getIntegration: mocks.getIntegration,
}));

vi.mock("@/lib/articles/repository", () => ({
  createArticle: mocks.createArticle,
  slugExists: mocks.slugExists,
}));

vi.mock("@/lib/webhooks/article-webhook", () => ({
  normalizeArticleWebhookPayload: mocks.normalizePayload,
}));

vi.mock("@/lib/articles/create-article-record", () => ({
  buildArticleCreateDocument: mocks.buildArticle,
}));

import { POST } from "@/app/api/v1/integrations/webhooks/[id]/route";

const webhookRow = {
  id: "integration-1",
  blogId: "default",
  type: "webhook",
  status: "connected",
  name: "Test Webhook",
  description: "",
  icon: "W",
  config: {
    mode: "article_receiver",
    endpointPath: "/api/v1/integrations/webhooks/integration-1",
    endpointUrl: "https://supportsheep.com/api/v1/integrations/webhooks/integration-1",
    authType: "bearer",
    token: "secret-token",
    tokenPreview: "••••oken",
    providerHint: "outrank",
  },
  connectedAt: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe("POST /api/v1/integrations/webhooks/[id]", () => {
  beforeEach(() => {
    mocks.getIntegration.mockReset();
    mocks.createArticle.mockReset();
    mocks.slugExists.mockReset();
    mocks.slugExists.mockResolvedValue(false);
    mocks.normalizePayload.mockReset();
    mocks.buildArticle.mockReset();
  });

  it("returns 401 when the bearer token is missing", async () => {
    mocks.getIntegration.mockResolvedValue(webhookRow);

    const response = await POST(
      new Request(
        "https://supportsheep.com/api/v1/integrations/webhooks/integration-1",
        {
          method: "Article",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({}),
        },
      ) as never,
      { params: Promise.resolve({ id: "integration-1" }) } as never,
    );

    expect(response.status).toBe(401);
    expect(mocks.normalizePayload).not.toHaveBeenCalled();
  });

  it("returns 403 when the webhook integration is disconnected", async () => {
    mocks.getIntegration.mockResolvedValue({ ...webhookRow, status: "disconnected" });

    const response = await POST(
      new Request(
        "https://supportsheep.com/api/v1/integrations/webhooks/integration-1",
        {
          method: "Article",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer secret-token",
          },
          body: JSON.stringify({}),
        },
      ) as never,
      { params: Promise.resolve({ id: "integration-1" }) } as never,
    );

    expect(response.status).toBe(403);
    expect(mocks.normalizePayload).not.toHaveBeenCalled();
  });

  it("creates published articles for each normalized payload article", async () => {
    mocks.getIntegration.mockResolvedValue(webhookRow);
    mocks.normalizePayload.mockReturnValue([
      {
        title: "Post One",
        body: "<p>One</p>",
        excerpt: "One",
        metaDescription: "One",
        tags: ["one"],
        slugHint: "post-one",
        source: {
          kind: "webhook",
          integrationId: "integration-1",
          provider: "outrank",
          externalArticleId: "ext-1",
          receivedAt: "2026-04-23T00:00:00.000Z",
        },
      },
      {
        title: "Post Two",
        body: "<p>Two</p>",
        excerpt: "Two",
        metaDescription: "Two",
        tags: ["two"],
        slugHint: "post-two",
        source: {
          kind: "webhook",
          integrationId: "integration-1",
          provider: "outrank",
          externalArticleId: "ext-2",
          receivedAt: "2026-04-23T00:00:00.000Z",
        },
      },
    ]);
    mocks.buildArticle
      .mockResolvedValueOnce({ slug: "post-one", title: "Post One" })
      .mockResolvedValueOnce({ slug: "post-two", title: "Post Two" });
    mocks.createArticle.mockResolvedValue({ ok: true, article: { id: "doc-1" } });

    const response = await POST(
      new Request(
        "https://supportsheep.com/api/v1/integrations/webhooks/integration-1",
        {
          method: "Article",
          headers: {
            "content-type": "application/json",
            authorization: "Bearer secret-token",
          },
          body: JSON.stringify({
            event_type: "publish_articles",
            data: { articles: [{ title: "unused because mocked" }] },
          }),
        },
      ) as never,
      { params: Promise.resolve({ id: "integration-1" }) } as never,
    );

    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.normalizePayload).toHaveBeenCalledWith({
      providerHint: "outrank",
      integrationId: "integration-1",
      payload: {
        event_type: "publish_articles",
        data: { articles: [{ title: "unused because mocked" }] },
      },
    });
    expect(mocks.buildArticle).toHaveBeenCalledTimes(2);
    expect(mocks.createArticle).toHaveBeenCalledTimes(2);
    expect(json).toEqual({
      received: 2,
      created: 2,
      slugs: ["post-one", "post-two"],
    });
  });
});
