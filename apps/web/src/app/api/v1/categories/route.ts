/**
 * Categories API (D1-backed)
 *
 * GET /api/v1/categories -- List all categories
 * POST /api/v1/categories -- Add a new category
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { createCategory, listCategories } from "@/lib/categories/repository";
import { createCategorySchema } from "@/lib/schemas";

/**
 * GET /api/v1/categories
 * Return categories ordered by their sort order.
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ blogId }) => {
    const data = await listCategories(blogId);
    return NextResponse.json({ data });
  },
});

/**
 * POST /api/v1/categories
 * Add a new category (placed at the end of the order).
 */
export const POST = createApiHandler({
  auth: "user",
  input: createCategorySchema,
  audit: "create_category",
  handler: async ({ body, blogId }) => {
    const result = await createCategory(blogId, body);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Category slug already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(result.entry, { status: 201 });
  },
});
