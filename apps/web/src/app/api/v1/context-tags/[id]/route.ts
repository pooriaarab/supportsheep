/**
 * Context Tag Detail API (D1-backed)
 *
 * GET    /api/v1/context-tags/:id -- Get a context tag
 * PATCH  /api/v1/context-tags/:id -- Update a context tag
 * DELETE /api/v1/context-tags/:id -- Delete a context tag
 */

import { NextResponse } from "next/server";
import type { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  deleteContextTag,
  getContextTag,
  updateContextTag,
} from "@/lib/context-tags/repository";
import { updateContextTagSchema } from "@/lib/schemas";

type RouteParams = { id: string };

/**
 * GET /api/v1/context-tags/:id
 */
export const GET = createApiHandler<unknown, RouteParams>({
  auth: "user",
  handler: async ({ params, blogId }) => {
    const entry = await getContextTag(blogId, params.id);
    if (!entry) {
      return NextResponse.json(
        { error: "Context tag not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: entry });
  },
});

/**
 * PATCH /api/v1/context-tags/:id
 */
export const PATCH = createApiHandler<
  z.infer<typeof updateContextTagSchema>,
  RouteParams
>({
  auth: "user",
  input: updateContextTagSchema,
  audit: "update_context_tag",
  handler: async ({ body, params, blogId }) => {
    const updated = await updateContextTag(blogId, params.id, body);
    if (!updated) {
      return NextResponse.json(
        { error: "Context tag not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ id: params.id });
  },
});

/**
 * DELETE /api/v1/context-tags/:id
 */
export const DELETE = createApiHandler<unknown, RouteParams>({
  auth: "user",
  audit: "delete_context_tag",
  handler: async ({ params, blogId }) => {
    const deleted = await deleteContextTag(blogId, params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Context tag not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ deleted: true });
  },
});
