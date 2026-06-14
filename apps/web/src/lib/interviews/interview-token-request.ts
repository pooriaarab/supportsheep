import "server-only";
import { getInterviewTokenCookieName } from "@/lib/interviews/interview-token";

/**
 * Source the interview HMAC token used by guest API routes. Both the
 * `interview_token_<id>` HttpOnly cookie set by /consent and a legacy
 * `Authorization: Bearer <token>` header are accepted. Cookie wins when
 * both are present so a tab freshly returned from /consent always uses
 * the server-trusted cookie path even if it still carries a stale header
 * from an earlier session.
 *
 * Centralised so every guest-facing route under
 * `/api/v1/interviews/<id>/*` uses the same resolution order. Without this
 * the guest UI had to keep echoing the token in the URL query string
 * (`?itoken=…`), which leaked the token into browser history, Referer
 * headers, and server access logs.
 */
export function resolveInterviewTokenFromRequest(
  request: Request,
  interviewId: string,
): { token: string; source: "cookie" | "header" } | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieName = getInterviewTokenCookieName(interviewId);
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name !== cookieName) continue;
    const raw = part.slice(eq + 1).trim();
    if (!raw) continue;
    try {
      return { token: decodeURIComponent(raw), source: "cookie" };
    } catch {
      continue;
    }
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    if (token) return { token, source: "header" };
  }
  return null;
}
