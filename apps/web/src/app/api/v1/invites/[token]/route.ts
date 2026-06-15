/**
 * Public invite preview.
 *
 * GET /api/v1/invites/{token} -- Return the minimal details the accept page
 *   shows before sign-in: blog name, role, recipient email, and validity. No
 *   auth is required (the page must render the invite to a not-yet-signed-in
 *   recipient), but the token is unguessable and only non-sensitive fields the
 *   recipient already knows are exposed. The token itself is never echoed back.
 */

import { NextResponse } from "next/server";

import { createApiHandler } from "@/lib/create-api-handler";
import { getInviteByToken } from "@/lib/invites/repository";
import { getBlogDisplayName } from "@/lib/tenancy/blogs";

interface RouteParams {
  token: string;
}

export const GET = createApiHandler<unknown, RouteParams>({
  auth: "none",
  rateLimit: { key: "invite-preview", maxPerMinute: 60 },
  handler: async ({ params }) => {
    const invite = await getInviteByToken(params.token);
    if (!invite) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const status: "pending" | "accepted" | "expired" =
      invite.acceptedAt !== null
        ? "accepted"
        : invite.expiresAt <= Date.now()
          ? "expired"
          : "pending";

    const blogName = (await getBlogDisplayName(invite.blogId)) ?? "the knowledge base";

    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      blogName,
      status,
      expiresAt: invite.expiresAt,
    });
  },
});
