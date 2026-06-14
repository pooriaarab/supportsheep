/**
 * Shared helpers for the Phase 4 embed tools. Kept in a module-private
 * `_*` file so the tools/index.ts barrel auto-loader ignores it (the
 * existing `_types.ts` follows the same convention).
 *
 * The iframe-src allowlist (`isSafeIframeSrc`) is the single source of
 * truth for what's allowed inside `embed_iframe`. The named-embed
 * tools (`embed_youtube`, `embed_tweet`, etc.) construct their own
 * trusted src URLs and bypass this check — the helper exists to gate
 * the generic `embed_iframe` tool where the model supplies an
 * arbitrary URL.
 */

/**
 * Strict YouTube videoId regex (11 chars, base64url alphabet). Matches
 * the format YouTube uses today; reject everything else so the embed
 * URL we generate is well-formed.
 */
export const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

/** Strict tweet URL: twitter.com or x.com /{handle}/status/{numeric id}. */
export const TWEET_URL_REGEX =
  /^https:\/\/(twitter|x)\.com\/[A-Za-z0-9_]{1,15}\/status\/\d{1,25}(?:[/?#].*)?$/;

/** CodePen pen id is 6-8 alphanumeric chars. */
export const CODEPEN_PEN_REGEX = /^[A-Za-z0-9]{5,12}$/;

/** Gist id is a 32-char hex string (sometimes shorter for legacy gists). */
export const GIST_ID_REGEX = /^[A-Fa-f0-9]{8,40}$/;

/** Loom video id is a 32-char hex string. */
export const LOOM_ID_REGEX = /^[A-Fa-f0-9]{16,64}$/;

/**
 * Hostnames and patterns we never allow inside `embed_iframe`. Loopback
 * + RFC1918 + link-local addresses are blocked to prevent the model
 * from being tricked into rendering an iframe pointed at the host
 * Netlify edge network, customer LANs, or cloud metadata services. The
 * `data:`, `javascript:`, and `file:` URL schemes are blocked outright.
 *
 * IPv6 loopback (`[::1]`) and IPv6 link-local (`fe80::/10`) are caught
 * by parsing as a URL and checking the resolved hostname.
 */
const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "[::1]",
  "::1",
]);

const BLOCKED_HOST_PATTERNS: RegExp[] = [
  // RFC1918 private ranges + AWS/GCP metadata (169.254.169.254).
  /^10(?:\.\d{1,3}){3}$/,
  /^192\.168(?:\.\d{1,3}){2}$/,
  /^172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/,
  /^169\.254(?:\.\d{1,3}){2}$/,
  // IPv6 link-local (fe80::/10).
  /^\[?fe80:/i,
];

/**
 * Returns `true` only when `raw` is a parseable `https://` URL whose
 * host is not on the blocklist. Any other scheme (http, data,
 * javascript, file, ftp, gopher, …) or any blocked host returns
 * `false`. Callers must surface a `validation` error to the model on
 * `false` — never silently fall through.
 */
export function isSafeIframeSrc(raw: string): boolean {
  if (typeof raw !== "string" || raw.length === 0) return false;
  // Reject anything that doesn't start with `https://` before parsing —
  // the URL constructor accepts `data:` and `javascript:` as valid.
  if (!/^https:\/\//i.test(raw)) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return false;
  if (BLOCKED_HOSTS.has(`[${host}]`)) return false;
  for (const pat of BLOCKED_HOST_PATTERNS) {
    if (pat.test(host)) return false;
  }
  return true;
}
