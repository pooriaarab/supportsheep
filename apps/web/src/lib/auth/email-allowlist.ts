/**
 * Workers-safe email-domain allowlist for the auth flow. Reads ONLY the
 * comma-separated `ALLOWED_EMAIL_DOMAINS` env var (e.g. "@supportsheep.com,@acme.io").
 *
 * Deliberately env-var-only and Workers-safe: it replaced a legacy Firestore-
 * backed `validateEmailDomain` (which statically imported firebase-admin and
 * couldn't run on Workers). Empty (the default) means all domains are allowed —
 * matching the legacy semantics for open deployments.
 */
export function getAllowedEmailDomains(): readonly string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/** True if `email`'s domain is permitted to authenticate. Allows all when no
 * domains are configured. Suffix match (domains are stored with their leading
 * "@", e.g. "@supportsheep.com"). */
export function isEmailAllowed(email: string): boolean {
  const domains = getAllowedEmailDomains();
  if (domains.length === 0) return true;
  const lower = email.toLowerCase();
  return domains.some((d) => lower.endsWith(d));
}
