/**
 * Bulk Generation API
 *
 * POST /api/v1/generate/bulk
 * Generates articles for multiple keywords sequentially.
 * Returns an array of results (success or failure per keyword).
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { generateBulkSchema } from "@/lib/schemas";
import { generateFromKeyword } from "@/lib/generation/pipeline";
import type { AIProvider } from "@/lib/ai/providers";
import { createLogger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/error-utils";

const log = createLogger("api:generate:bulk");

interface BulkResultItem {
  keyword: string;
  status: "success" | "failed";
  slug?: string;
  title?: string;
  articleId?: string;
  error?: string;
}

export const POST = createApiHandler({
  auth: "user",
  input: generateBulkSchema,
  audit: "generate_bulk",
  handler: async ({ body, blogId }) => {
    const results: BulkResultItem[] = [];

    for (const item of body.items) {
      try {
        const result = await generateFromKeyword({
          keyword: item.keyword,
          postType: item.postType,
          contextTagId: item.contextTagId,
          provider: body.provider as AIProvider,
          generatedBy: "bulk",
          blogId,
        });
        results.push({
          keyword: item.keyword,
          status: "success",
          slug: result.slug,
          title: result.title,
          articleId: result.articleId,
        });
      } catch (error: unknown) {
        log.error("Bulk generation failed for keyword", {
          keyword: item.keyword,
          error: getErrorMessage(error),
        });
        results.push({
          keyword: item.keyword,
          status: "failed",
          error: getErrorMessage(error),
        });
      }
    }

    const successCount = results.filter((r) => r.status === "success").length;

    return NextResponse.json({
      results,
      summary: {
        total: results.length,
        success: successCount,
        failed: results.length - successCount,
      },
    });
  },
});
