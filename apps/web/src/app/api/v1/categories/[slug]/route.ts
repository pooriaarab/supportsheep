/**
 * Single Category API (D1-backed)
 *
 * PATCH /api/v1/categories/:slug -- Update category
 * DELETE /api/v1/categories/:slug -- Remove category
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { deleteCategory, updateCategory } from "@/lib/categories/repository";
import { updateCategorySchema } from "@/lib/schemas";
import type { z } from "zod";

/**
 * PATCH /api/v1/categories/:slug
 * Update a category's displayName, icon, or description.
 */
export const PATCH = createApiHandler<
  z.infer<typeof updateCategorySchema>,
  { slug: string }
>({
  auth: "user",
  input: updateCategorySchema,
  audit: "update_category",
  handler: async ({ body, params, blogId }) => {
    const hasUpdate =
      body.displayName !== undefined ||
      body.icon !== undefined ||
      body.description !== undefined;
    if (!hasUpdate) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const updated = await updateCategory(blogId, params.slug, body);
    if (!updated) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(updated);
  },
});

/**
 * DELETE /api/v1/categories/:slug
 * Remove a category.
 */
export const DELETE = createApiHandler<unknown, { slug: string }>({
  auth: "user",
  audit: "delete_category",
  handler: async ({ params, blogId }) => {
    const deleted = await deleteCategory(blogId, params.slug);
    if (!deleted) {
      return NextResponse.json(
        { error: "Category not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ deleted: true });
  },
});
