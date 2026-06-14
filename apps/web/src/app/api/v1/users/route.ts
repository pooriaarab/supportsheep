/**
 * Members API (blog-scoped)
 *
 * GET /api/v1/users -- List the current blog's members (paginated)
 * POST /api/v1/users -- Add an existing user to the blog by email
 * DELETE /api/v1/users -- Remove members from the blog by user ID
 *
 * The client `AppUser` shape is preserved (see MemberEntry): id, name, email,
 * role, avatarUrl, joinedAt, status.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiHandler } from "@/lib/create-api-handler";
import {
  addMemberByEmail,
  listBlogMembers,
  removeBlogMembers,
} from "@/lib/tenancy/members";

// The legacy enum was user|admin. Map it onto blog roles: a plain "user" is a
// viewer; "admin" stays admin.
const ROLE_MAP: Record<"user" | "admin", string> = {
  user: "viewer",
  admin: "admin",
};

const createMemberSchema = z.object({
  email: z.string().email("Valid email is required"),
  name: z.string().min(1, "Name is required").max(100).optional(),
  role: z.enum(["user", "admin"]).default("user"),
});

const deleteMembersSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one ID is required").max(100),
});

/**
 * GET /api/v1/users
 * List the current blog's members with optional pagination.
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ request, blogId }) => {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const data = await listBlogMembers(blogId, { limit, offset });

    return NextResponse.json({
      data,
      pagination: { limit, offset, total: data.length },
    });
  },
});

/**
 * POST /api/v1/users
 * Add an existing user (by email) to the current blog.
 */
export const POST = createApiHandler({
  auth: "user",
  input: createMemberSchema,
  audit: "create_user",
  handler: async ({ body, blogId }) => {
    const result = await addMemberByEmail(
      blogId,
      body.email,
      ROLE_MAP[body.role],
    );

    if (!result.ok) {
      if (result.reason === "user_not_found") {
        return NextResponse.json({ error: "user_not_found" }, { status: 404 });
      }
      return NextResponse.json({ error: "already_member" }, { status: 409 });
    }

    return NextResponse.json(result.member, { status: 201 });
  },
});

/**
 * DELETE /api/v1/users
 * Remove members from the current blog by user ID.
 */
export const DELETE = createApiHandler({
  auth: "admin",
  input: deleteMembersSchema,
  audit: "delete_user",
  handler: async ({ body, blogId }) => {
    const result = await removeBlogMembers(blogId, body.ids);

    if (!result.ok) {
      return NextResponse.json(
        { error: "cannot_remove_last_owner" },
        { status: 409 },
      );
    }

    return NextResponse.json({ deleted: result.removed });
  },
});
