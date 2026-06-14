/**
 * Keyword-to-Post Generation API
 *
 * POST /api/v1/generate/keyword
 * Generates a full article from a single keyword using the generation pipeline.
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { generateKeywordSchema } from "@/lib/schemas";
import { generateFromKeyword } from "@/lib/generation/pipeline";
import type { AIProvider } from "@/lib/ai/providers";

export const POST = createApiHandler({
  auth: "user",
  input: generateKeywordSchema,
  audit: "generate_keyword",
  handler: async ({ body, blogId }) => {
    const result = await generateFromKeyword({
      keyword: body.keyword,
      postType: body.postType,
      contextTagId: body.contextTagId,
      provider: body.provider as AIProvider,
      scheduledAt: body.scheduledAt,
      generatedBy: "keyword",
      blogId,
    });

    return NextResponse.json(
      {
        slug: result.slug,
        title: result.title,
        articleId: result.articleId,
        redirectUrl: `/posts/${result.slug}/edit`,
      },
      { status: 201 },
    );
  },
});
