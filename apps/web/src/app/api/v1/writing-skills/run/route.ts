/**
 * Run Writing Skills Pipeline API
 *
 * POST /api/v1/writing-skills/run
 * Takes content and skill IDs, runs each skill sequentially, returns processed content.
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { runSkillsPipelineSchema } from "@/lib/schemas";
import { runSkillsPipeline } from "@/lib/generation/skills";

export const POST = createApiHandler({
  auth: "user",
  input: runSkillsPipelineSchema,
  audit: "run_skills_pipeline",
  handler: async ({ body, blogId }) => {
    const result = await runSkillsPipeline(body.content, body.skillIds, blogId);
    return NextResponse.json({ data: { content: result } });
  },
});
