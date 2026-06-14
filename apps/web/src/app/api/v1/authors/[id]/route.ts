/**
 * Single Author API (D1-backed)
 *
 * GET /api/v1/authors/:id -- Fetch one author
 * PATCH /api/v1/authors/:id -- Update an author
 * DELETE /api/v1/authors/:id -- Remove an author
 */

import { NextResponse } from "next/server";
import type { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  deleteAuthor,
  getAuthor,
  updateAuthor,
} from "@/lib/authors/repository";
import { updateAuthorSchema } from "@/lib/schemas";

/**
 * GET /api/v1/authors/:id
 */
export const GET = createApiHandler<unknown, { id: string }>({
  auth: "user",
  handler: async ({ params, blogId }) => {
    const author = await getAuthor(blogId, params.id);
    if (!author) {
      return NextResponse.json({ error: "Author not found" }, { status: 404 });
    }
    return NextResponse.json(author);
  },
});

/**
 * PATCH /api/v1/authors/:id
 */
export const PATCH = createApiHandler<
  z.infer<typeof updateAuthorSchema>,
  { id: string }
>({
  auth: "user",
  input: updateAuthorSchema,
  audit: "update_author",
  handler: async ({ body, params, blogId }) => {
    const hasUpdate =
      body.name !== undefined ||
      body.jobTitle !== undefined ||
      body.bio !== undefined ||
      body.avatarUrl !== undefined ||
      body.email !== undefined ||
      body.sameAs !== undefined;
    if (!hasUpdate) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const updated = await updateAuthor(blogId, params.id, body);
    if (!updated) {
      return NextResponse.json({ error: "Author not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  },
});

/**
 * DELETE /api/v1/authors/:id
 */
export const DELETE = createApiHandler<unknown, { id: string }>({
  auth: "user",
  audit: "delete_author",
  handler: async ({ params, blogId }) => {
    const deleted = await deleteAuthor(blogId, params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Author not found" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true });
  },
});
