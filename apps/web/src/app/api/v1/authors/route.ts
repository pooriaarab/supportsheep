/**
 * Authors API (D1-backed)
 *
 * GET /api/v1/authors -- List all authors
 * POST /api/v1/authors -- Create a new author
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  createAuthor,
  ensurePlaceholderAuthor,
  listAuthors,
} from "@/lib/authors/repository";
import { createAuthorSchema } from "@/lib/schemas";

/**
 * GET /api/v1/authors
 * Return every author, ordered alphabetically by name.
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ blogId }) => {
    await ensurePlaceholderAuthor(blogId);
    const data = await listAuthors(blogId);
    return NextResponse.json({ data });
  },
});

/**
 * POST /api/v1/authors
 * Create a new author. The request body's `id` is the URL slug.
 */
export const POST = createApiHandler({
  auth: "user",
  input: createAuthorSchema,
  audit: "create_author",
  handler: async ({ body, blogId }) => {
    const result = await createAuthor(blogId, body);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Author slug already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(result.entry, { status: 201 });
  },
});
