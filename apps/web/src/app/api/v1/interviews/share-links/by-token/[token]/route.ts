import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { hashShareLinkToken } from "@/lib/interviews/share-link-token";
import { RATE_LIMITS } from "@/lib/rate-limit";
import type {
  ShareLinkPublicView,
} from "@/lib/interviews/share-link-schema";
import { getShareLinkByTokenHash } from "@/lib/interviews/share-links-repository";

/**
 * GET /api/v1/interviews/share-links/by-token/[token]
 * Resolves a plaintext token into a public-safe share link configuration.
 * Gated by active status, expiration date, and maximum uses.
 * Security: Always returns 404 on lifecycle failures to prevent existence leakage.
 */
// Note: no `audit` config — `createApiHandler` skips audit logging when
// `auth: "none"` (see create-api-handler.ts:125). Public token resolution
// is intentionally unaudited at this layer; if per-IP usage tracking is
// needed later, add it via the share-link `uses` counter or a dedicated
// access-log collection.
export const GET = createApiHandler<unknown, { token: string }>({
  auth: "none",
  rateLimit: {
    key: "share-link-by-token",
    maxPerMinute: RATE_LIMITS["share-link-by-token"],
  },
  handler: async ({ params }) => {
    const token = params?.token;
    if (!token || token.length < 32) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const hash = hashShareLinkToken(token);

    // Security check: Timing-safe-equivalent lookup.
    // For SHA-256 hash lookup, the D1 unique-index exact-match query on
    // token_hash is the secret-comparison layer. Timing attacks on string
    // comparison are prevented at the database index layer.
    const doc = await getShareLinkByTokenHash(hash);

    if (!doc) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Security check: lifecycle gating. Return 404 (not 403/410) to prevent
    // malicious actors from probing link existence.
    if (doc.status !== "active") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (doc.expiresAt && new Date(doc.expiresAt) < new Date()) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    if (doc.maxUses !== null && doc.uses >= doc.maxUses) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const publicView: ShareLinkPublicView = {
      topic: doc.topic,
      goal: doc.goal,
      style: doc.style,
      recordingConfig: doc.recordingConfig,
      maxDurationSec: doc.maxDurationSec,
      authMode: doc.authMode,
      type: doc.type,
      status: doc.status,
      language: doc.language || "en",
      scheduledAt: doc.scheduledAt ?? null,
      mode: doc.mode || "live",
    };

    return NextResponse.json(publicView);
  },
});
