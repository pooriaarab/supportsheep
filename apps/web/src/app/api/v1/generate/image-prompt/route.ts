/**
 * AI Image Prompt Generation API
 *
 * POST /api/v1/generate/image-prompt
 * Returns a GPT-written image prompt without generating or uploading an image.
 * Used to pre-populate the generate-image dialog for user editing.
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { generateImagePromptSchema } from "@/lib/schemas";
import { generateImagePrompt } from "@/lib/ai/generate-image";
import { getArticleBySlug } from "@/lib/articles/repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

export const POST = createApiHandler({
  auth: "user",
  input: generateImagePromptSchema,
  audit: "generate_image_prompt",
  handler: async ({ body }) => {
    let title = body.title ?? "";
    let excerpt = body.excerpt ?? "";
    let category = body.category ?? "";

    if (body.slug) {
      const article = await getArticleBySlug(DEFAULT_BLOG_ID, body.slug);

      if (!article) {
        return NextResponse.json(
          { error: `Article not found: ${body.slug}` },
          { status: 404 },
        );
      }

      title = title || article.title || "";
      excerpt = excerpt || article.excerpt || "";
      category = category || article.category || article.primaryCategory || "";
    }

    if (!title) {
      return NextResponse.json(
        { error: "title is required when slug is not provided" },
        { status: 400 },
      );
    }

    const prompt = await generateImagePrompt({ title, excerpt, category });
    return NextResponse.json({ prompt });
  },
});
