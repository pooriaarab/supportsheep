/**
 * Same-origin path guard for post-login redirects (`returnTo` → magic-link
 * `callbackURL`). Prevents open-redirect: an attacker-supplied `returnTo` must
 * not send the freshly-authenticated user to an external site.
 *
 * Rejects:
 * - non-absolute paths and absolute URLs (`https://evil.com`),
 * - protocol-relative URLs (`//evil.com`),
 * - backslash variants (`/\evil.com`) — browsers normalize `\` to `/`, so this
 *   would otherwise resolve to `//evil.com`.
 *
 * Falls back to `/dashboard`.
 */
export function safeReturnTo(
  raw: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback; // must be an absolute path
  if (raw.startsWith("//")) return fallback; // protocol-relative
  if (raw.includes("\\")) return fallback; // browsers normalize "\" → "/"
  return raw;
}
