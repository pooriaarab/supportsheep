const LEGACY_PREFIXES = [
  "/uncategorized/",
  "/website-tips/",
  "/niches/",
  "/marketing-tips/",
  "/business-tips/",
] as const;
const LEGACY_LANDING_PREFIXES = ["/tag/", "/doc/", "/support/"] as const;
const LEGACY_BARE_PATHS = [
  "/uncategorized",
  "/website-tips",
  "/niches",
  "/marketing-tips",
  "/business-tips",
  "/tag",
  "/category",
  "/doc",
  "/support",
] as const;

/**
 * Returns the canonical path for a legacy URL, or null if the path is already
 * canonical or excluded from redirect handling.
 */
export function resolveLegacyRedirect(pathname: string): string | null {
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return null;
  }

  const trimmed =
    pathname.endsWith("/") && pathname !== "/"
      ? pathname.slice(0, -1)
      : pathname;

  for (const prefix of LEGACY_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      const tail = trimmed.slice(prefix.length);
      const lastSegment = tail.split("/").filter(Boolean).pop();
      return lastSegment ? `/${lastSegment}` : "/";
    }
  }

  for (const prefix of LEGACY_LANDING_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return "/";
    }
  }

  if ((LEGACY_BARE_PATHS as readonly string[]).includes(trimmed)) {
    return "/";
  }

  const altMatch = /^\/alternatives\/([a-z0-9-]+)$/.exec(trimmed);
  if (altMatch) {
    return `/vs/${altMatch[1]}`;
  }

  return null;
}

/**
 * Returns the canonical (non-trailing-slash) path, or null if the pathname
 * is already canonical or excluded from redirect handling.
 *
 * Root (`/`) is returned unchanged; callers should compare the result to the
 * original pathname before issuing a redirect.
 */
export function normalizeTrailingSlash(pathname: string): string | null {
  if (pathname === "/") return "/";
  if (pathname.startsWith("/_next/") || pathname.startsWith("/api/"))
    return null;
  if (!pathname.endsWith("/")) return null;
  return pathname.slice(0, -1);
}
