/**
 * Writing Skills API (D1-backed)
 *
 * GET  /api/v1/writing-skills -- List all skills ordered by `order`
 * POST /api/v1/writing-skills -- Create a new writing skill
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  createWritingSkill,
  listWritingSkills,
  seedBuiltinSkills,
} from "@/lib/writing-skills/repository";
import { createWritingSkillSchema } from "@/lib/schemas";

/**
 * GET /api/v1/writing-skills
 * Seeds builtin skills on first access, then returns all skills ordered by `order`.
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ blogId }) => {
    await seedBuiltinSkills(blogId);
    const data = await listWritingSkills(blogId);
    return NextResponse.json({ data });
  },
});

/**
 * POST /api/v1/writing-skills
 * Create a new custom writing skill. Returns { id } at 201.
 */
export const POST = createApiHandler({
  auth: "user",
  input: createWritingSkillSchema,
  audit: "create_writing_skill",
  handler: async ({ body, blogId }) => {
    const skill = await createWritingSkill(blogId, body);
    return NextResponse.json({ id: skill.id }, { status: 201 });
  },
});
