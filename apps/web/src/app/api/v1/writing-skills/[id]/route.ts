/**
 * Writing Skill Detail API (D1-backed)
 *
 * GET    /api/v1/writing-skills/:id -- Get a writing skill
 * PATCH  /api/v1/writing-skills/:id -- Update a writing skill
 * DELETE /api/v1/writing-skills/:id -- Delete a writing skill
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  deleteWritingSkill,
  getWritingSkill,
  updateWritingSkill,
} from "@/lib/writing-skills/repository";
import { updateWritingSkillSchema } from "@/lib/schemas";

type RouteParams = { id: string };

/**
 * GET /api/v1/writing-skills/:id
 */
export const GET = createApiHandler<unknown, RouteParams>({
  auth: "user",
  handler: async ({ params, blogId }) => {
    const skill = await getWritingSkill(blogId, params.id);
    if (!skill) {
      return NextResponse.json(
        { error: "Writing skill not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: skill });
  },
});

/**
 * PATCH /api/v1/writing-skills/:id
 */
export const PATCH = createApiHandler<Record<string, unknown>, RouteParams>({
  auth: "user",
  input: updateWritingSkillSchema,
  audit: "update_writing_skill",
  handler: async ({ body, params, blogId }) => {
    const updated = await updateWritingSkill(blogId, params.id, body);
    if (!updated) {
      return NextResponse.json(
        { error: "Writing skill not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ id: params.id });
  },
});

/**
 * DELETE /api/v1/writing-skills/:id
 */
export const DELETE = createApiHandler<unknown, RouteParams>({
  auth: "user",
  audit: "delete_writing_skill",
  handler: async ({ params, blogId }) => {
    const deleted = await deleteWritingSkill(blogId, params.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Writing skill not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ deleted: true });
  },
});
