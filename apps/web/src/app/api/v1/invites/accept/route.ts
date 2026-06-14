/**
 * Accept a blog invite.
 *
 * POST /api/v1/invites/accept { token } -- Redeem a pending invite for the
 *   signed-in user. Requires a session but NOT an existing membership (the whole
 *   point is to gain one), so it uses `auth: "session"`.
 *
 * Security:
 *  - The signed-in user's email MUST equal the invite's email (else 403). The
 *    token alone is not sufficient — it must be redeemed by its intended
 *    recipient, so a leaked link cannot be used by a different account.
 *  - Expired / already-accepted invites are rejected with a friendly status.
 *  - acceptInvite is atomic + single-use; membership is added only after the
 *    invite is successfully consumed.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiHandler } from "@/lib/create-api-handler";
import { acceptInvite, getInviteByToken } from "@/lib/invites/repository";
import { addMemberByEmail } from "@/lib/tenancy/members";

const acceptSchema = z.object({
  token: z.string().min(1, "token is required"),
});

export const POST = createApiHandler<z.infer<typeof acceptSchema>>({
  auth: "session",
  input: acceptSchema,
  audit: "accept_invite",
  handler: async ({ body, session }) => {
    const invite = await getInviteByToken(body.token);
    if (!invite) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // The invite must be redeemed by its intended recipient — match on email,
    // case-insensitively (stored lowercased at creation). Never authorize on the
    // token alone.
    if (invite.email !== (session.email ?? "").toLowerCase()) {
      return NextResponse.json({ error: "email_mismatch" }, { status: 403 });
    }

    if (invite.acceptedAt !== null) {
      return NextResponse.json({ error: "already_accepted" }, { status: 409 });
    }
    if (invite.expiresAt <= Date.now()) {
      return NextResponse.json({ error: "expired" }, { status: 410 });
    }

    // Consume the invite atomically first (single-use guard), then grant
    // membership. If the row was raced to accepted between the checks above and
    // here, acceptInvite reports it.
    const result = await acceptInvite(body.token, session.uid);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      if (result.reason === "expired") {
        return NextResponse.json({ error: "expired" }, { status: 410 });
      }
      return NextResponse.json({ error: "already_accepted" }, { status: 409 });
    }

    // Add the now-existing user (looked up by the invited email) to the blog.
    // already_member is fine — the invite is consumed and the user is a member.
    await addMemberByEmail(invite.blogId, invite.email, invite.role);

    return NextResponse.json({ accepted: true, blogId: invite.blogId });
  },
});
