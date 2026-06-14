/**
 * Normalize a hostname to its ASCII / punycode form so internationalized
 * domains (IDN, e.g. `münchen.de`) are stored and matched consistently.
 *
 * Uses the platform `URL` parser (available on workerd and Node) which applies
 * IDNA/ToASCII to the host — no `punycode` npm dependency (it's deprecated and
 * not reliably present on workerd). Returns the ASCII host lowercased, or null
 * when the input cannot be parsed as a hostname.
 */
export function toAsciiHostname(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase().replace(/\.$/, "");
  if (!trimmed) return null;
  // Reject anything that already looks like a URL with a scheme/path/spaces —
  // callers pass a bare hostname.
  if (/[\s/\\?#@]/.test(trimmed)) return null;

  try {
    // The URL parser punycode-encodes the host via IDNA. A bare ASCII host is
    // returned unchanged.
    const url = new URL(`https://${trimmed}`);
    const host = url.hostname;
    // `host` should now be pure ASCII (ToASCII). Reject if the parser left any
    // character that is not valid in an ASCII hostname (letters, digits, dots,
    // hyphens) — e.g. a runtime that kept the unicode host intact.
    if (/[^a-z0-9.-]/.test(host)) return null;
    return host;
  } catch {
    return null;
  }
}
