/**
 * Internal Link Rules API
 *
 * GET  /api/v1/seo/internal-links -- List all rules
 * POST /api/v1/seo/internal-links -- Create a rule
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { createInternalLinkRuleSchema } from "@/lib/schemas";
import {
  listInternalLinkRules,
  createInternalLinkRule,
} from "@/lib/seo/internal-link-rules-repository";

/**
 * GET /api/v1/seo/internal-links
 * List all internal link rules
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ blogId }) => {
    const rules = await listInternalLinkRules(blogId);
    return NextResponse.json({ data: rules });
  },
});

/**
 * POST /api/v1/seo/internal-links
 * Create a new internal link rule
 */
export const POST = createApiHandler({
  auth: "user",
  input: createInternalLinkRuleSchema,
  audit: "create_internal_link_rule",
  handler: async ({ blogId, body }) => {
    const { id } = await createInternalLinkRule(blogId, body);
    return NextResponse.json({ id }, { status: 201 });
  },
});
