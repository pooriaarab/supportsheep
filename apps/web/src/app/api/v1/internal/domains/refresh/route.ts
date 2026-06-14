/**
 * Internal domain-status refresh (cron-driven, not user-facing)
 *
 * POST /api/v1/internal/domains/refresh
 *
 * Advances every `pending` custom domain → active/failed by polling Cloudflare,
 * persisting transitions, and sending deduped notification emails — so a domain
 * is never stuck on "pending" waiting for the owner to manually click "Check
 * status".
 *
 * Auth: `auth: "none"` (no session — this is machine-to-machine), GATED by a
 * shared secret. The caller must send `x-internal-cron-secret` matching the
 * `INTERNAL_CRON_SECRET` worker secret; the comparison is constant-time and the
 * endpoint fails closed (403) when the secret is unset. See wrangler.jsonc for
 * the Cron Trigger that invokes this on a schedule.
 */

import { timingSafeEqual } from "node:crypto";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { createApiHandler } from "@/lib/create-api-handler";
import { CustomDomainsNotConfiguredError } from "@/lib/domains/cloudflare-saas";
import { refreshAllPendingDomains } from "@/lib/domains/refresh";

const SECRET_HEADER = "x-internal-cron-secret";

/** Constant-time string compare that never short-circuits on length. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual requires equal-length buffers; compare against a padded
  // copy of `a` sized to `b` so a length mismatch still runs in constant time.
  const padded = Buffer.alloc(b.length);
  a.copy(padded);
  return timingSafeEqual(padded, b) && a.length === b.length;
}

export const POST = createApiHandler({
  auth: "none",
  handler: async ({ request }) => {
    // INTERNAL_CRON_SECRET is a Worker *secret* (not a text var). Under
    // @opennextjs/cloudflare a secret is surfaced via `process.env`, whereas
    // text vars/bindings come through `getCloudflareContext().env` — reading a
    // secret only from the CF context yields `undefined`, so this endpoint
    // always failed closed (403) no matter how the secret was set. Read
    // `process.env` first and fall back to the CF context for robustness.
    const expected =
      process.env.INTERNAL_CRON_SECRET ??
      getCloudflareContext().env.INTERNAL_CRON_SECRET;
    const provided = request.headers.get(SECRET_HEADER);

    // Fail closed: no configured secret → no access.
    if (!expected || !provided || !secretMatches(provided, expected)) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    try {
      const result = await refreshAllPendingDomains({}, getDb());
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof CustomDomainsNotConfiguredError) {
        return NextResponse.json(
          { error: "custom_domains_not_configured" },
          { status: 503 },
        );
      }
      throw error;
    }
  },
});
