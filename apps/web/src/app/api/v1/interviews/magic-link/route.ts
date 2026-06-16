import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";
import { generateMagicLinkToken, hashMagicLinkToken } from "@/lib/interviews/magic-link-token";
import { sendMagicLinkEmail } from "@/lib/interviews/send-magic-link-email";
import { createLogger } from "@/lib/logger";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  getShareLinkByTokenHash,
  atomicIncrementUsesIfAvailable,
} from "@/lib/interviews/share-links-repository";
import {
  createMagicLink,
  claimMagicLink,
} from "@/lib/interviews/magic-links-repository";
import { createInterview } from "@/lib/interviews/interviews-repository";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";

const log = createLogger("interviews:magic-link");

const SendInput = z.object({
  shareLinkToken: z.string().min(32),
  email: z.string().email(),
});

export const POST = createApiHandler({
  auth: "none",
  rateLimit: {
    key: "interview-magic-link",
    maxPerMinute: RATE_LIMITS["interview-magic-link"],
  },
  input: SendInput,
  handler: async ({ body }) => {
    // 1. Verify share link is active + authMode === "magic_link"
    const hash = hashShareLinkToken(body.shareLinkToken);
    const shareLinkData = await getShareLinkByTokenHash(hash);

    if (!shareLinkData) {
      log.info("Share-link token hash not found during magic-link request.");
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (shareLinkData.status !== "active" || shareLinkData.authMode !== "magic_link") {
      log.info("Share-link is not active or authMode is not magic_link.", {
        status: shareLinkData.status,
        authMode: shareLinkData.authMode,
      });
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Validate expiration
    if (shareLinkData.expiresAt && new Date(shareLinkData.expiresAt) < new Date()) {
      log.info("Share-link has expired.");
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Validate maxUses
    if (shareLinkData.maxUses !== null && shareLinkData.uses >= shareLinkData.maxUses) {
      log.info("Share-link uses exhausted.");
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // 2. Generate magic-link token (15min TTL, single use) and persist to D1.
    const { token, hash: mlHash } = generateMagicLinkToken();

    await createMagicLink(shareLinkData.blogId, {
      shareLinkId: shareLinkData.id,
      tokenHash: mlHash,
      email: body.email,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    });

    // 3. Send email
    await sendMagicLinkEmail({
      to: body.email,
      shareLinkToken: body.shareLinkToken,
      magicLinkToken: token,
      shareLinkId: shareLinkData.id,
      magicLinkId: mlHash,
    });

    return NextResponse.json({ ok: true });
  },
});

export const GET = createApiHandler({
  auth: "none",
  rateLimit: {
    key: "interview-magic-link",
    maxPerMinute: RATE_LIMITS["interview-magic-link"],
  },
  handler: async ({ request }) => {
    const url = new URL(request.url);
    const shareLinkToken = url.searchParams.get("share");
    const magicCode = url.searchParams.get("code");
    if (!shareLinkToken || !magicCode) {
      return NextResponse.json({ error: "invalid" }, { status: 400 });
    }

    const slHash = hashShareLinkToken(shareLinkToken);
    const shareLinkData = await getShareLinkByTokenHash(slHash);

    if (!shareLinkData) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Check share link validity before the atomic claim
    if (shareLinkData.status !== "active" || shareLinkData.authMode !== "magic_link") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (shareLinkData.expiresAt && new Date(shareLinkData.expiresAt) < new Date()) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Check maxUses before consuming the magic link
    if (shareLinkData.maxUses !== null && shareLinkData.uses >= shareLinkData.maxUses) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const mlHash = hashMagicLinkToken(magicCode);

    // ATOMIC SINGLE-REDEEM CLAIM (FATAL, runs BEFORE any further D1 writes).
    //
    // The single-redeem guarantee lives here: claimMagicLink issues a
    // conditional UPDATE … WHERE consumed_at IS NULL RETURNING, so two
    // concurrent GETs with the same code can never both claim it — the
    // second caller receives 0 rows from the UPDATE and gets a "consumed"
    // result regardless of maxUses.
    const claimResult = await claimMagicLink(shareLinkData.blogId, mlHash);

    if (!claimResult.ok) {
      if (claimResult.reason === "not_found") {
        return NextResponse.json({ error: "not_found" }, { status: 404 });
      }
      if (claimResult.reason === "consumed") {
        return NextResponse.json({ error: "consumed" }, { status: 409 });
      }
      if (claimResult.reason === "expired") {
        return NextResponse.json({ error: "expired" }, { status: 410 });
      }
      // "not_yet" or any future reason
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const mlEmail = claimResult.email;

    // Increment share link uses with the finite-maxUses race guard. The
    // single-redeem gate above already prevents double-claim of this code; this
    // CAS still enforces the share-link's own maxUses budget.
    const incremented = await atomicIncrementUsesIfAvailable(
      shareLinkData.blogId,
      shareLinkData.id,
      shareLinkData.uses,
      shareLinkData.maxUses,
    );

    if (!incremented) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Create the interview in D1
    let interview;
    try {
      interview = await createInterview(DEFAULT_blog_id, {
        status: "consent",
        shareLinkId: shareLinkData.id,
        guestEmail: mlEmail ?? undefined,
        style: shareLinkData.style || "smart",
        recordingConfig: shareLinkData.recordingConfig || "transcript",
        maxDurationSec: shareLinkData.maxDurationSec || 300,
        topic: shareLinkData.topic || null,
        goal: shareLinkData.goal || null,
      });
    } catch (err: unknown) {
      log.error("Failed to create interview during magic-link redemption:", { error: String(err) });
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Redirect to consent page
    return NextResponse.redirect(
      new URL(`/i/${shareLinkToken}/consent?interview=${interview.id}`, request.url),
      302,
    );
  },
});
