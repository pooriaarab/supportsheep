import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("interviews:lifecycle");

/**
 * HMAC secret used to sign + verify guest interview tokens.
 *
 * Cold-start trap (the real cause of the prod "401 on
 * /api/v1/interviews/[id]/stream" the user reported): a per-process
 * `randomBytes(32)` fallback means every Netlify Function cold start gets
 * a fresh secret. The consent route mints a token with secret X on
 * instance A; the stream route boots fresh on instance B with secret Y,
 * and the SSE connection 401s instantly.
 *
 * Resolution order:
 *   1. `INTERVIEW_TOKEN_SECRET` env var — preferred, explicit, rotatable.
 *   2. SHA-256 of a tagged `FIREBASE_ADMIN_PRIVATE_KEY` — stable
 *      per-project and guaranteed to be set in any production
 *      environment (the admin SDK requires it), so the secret survives
 *      cold starts without needing an extra env var. The
 *      `"interview-token:"` tag prevents accidental reuse with any
 *      other HMAC that might key off the same private key.
 *   3. Random — dev-only, with a loud error if we ever land here in prod.
 */
const SECRET = (() => {
  const secret = process.env.INTERVIEW_TOKEN_SECRET;
  if (secret) return secret;

  const firebaseKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (firebaseKey) {
    return createHash("sha256")
      .update(`interview-token:${firebaseKey}`)
      .digest("hex");
  }

  if (process.env.NODE_ENV === "production") {
    log.error(
      "INTERVIEW_TOKEN_SECRET and FIREBASE_ADMIN_PRIVATE_KEY are both unset — guest interview tokens will fail to verify across serverless cold starts.",
    );
  }
  return randomBytes(32).toString("hex");
})();

const TOKEN_TTL_SEC = 30 * 60; // 30 min — caps the longest possible interview

export interface InterviewTokenPayload {
  interviewId: string;
  iat: number; // issued-at, unix seconds
  exp: number; // expiry, unix seconds
}

export function mintInterviewToken(interviewId: string, ttlSec = TOKEN_TTL_SEC): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSec;
  const payload: InterviewTokenPayload = { interviewId, iat, exp };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/**
 * Build the cookie name used to scope an interview token to a specific
 * interview document. Per-interview scoping means a leaked cookie for
 * interview A cannot be replayed against interview B.
 */
export function getInterviewTokenCookieName(interviewId: string): string {
  return `interview_token_${interviewId}`;
}

/**
 * Cookie attributes used for the interview-token cookie. Centralised here so
 * the consent route, future logout/cleanup routes, and tests stay in sync.
 *
 * - HttpOnly: blocks JavaScript access — token cannot be exfiltrated by XSS.
 * - Secure: requires HTTPS in production. Disabled in non-prod for local
 *   `http://localhost` dev (browsers reject `Secure` on plain HTTP).
 * - SameSite=Lax: sent on top-level navigations and same-origin sub-requests
 *   (the EventSource lives on the same origin as /consent so this is enough
 *   for SSE to work). Threat-model trade-off vs `Strict`:
 *     * `Strict` (previous setting) blocked CSRF AND blocked the cookie from
 *       being attached on the very first same-site EventSource after a
 *       cross-site magic-link navigation — the browser hadn't yet established
 *       a "site context" so the first request shipped without the cookie,
 *       drove an instant 401, and the client backed off → reconnected once
 *       the cookie store had caught up. Symptom: connect-time SSE drops on
 *       every magic-link arrival.
 *     * `Lax` still blocks the only CSRF surface that matters here: state-
 *       changing POSTs from third-party origins. The interview API endpoints
 *       under /api/v1/interviews/<id> all require this cookie AND are GET
 *       (stream) or same-origin POSTs (events, session-lock) initiated from
 *       /consent's own JS — there's no third-party form submission path.
 *     * Worst-case under Lax: a malicious site could trigger a top-level
 *       navigation to /api/v1/interviews/<id>/stream and the cookie would
 *       ride along, but the stream is a read-only SSE that just echoes
 *       writer diffs — no state mutation, no exfiltratable secret in the
 *       response payload that the attacker site could read across origins.
 *   Net: Lax preserves the practical CSRF defence while eliminating the
 *   connect-time race that was the documented prod symptom.
 * - Path: scoped to `/api/v1/interviews/<id>` so unrelated routes never see
 *   the token in their request headers (defence in depth — even a verbose
 *   request log on `/api/v1/articles` won't capture interview tokens).
 * - Max-Age: matches `TOKEN_TTL_SEC` (default 30 min). Browser auto-evicts
 *   when the underlying HMAC token would already have expired.
 */
export function buildInterviewTokenCookie(
  interviewId: string,
  token: string,
  ttlSec: number = TOKEN_TTL_SEC,
): {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: string;
    maxAge: number;
  };
} {
  return {
    name: getInterviewTokenCookieName(interviewId),
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: `/api/v1/interviews/${interviewId}`,
      maxAge: ttlSec,
    },
  };
}

export function verifyInterviewToken(token: string): InterviewTokenPayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;

    const expected = createHmac("sha256", SECRET).update(body).digest("base64url");

    // Constant-time comparison using timingSafeEqual
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as InterviewTokenPayload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.interviewId !== "string" || !payload.interviewId) return null;

    return payload;
  } catch {
    return null;
  }
}
