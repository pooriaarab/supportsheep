import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { generateShareLinkToken } from "@/lib/interviews/share-link-token";
import { canRevokeAnyShareLink } from "@/lib/interviews/share-link-permissions";
import type { UserRole } from "@repo/types";
import {
  getShareLink,
  rotateShareLinkToken,
} from "@/lib/interviews/share-links-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

/**
 * POST /api/v1/interviews/share-links/[id]/regenerate
 *
 * Rotates the share link's token in place: replaces tokenHash, resets uses
 * to 0, and returns the new plaintext token. The doc id (and therefore the
 * row in the share-links table) is preserved so admins keep a stable handle
 * on the link. Any URL holding the old plaintext token immediately stops
 * resolving because its hash no longer matches.
 */
export const POST = createApiHandler<unknown, { id: string }>({
  auth: "user",
  audit: "regenerate_share_link",
  handler: async ({ session, params, role: ctxRole }) => {
    const id = params?.id;
    if (!id) {
      return NextResponse.json({ error: "share link not found" }, { status: 404 });
    }

    const link = await getShareLink(DEFAULT_BLOG_ID, id);
    if (!link) {
      return NextResponse.json({ error: "share link not found" }, { status: 404 });
    }

    const role = (ctxRole ?? "guest") as UserRole;

    const isCreator = link.createdBy === session.uid;
    const hasAdminPrivileges = canRevokeAnyShareLink(role);
    if (!isCreator && !hasAdminPrivileges) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (link.status !== "active") {
      return NextResponse.json(
        { error: "cannot regenerate non-active share link" },
        { status: 409 },
      );
    }

    const { token, hash } = generateShareLinkToken();
    await rotateShareLinkToken(DEFAULT_BLOG_ID, id, hash);

    return NextResponse.json({ id, token });
  },
});
