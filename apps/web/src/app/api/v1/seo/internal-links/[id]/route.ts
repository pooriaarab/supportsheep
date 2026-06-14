/**
 * Internal Link Rule Detail API
 *
 * PATCH  /api/v1/seo/internal-links/:id -- Update a rule
 * DELETE /api/v1/seo/internal-links/:id -- Delete a rule
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { updateInternalLinkRuleSchema } from "@/lib/schemas";
import {
  updateInternalLinkRule,
  deleteInternalLinkRule,
} from "@/lib/seo/internal-link-rules-repository";

type RouteParams = { id: string };

/**
 * PATCH /api/v1/seo/internal-links/:id
 */
export const PATCH = createApiHandler<Record<string, unknown>, RouteParams>({
  auth: "user",
  input: updateInternalLinkRuleSchema,
  audit: "update_internal_link_rule",
  handler: async ({ blogId, body, params }) => {
    const updated = await updateInternalLinkRule(blogId, params.id, body);
    if (!updated) {
      return NextResponse.json(
        { error: "Internal link rule not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ id: params.id });
  },
});

/**
 * DELETE /api/v1/seo/internal-links/:id
 */
export const DELETE = createApiHandler<unknown, RouteParams>({
  auth: "user",
  audit: "delete_internal_link_rule",
  handler: async ({ blogId, params }) => {
    const deleted = await deleteInternalLinkRule(blogId, params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Internal link rule not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ deleted: true });
  },
});
