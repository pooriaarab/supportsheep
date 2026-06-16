/**
 * Blog invites API (blog-scoped)
 *
 * POST /api/v1/blogs/{blogId}/invites -- Invite someone to the knowledge base by email.
 *   If a Better Auth user with that email already exists, they are added to
 *   blog_members immediately ({ added: true }); otherwise a pending invite row
 *   is created and an accept-link email is sent ({ invited: true }).
 * GET  /api/v1/blogs/{blogId}/invites -- List the knowledge base's pending invites.
 *
 * `{blogId}` must equal the caller's resolved tenant — invites are issued only
 * for the knowledge base the admin is acting on. Cross-blog attempts are rejected.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiHandler } from "@/lib/create-api-handler";
import {
  clampInviteRole,
  createInvite,
  listPendingInvites,
} from "@/lib/invites/repository";
import {
  buildAcceptInviteUrl,
  sendInviteEmail,
} from "@/lib/invites/send-invite-email";
import { addMemberByEmail } from "@/lib/tenancy/members";
import { getBlogDisplayName } from "@/lib/tenancy/blogs";

interface RouteParams {
  blogId: string;
}

const createInviteSchema = z.object({
  email: z.string().email("Valid email is required"),
  role: z.enum(["author", "editor", "viewer"]).default("author"),
});

/**
 * POST /api/v1/blogs/{blogId}/invites
 * Add an existing user immediately, or create + email a pending invite.
 */
export const POST = createApiHandler<
  z.infer<typeof createInviteSchema>,
  RouteParams
>({
  auth: "admin",
  input: createInviteSchema,
  audit: "create_invite",
  handler: async ({ body, params, blogId, session }) => {
    // the knowledge baseId in the path must be the caller's resolved tenant. Never trust a
    // path segment to widen scope beyond the admin's own blog.
    if (params.blogId !== blogId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const role = clampInviteRole(body.role);

    // Existing account → add to the knowledge base directly; no email needed.
    const added = await addMemberByEmail(blogId, body.email, role);
    if (added.ok) {
      return NextResponse.json(
        { added: true, member: added.member },
        { status: 201 },
      );
    }
    if (added.reason === "already_member") {
      return NextResponse.json({ error: "already_member" }, { status: 409 });
    }

    // No account yet → create a pending invite and email the accept link.
    const invite = await createInvite({
      blogId,
      email: body.email,
      role,
      invitedBy: session.uid,
    });

    const blogName = (await getBlogDisplayName(blogId)) ?? "the knowledge base";
    await sendInviteEmail({
      inviteId: invite.id,
      blogId,
      email: invite.email,
      blogName,
      role: invite.role,
      acceptUrl: buildAcceptInviteUrl(invite.token),
    });

    return NextResponse.json(
      {
        invited: true,
        invite: {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
        },
      },
      { status: 201 },
    );
  },
});

/**
 * GET /api/v1/blogs/{blogId}/invites
 * List the knowledge base's pending (unaccepted, unexpired) invites.
 */
export const GET = createApiHandler<unknown, RouteParams>({
  auth: "admin",
  handler: async ({ params, blogId }) => {
    if (params.blogId !== blogId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const invites = await listPendingInvites(blogId);
    return NextResponse.json({
      data: invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
      })),
    });
  },
});
