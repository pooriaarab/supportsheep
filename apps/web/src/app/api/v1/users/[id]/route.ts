/**
 * Single Member API (blog-scoped). `id` is the member's userId.
 *
 * GET /api/v1/users/:id -- Get a single member of the current blog
 * PATCH /api/v1/users/:id -- Update a member's role
 *
 * The client `AppUser` shape is preserved (see MemberEntry).
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiHandler } from "@/lib/create-api-handler";
import { getBlogMember, updateMemberRole } from "@/lib/tenancy/members";

// The legacy enum included user|member|viewer|admin. Only role is actionable on
// a membership now; map the legacy "user" alias to "viewer", pass others through.
const ROLE_MAP: Record<string, string> = {
  user: "viewer",
  member: "editor",
  viewer: "viewer",
  editor: "editor",
  admin: "admin",
  owner: "owner",
};

const updateMemberSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    role: z.enum(["admin", "member", "viewer", "user", "editor", "owner"]).optional(),
    status: z.enum(["active", "paused", "deleted"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

/**
 * GET /api/v1/users/:id
 * Retrieve a single member by userId.
 */
export const GET = createApiHandler<unknown, { id: string }>({
  auth: "user",
  handler: async ({ params, blogId }) => {
    const member = await getBlogMember(blogId, params.id);
    if (!member) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json(member);
  },
});

/**
 * PATCH /api/v1/users/:id
 * Update a member's role. `name` lives on the Better Auth user and `status`
 * isn't modeled on a membership, so they are not actionable here: a request
 * carrying only name/status (no role) is a no-op that returns the current
 * member unchanged.
 */
export const PATCH = createApiHandler<
  z.infer<typeof updateMemberSchema>,
  { id: string }
>({
  auth: "admin",
  input: updateMemberSchema,
  audit: "update_user",
  handler: async ({ body, params, blogId }) => {
    if (body.role === undefined) {
      const member = await getBlogMember(blogId, params.id);
      if (!member) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      return NextResponse.json(member);
    }

    const result = await updateMemberRole(
      blogId,
      params.id,
      ROLE_MAP[body.role] ?? body.role,
    );

    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: "cannot_demote_last_owner" },
        { status: 409 },
      );
    }

    return NextResponse.json(result.member);
  },
});
