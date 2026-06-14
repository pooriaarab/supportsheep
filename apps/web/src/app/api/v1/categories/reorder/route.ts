/**
 * Categories Reorder API (D1-backed)
 *
 * POST /api/v1/categories/reorder -- Update order values for categories
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { reorderCategories } from "@/lib/categories/repository";
import { reorderCategoriesSchema } from "@/lib/schemas";

/**
 * POST /api/v1/categories/reorder
 * Accepts a map of slug -> order number and updates all at once.
 */
export const POST = createApiHandler({
  auth: "user",
  input: reorderCategoriesSchema,
  audit: "update_category",
  handler: async ({ body, blogId }) => {
    const reordered = await reorderCategories(blogId, body.order);
    return NextResponse.json({ reordered });
  },
});
