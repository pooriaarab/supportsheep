import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  ShareLinkCreateInput,
} from "@/lib/interviews/share-link-schema";
import { generateShareLinkToken } from "@/lib/interviews/share-link-token";
import { canMintShareLink } from "@/lib/interviews/share-link-permissions";
import { getBlogConfigEffectiveMinters } from "@/lib/interviews/effective-minters";
import type { UserRole } from "@repo/types";
import { createLogger } from "@/lib/logger";
import { generateInterviewIcs } from "@/lib/interviews/ics";
import { sendCalendarInviteEmail } from "@/lib/interviews/send-calendar-invite-email";
import {
  createShareLink,
  listShareLinks,
} from "@/lib/interviews/share-links-repository";
import { DEFAULT_BLOG_ID } from "@/lib/tenancy/repository";

const log = createLogger("api:interviews:share-links");

/**
 * POST /api/v1/interviews/share-links
 * Creates (mints) a new share link.
 */
export const POST = createApiHandler({
  auth: "user",
  input: ShareLinkCreateInput,
  audit: "create_share_link",
  handler: async ({ request, session, body, role: ctxRole }) => {
    const role = (ctxRole ?? "guest") as UserRole;

    // Enforce the workspace's effective `whoCanMintLinks` setting (F-004).
    const effectiveMinters = await getBlogConfigEffectiveMinters();
    if (!canMintShareLink(role, effectiveMinters)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const { token, hash } = generateShareLinkToken();

    const link = await createShareLink(DEFAULT_BLOG_ID, {
      type: body.type,
      createdBy: session.uid,
      workspaceId: "default",
      topic: body.topic ?? null,
      goal: body.goal ?? null,
      style: body.style,
      authMode: body.authMode,
      recordingConfig: body.recordingConfig,
      maxDurationSec: body.maxDurationSec,
      expiresAt: body.expiresAt ?? null,
      maxUses: body.maxUses ?? null,
      tokenHash: hash,
      language: body.language,
      scheduledAt: body.scheduledAt ?? null,
      scheduledGuestEmail: body.scheduledGuestEmail ?? null,
      mode: body.mode,
      asyncQuestions: body.asyncQuestions ?? [],
    });

    if (body.scheduledAt && body.scheduledGuestEmail) {
      try {
        const ics = generateInterviewIcs({
          token,
          topic: body.topic,
          scheduledAt: body.scheduledAt,
          durationSec: body.maxDurationSec,
          baseUrl: request.nextUrl.origin,
        });
        await sendCalendarInviteEmail({
          to: body.scheduledGuestEmail,
          ics,
        });
      } catch (err) {
        log.error("Failed to send calendar invite email", {
          error: err instanceof Error ? err.message : String(err),
          scheduledGuestEmail: body.scheduledGuestEmail,
        });
      }
    }

    // Return the plaintext token ONCE — the caller must store/display it immediately.
    return NextResponse.json({ id: link.id, token }, { status: 201 });
  },
});

/**
 * GET /api/v1/interviews/share-links
 * Retrieves active share links, scoped by user role.
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ session, role: ctxRole }) => {
    const role = (ctxRole ?? "guest") as UserRole;

    const blogId = DEFAULT_BLOG_ID;

    // Owners and Admins can see all links in the workspace.
    // Other roles are scoped to only view links they personally created.
    const opts =
      role === "owner" || role === "admin"
        ? {}
        : { createdBy: session.uid };

    const links = await listShareLinks(blogId, opts);

    // Strip tokenHash from response to prevent leakage.
    const data = links.map(({ tokenHash: _, ...rest }) => rest);
    return NextResponse.json({ data });
  },
});
