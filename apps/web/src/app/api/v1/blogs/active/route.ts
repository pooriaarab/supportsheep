/**
 * Active-blog selection (multi-blog users).
 *
 * POST /api/v1/blogs/active { blogId } -- Remember which blog the caller is
 *   acting on by setting the `bb_active_blog` cookie. Membership is verified
 *   before the cookie is set — a non-member can never pin a blog they don't
 *   belong to. The cookie is only a hint: every request re-verifies membership
 *   (see resolveTenantForUser), so it is never trusted for authorization.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiHandler } from "@/lib/create-api-handler";
import {
  ACTIVE_BLOG_COOKIE,
  ACTIVE_BLOG_COOKIE_MAX_AGE_SEC,
} from "@/lib/tenancy/active-blog";
import { listBlogsForUser } from "@/lib/tenancy/blogs";

const activeBlogSchema = z.object({
  blogId: z.string().min(1, "blogId is required"),
});

export const POST = createApiHandler<z.infer<typeof activeBlogSchema>>({
  auth: "session",
  input: activeBlogSchema,
  audit: "switch_blog",
  handler: async ({ body, session }) => {
    // Verify the caller is actually a member of the target blog before pinning.
    const blogs = await listBlogsForUser(session.uid);
    const isMember = blogs.some((b) => b.id === body.blogId);
    if (!isMember) {
      // Avoid leaking blog existence: a non-member sees the same response
      // whether or not the blog exists.
      return NextResponse.json({ error: "not_a_member" }, { status: 403 });
    }

    const response = NextResponse.json({ ok: true, blogId: body.blogId });
    response.cookies.set(ACTIVE_BLOG_COOKIE, body.blogId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ACTIVE_BLOG_COOKIE_MAX_AGE_SEC,
    });
    return response;
  },
});
