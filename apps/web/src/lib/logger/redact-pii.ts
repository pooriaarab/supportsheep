/**
 * PII redaction for client-shipped log entries.
 *
 * Replaces values whose serialised form contains any of the sensitive
 * substrings (`bearer`, `token`, `cookie`, `password`, `apiKey`) with the
 * literal string `"[REDACTED]"` before the entry is forwarded to Cloud
 * Logging. Substring matching is case-insensitive and applied to:
 *
 * - the log message text
 * - every value inside the `data` object (recursively, including nested
 *   objects and arrays)
 *
 * Keys themselves are also checked so a field literally named `apiKey`
 * is redacted regardless of its value.
 */

/** Sensitive substrings (matched case-insensitively). */
export const REDACT_PATTERNS = [
  "bearer",
  "token",
  "cookie",
  "password",
  "apikey",
] as const;

const REDACTED = "[REDACTED]";

function containsSensitive(input: string): boolean {
  const lower = input.toLowerCase();
  return REDACT_PATTERNS.some((p) => lower.includes(p));
}

/**
 * Redact a single value. Strings are checked for the sensitive substrings;
 * objects/arrays are walked recursively; everything else is returned as-is.
 */
export function redactValue(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return containsSensitive(value) ? REDACTED : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (containsSensitive(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = redactValue(v);
      }
    }
    return out;
  }
  return value;
}

export interface RedactableEntry {
  message: string;
  data?: Record<string, unknown>;
}

/** Redact an entire log entry: message + data tree. */
export function redactLogEntry<T extends RedactableEntry>(entry: T): T {
  const redactedMessage = containsSensitive(entry.message)
    ? REDACTED
    : entry.message;
  const redactedData =
    entry.data === undefined
      ? undefined
      : (redactValue(entry.data) as Record<string, unknown>);
  return { ...entry, message: redactedMessage, data: redactedData };
}
