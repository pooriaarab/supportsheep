import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { verifyRequest } from "@/lib/auth/session";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";
import {
  INTERVIEW_STYLE,
  INTERVIEW_LANGUAGES,
} from "@/lib/interviews/share-link-schema";
import { createLogger } from "@/lib/logger";
import type { UserRole } from "@repo/types";
import { createInterview, listInterviews } from "@/lib/interviews/interviews-repository";
import {
  getShareLinkByTokenHash,
  atomicIncrementUsesIfAvailable,
  validateShareLinkForUse,
  isShareLinkScheduledFuture,
} from "@/lib/interviews/share-links-repository";
import { DEFAULT_BLOG_ID, getMembershipByUser } from "@/lib/tenancy/repository";

const log = createLogger("interviews:lifecycle");

const createInterviewSchema = z.object({
  shareLinkToken: z.string().min(32).optional(),
  guestName: z.string().max(100).optional(),
  guestEmail: z.string().email().optional(),
  self: z.boolean().optional(),
  style: z.enum(INTERVIEW_STYLE).optional(),
  topic: z.string().max(500).nullable().optional(),
  maxDurationSec: z.number().int().min(60).max(1800).optional(),
  language: z.enum(INTERVIEW_LANGUAGES).optional(),
});

export const POST = createApiHandler({
  auth: "none",
  input: createInterviewSchema,
  handler: async ({ body }) => {
    // 1. If self-flow is requested
    if (body.self) {
      let session;
      try {
        session = await verifyRequest();
      } catch (_err) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const role = (await getMembershipByUser(session.uid))?.role ?? "guest";

      const interview = await createInterview(DEFAULT_BLOG_ID, {
        status: "consent",
        startedByUid: session.uid,
        startedByRole: role as string,
        style: body.style ?? "smart",
        recordingConfig: "transcript",
        maxDurationSec: body.maxDurationSec ?? 300,
        topic: body.topic ?? null,
        goal: null,
        language: body.language ?? "en",
      });

      return NextResponse.json({ interviewId: interview.id, status: "consent" });
    }

    // 2. Share-link flow
    if (body.shareLinkToken) {
      const hashedToken = hashShareLinkToken(body.shareLinkToken);
      const shareLinkData = await getShareLinkByTokenHash(hashedToken);

      if (!shareLinkData) {
        log.info("Share-link token hash not found during interview creation.");
        return NextResponse.json({ error: "Share-link not found" }, { status: 404 });
      }

      // Validate status / expiry / maxUses / scheduled
      const validationError = validateShareLinkForUse(shareLinkData);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 404 });
      }

      // Validate scheduled time — block joining before the scheduled window
      if (isShareLinkScheduledFuture(shareLinkData)) {
        return NextResponse.json({ error: "Interview is scheduled for a future time" }, { status: 403 });
      }

      // Validate authMode gates
      if (shareLinkData.authMode === "email" && !body.guestEmail) {
        return NextResponse.json({ error: "email_required" }, { status: 400 });
      }

      if (shareLinkData.authMode === "magic_link") {
        return NextResponse.json({ error: "magic_link_required" }, { status: 400 });
      }

      // Validate visibility
      if (shareLinkData.type === "private" || shareLinkData.type === "workspace") {
        let viewer;
        try {
          viewer = await verifyRequest();
        } catch {
          return NextResponse.json(
            { error: "auth_required" },
            { status: 401 },
          );
        }
        if (shareLinkData.type === "private") {
          if (viewer.uid !== shareLinkData.createdBy) {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
          }
        } else {
          // Workspace visibility: viewer must belong to the same workspace.
          const viewerWorkspaceId =
            (await getMembershipByUser(viewer.uid))?.blogId ?? "default";
          if (viewerWorkspaceId !== shareLinkData.workspaceId) {
            return NextResponse.json({ error: "forbidden" }, { status: 403 });
          }
        }
      }

      // Atomic increment with maxUses guard (compare-and-swap)
      const incremented = await atomicIncrementUsesIfAvailable(
        shareLinkData.blogId,
        shareLinkData.id,
        shareLinkData.uses,
        shareLinkData.maxUses,
      );

      if (!incremented) {
        // Race: another concurrent request exhausted the uses
        return NextResponse.json({ error: "Share-link uses exhausted" }, { status: 404 });
      }

      // Create the interview after incrementing uses
      const interview = await createInterview(DEFAULT_BLOG_ID, {
        status: "consent",
        shareLinkId: shareLinkData.id,
        guestName: body.guestName || null,
        guestEmail: body.guestEmail || null,
        style: shareLinkData.style || "smart",
        recordingConfig: shareLinkData.recordingConfig || "transcript",
        maxDurationSec: shareLinkData.maxDurationSec || 300,
        topic: shareLinkData.topic || null,
        goal: shareLinkData.goal || null,
        language: shareLinkData.language || "en",
        mode: shareLinkData.mode || "live",
      });

      return NextResponse.json({ interviewId: interview.id, status: "consent" });
    }

    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  },
});

/**
 * GET /api/v1/interviews
 * Lists interviews visible to the caller. Admin/owner see every interview in
 * the workspace; everyone else only sees the ones they personally started.
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ session, role: ctxRole }) => {
    const role = (ctxRole ?? "guest") as UserRole;

    const isAdmin = role === "owner" || role === "admin";

    try {
      const [sessionsList, linksList] = await Promise.all([
        listInterviews(
          DEFAULT_BLOG_ID,
          isAdmin ? {} : { startedByUid: session.uid },
        ),
        import("@/lib/interviews/share-links-repository").then((m) =>
          m.listShareLinks(
            DEFAULT_BLOG_ID,
            isAdmin
              ? { status: "active" }
              : { status: "active", createdBy: session.uid },
          ),
        ),
      ]);

      const sessions = sessionsList.map((row) => ({
        id: row.id,
        status: row.status,
        topic: row.topic ?? null,
        style: row.style ?? null,
        guestName: row.guestName ?? null,
        startedByUid: row.startedByUid ?? null,
        maxDurationSec: row.maxDurationSec ?? null,
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      }));

      const scheduledSessions = linksList
        .filter((link) => link.scheduledAt && (link.uses || 0) === 0)
        .map((link) => ({
          id: `scheduled-${link.id}`,
          status: "scheduled",
          topic: link.topic ?? "Untitled Interview",
          style: link.style,
          guestName: link.scheduledGuestEmail ?? null,
          startedByUid: link.createdBy,
          maxDurationSec: link.maxDurationSec,
          createdAt: link.scheduledAt ?? null,
          updatedAt: link.scheduledAt ?? null,
        }));

      const merged = [...sessions, ...scheduledSessions];
      merged.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      return NextResponse.json({ data: merged });
    } catch (err: unknown) {
      log.error("Failed to list interviews", {
        uid: session.uid,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { error: "Failed to list interviews" },
        { status: 500 },
      );
    }
  },
});
