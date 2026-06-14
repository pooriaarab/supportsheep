/**
 * Custom-domain waitlist API (blog-scoped)
 *
 * Custom domains (Cloudflare for SaaS) are not yet enabled on the zone, so the
 * Settings → Domain page shows a "coming soon" card with a waitlist instead of
 * the live domain-management UI. These endpoints capture and report interest.
 *
 * GET  /api/v1/blogs/{blogId}/domain/waitlist -- whether this blog has joined,
 *   plus the total number of interested blogs. Any member may read.
 * POST /api/v1/blogs/{blogId}/domain/waitlist -- join the waitlist (idempotent).
 *   Owner/admin only, matching who manages the blog's domain.
 *
 * `{blogId}` must equal the caller's resolved tenant.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { user } from "@/db/schema/auth";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  countDomainWaitlist,
  isBlogOnWaitlist,
  joinDomainWaitlist,
} from "@/lib/domains/waitlist-repository";

interface RouteParams {
  blogId: string;
}

/** Resolve the caller's account email — from the session, or the user row. */
async function resolveEmail(uid: string, sessionEmail: string): Promise<string> {
  if (sessionEmail) return sessionEmail;
  const rows = await getDb()
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, uid))
    .limit(1);
  return rows[0]?.email ?? "";
}

/**
 * GET /api/v1/blogs/{blogId}/domain/waitlist
 * Any member may read whether the blog has joined + the total interested count.
 */
export const GET = createApiHandler<unknown, RouteParams>({
  auth: "user",
  handler: async ({ params, blogId }) => {
    if (params.blogId !== blogId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const [joined, totalInterested] = await Promise.all([
      isBlogOnWaitlist(blogId),
      countDomainWaitlist(),
    ]);
    return NextResponse.json({ joined, totalInterested });
  },
});

/**
 * POST /api/v1/blogs/{blogId}/domain/waitlist
 * Join the custom-domain waitlist. Owner/admin only; idempotent.
 */
export const POST = createApiHandler<unknown, RouteParams>({
  auth: "admin",
  audit: "join_domain_waitlist",
  handler: async ({ params, blogId, session }) => {
    if (params.blogId !== blogId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const email = await resolveEmail(session.uid, session.email);
    await joinDomainWaitlist({ blogId, userId: session.uid, email });

    const totalInterested = await countDomainWaitlist();
    return NextResponse.json({ joined: true, totalInterested });
  },
});
