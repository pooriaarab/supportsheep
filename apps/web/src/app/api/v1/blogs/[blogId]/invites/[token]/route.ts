/**
 * Revoke a pending blog invite.
 *
 * DELETE /api/v1/blogs/{blogId}/invites/{token} -- Delete the pending invite.
 *   Scoped to the caller's blog so one tenant can never revoke another's invite.
 */

import { NextResponse } from "next/server";

import { createApiHandler } from "@/lib/create-api-handler";
import { revokeInvite } from "@/lib/invites/repository";

interface RouteParams {
  blogId: string;
  token: string;
}

export const DELETE = createApiHandler<unknown, RouteParams>({
  auth: "admin",
  audit: "revoke_invite",
  handler: async ({ params, blogId }) => {
    if (params.blogId !== blogId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const revoked = await revokeInvite(blogId, params.token);
    if (!revoked) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ revoked: true });
  },
});
