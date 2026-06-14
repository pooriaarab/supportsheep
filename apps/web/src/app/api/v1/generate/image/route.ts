/**
 * AI Image Generation API
 *
 * POST /api/v1/generate/image
 * Generates an image using gpt-image-1 from article context or manual title/excerpt.
 * When purpose=featured-image and slug is provided, updates the article's featuredImage.
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { generateImageSchema } from "@/lib/schemas";
import { generateImage } from "@/lib/ai/generate-image";
import {
  getArticleBySlug,
  updateArticleBySlug,
} from "@/lib/articles/repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

export const POST = createApiHandler({
  auth: "user",
  input: generateImageSchema,
  audit: "generate_image",
  handler: async ({ body }) => {
    let title = body.title ?? "";
    let excerpt = body.excerpt ?? "";
    let category = body.category ?? "";
    let updateFeaturedImageForSlug: string | undefined;

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

      if (body.purpose === "featured-image") {
        updateFeaturedImageForSlug = body.slug;
      }
    }

    if (!title) {
      return NextResponse.json(
        { error: "title is required when slug is not provided" },
        { status: 400 },
      );
    }

    const result = await generateImage({
      title,
      excerpt,
      category,
      purpose: body.purpose,
      imageStyle: body.imageStyle,
      imageColorScheme: body.imageColorScheme,
      imageAspectRatio: body.imageAspectRatio,
      storagePrefix: body.slug ?? "inline",
      customPrompt: body.customPrompt,
    });

    if (updateFeaturedImageForSlug) {
      await updateArticleBySlug(DEFAULT_BLOG_ID, updateFeaturedImageForSlug, {
        featuredImage: { url: result.url, alt: result.alt },
        ogImage: result.url,
      });
    }

    return NextResponse.json(result, { status: 201 });
  },
});
