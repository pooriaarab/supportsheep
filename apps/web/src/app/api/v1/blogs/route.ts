/**
 * Blogs API (D1-backed, multitenant)
 *
 * GET  /api/v1/blogs -- List the blogs the authenticated user belongs to.
 * POST /api/v1/blogs -- Create a new blog owned by the authenticated user.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiHandler } from "@/lib/create-api-handler";
import { createBlog, listBlogsForUser } from "@/lib/tenancy/blogs";
import { readActiveBlogHint } from "@/lib/tenancy/active-blog";

const createBlogSchema = z.object({
  slug: z.string().min(3).max(32),
  displayName: z.string().min(1).max(100),
});

/**
 * GET /api/v1/blogs
 * Return every blog the caller is a member of, with their per-blog role, plus
 * `activeBlogId` — the blog the caller is currently acting on. The active id is
 * the `bb_active_blog` cookie hint when it points at a blog the user is still a
 * member of, else the earliest membership (the server's resolution fallback).
 * The cookie is only a hint; it is re-verified against the membership list here.
 */
export const GET = createApiHandler({
  auth: "session",
  handler: async ({ session }) => {
    const data = await listBlogsForUser(session.uid);
    const hint = await readActiveBlogHint();
    const activeBlogId =
      (hint && data.some((b) => b.id === hint) ? hint : data[0]?.id) ?? null;
    return NextResponse.json({ data, activeBlogId });
  },
});

/**
 * POST /api/v1/blogs
 * Create a blog; the caller becomes its owner.
 */
export const POST = createApiHandler({
  auth: "session",
  input: createBlogSchema,
  audit: "create_blog",
  handler: async ({ body, session }) => {
    const result = await createBlog({
      slug: body.slug,
      displayName: body.displayName,
      ownerUserId: session.uid,
    });

    if (!result.ok) {
      if (result.reason === "invalid_format") {
        return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
      }
      if (result.reason === "reserved") {
        return NextResponse.json({ error: "slug_reserved" }, { status: 400 });
      }
      return NextResponse.json({ error: "slug_taken" }, { status: 409 });
    }

    return NextResponse.json(result.blog, { status: 201 });
  },
});
