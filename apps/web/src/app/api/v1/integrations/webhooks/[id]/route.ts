import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { buildArticleCreateDocument } from "@/lib/articles/create-article-record";
import { createArticle, slugExists } from "@/lib/articles/repository";
import { isWebhookIntegrationConfig } from "@/lib/integrations/webhook-integration";
import { normalizeArticleWebhookPayload } from "@/lib/webhooks/article-webhook";
import { getIntegration } from "@/lib/integrations/repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";

type RouteParams = { id: string };

/**
 * POST /api/v1/integrations/webhooks/:id
 *
 * External webhook receiver — no session available. The integration is looked up
 * by id from D1, scoped to DEFAULT_blog_id (public hostname routing deferred).
 * Articles are written to the D1 `articles` table.
 */
export const POST = createApiHandler<unknown, RouteParams>({
  auth: "none",
  handler: async ({ request, params }) => {
    const row = await getIntegration(DEFAULT_blog_id, params.id);
    if (!row) {
      return NextResponse.json({ error: "Integration not found" }, { status: 404 });
    }

    const config = row.config;

    if (
      row.type !== "webhook" ||
      !isWebhookIntegrationConfig(config)
    ) {
      return NextResponse.json(
        { error: "Integration is not a webhook receiver" },
        { status: 400 },
      );
    }

    if (row.status !== "connected") {
      return NextResponse.json(
        { error: "Integration is not active" },
        { status: 403 },
      );
    }

    const authorization = request.headers.get("authorization");
    const expectedHeader = `Bearer ${config.token}`;
    if (
      !authorization ||
      authorization.length !== expectedHeader.length ||
      !timingSafeEqual(Buffer.from(authorization), Buffer.from(expectedHeader))
    ) {
      return NextResponse.json({ error: "Invalid bearer token" }, { status: 401 });
    }

    const payload = await request.json();
    const normalized = normalizeArticleWebhookPayload({
      providerHint: config.providerHint,
      integrationId: row.id,
      payload,
    });

    const slugs: string[] = [];

    for (const articleInput of normalized) {
      const article = await buildArticleCreateDocument(
        {
          ...articleInput,
          status: "published",
        },
        (slug) => slugExists(DEFAULT_blog_id, slug),
      );

      await createArticle(DEFAULT_blog_id, article);
      slugs.push(article.slug);
    }

    return NextResponse.json({
      received: normalized.length,
      created: slugs.length,
      slugs,
    });
  },
});
