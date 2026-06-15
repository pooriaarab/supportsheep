import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  ShareLinkUpdateInput,
} from "@/lib/interviews/share-link-schema";
import { canRevokeAnyShareLink } from "@/lib/interviews/share-link-permissions";
import type { UserRole } from "@repo/types";
import {
  getShareLink,
  updateShareLink,
} from "@/lib/interviews/share-links-repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";

/**
 * PATCH /api/v1/interviews/share-links/[id]
 * Updates an existing share link's configuration.
 */
export const PATCH = createApiHandler<ShareLinkUpdateInput, { id: string }>({
  auth: "user",
  input: ShareLinkUpdateInput,
  audit: "update_share_link",
  handler: async ({ session, body, params, role: ctxRole }) => {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: "share link not found" }, { status: 404 });
    }

    const link = await getShareLink(DEFAULT_blog_id, id);
    if (!link) {
      return NextResponse.json({ error: "share link not found" }, { status: 404 });
    }

    const role = (ctxRole ?? "guest") as UserRole;

    // Ownership check: must be creator or have revoke/management capabilities (owner/admin)
    const isCreator = link.createdBy === session.uid;
    const hasAdminPrivileges = canRevokeAnyShareLink(role);

    if (!isCreator && !hasAdminPrivileges) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Only active share links can be updated
    if (link.status !== "active") {
      return NextResponse.json(
        { error: "cannot update non-active share link" },
        { status: 409 },
      );
    }

    await updateShareLink(DEFAULT_blog_id, id, {
      topic: body.topic,
      goal: body.goal,
      style: body.style,
      maxDurationSec: body.maxDurationSec,
      expiresAt: body.expiresAt,
      maxUses: body.maxUses,
      language: body.language,
    });

    return NextResponse.json({ success: true });
  },
});

/**
 * DELETE /api/v1/interviews/share-links/[id]
 * Soft-revokes an existing share link.
 */
export const DELETE = createApiHandler<unknown, { id: string }>({
  auth: "user",
  audit: "revoke_share_link",
  handler: async ({ session, params, role: ctxRole }) => {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: "share link not found" }, { status: 404 });
    }

    const link = await getShareLink(DEFAULT_blog_id, id);
    if (!link) {
      return NextResponse.json({ error: "share link not found" }, { status: 404 });
    }

    const role = (ctxRole ?? "guest") as UserRole;

    // Ownership check: must be creator or have revoke/management capabilities (owner/admin)
    const isCreator = link.createdBy === session.uid;
    const hasAdminPrivileges = canRevokeAnyShareLink(role);

    if (!isCreator && !hasAdminPrivileges) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    // Reject revoke on already-non-active links (parity with PATCH).
    if (link.status !== "active") {
      return NextResponse.json(
        { error: "cannot revoke non-active share link" },
        { status: 409 },
      );
    }

    // Soft-revoke: mark status as revoked instead of hard deleting
    await updateShareLink(DEFAULT_blog_id, id, { status: "revoked" });

    return NextResponse.json({ success: true });
  },
});
