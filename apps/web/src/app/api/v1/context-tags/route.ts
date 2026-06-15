/**
 * Context Tags API (D1-backed)
 *
 * GET  /api/v1/context-tags -- List all context tags
 * POST /api/v1/context-tags -- Create a new context tag
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  createContextTag,
  listContextTags,
} from "@/lib/context-tags/repository";
import { createContextTagSchema } from "@/lib/schemas";

/**
 * GET /api/v1/context-tags
 * Return every context tag for the knowledge base, ordered alphabetically by name.
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ blogId }) => {
    const data = await listContextTags(blogId);
    return NextResponse.json({ data });
  },
});

/**
 * POST /api/v1/context-tags
 * Create a new context tag. The id is auto-generated (nanoid).
 */
export const POST = createApiHandler({
  auth: "user",
  input: createContextTagSchema,
  audit: "create_context_tag",
  handler: async ({ body, blogId }) => {
    const { id } = await createContextTag(blogId, body);
    return NextResponse.json({ id }, { status: 201 });
  },
});
