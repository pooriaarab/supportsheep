/**
 * Reorder Writing Skills API (D1-backed)
 *
 * POST /api/v1/writing-skills/reorder
 * Takes { order: { skillId: newOrder } } and batch-updates order fields.
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { reorderWritingSkills } from "@/lib/writing-skills/repository";
import { reorderWritingSkillsSchema } from "@/lib/schemas";

export const POST = createApiHandler({
  auth: "user",
  input: reorderWritingSkillsSchema,
  audit: "reorder_writing_skills",
  handler: async ({ body, blogId }) => {
    await reorderWritingSkills(blogId, body.order);
    return NextResponse.json({ success: true });
  },
});
