/**
 * Structural check for a Firestore-style `Timestamp` without importing the
 * firebase-admin SDK. Legacy Firestore documents (and any RSC payload that
 * still carries one) expose a `toDate(): Date` method; D1-sourced dates are
 * already epoch-ms numbers or ISO strings. Duck-typing keeps the conversion
 * helpers working for any straggler Timestamp instances without pulling
 * firebase-admin back into the module graph.
 */
function isTimestampLike(
  value: unknown,
): value is { toDate: () => Date } {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  );
}

/**
 * Serialize a Firestore Timestamp (or already-stringified value) to an ISO
 * string for client consumption.
 *
 * Firestore Admin SDK returned `Timestamp` instances which JSON-encode as
 * `{_seconds, _nanoseconds}` — useless to `new Date()` on the client. Run
 * every legacy date field through this helper before sending it down.
 * Returns `null` for unset values so the client can branch on "no value"
 * vs. "unparseable value".
 */
export function toIsoString(value: unknown): string | null {
  if (!value) return null;
  if (isTimestampLike(value)) return value.toDate().toISOString();
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

/**
 * Recursively walk an arbitrary value and replace any Firestore `Timestamp`
 * (or `Date`) instances with ISO strings. All other values pass through
 * unchanged.
 *
 * Server Components that hand documents to `"use client"` components MUST run
 * the doc through this first: the Next.js RSC payload serializer throws on
 * `Timestamp`/`Date` instances, and that throw fires AFTER the page function
 * returns successfully — meaning try/catch in the page cannot recover from it.
 * A clean sweep here is the only safe boundary.
 */
export function coerceFirestoreTimestamps(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (isTimestampLike(value)) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(coerceFirestoreTimestamps);
  if (typeof value === "object") {
    const input = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(input)) {
      out[key] = coerceFirestoreTimestamps(input[key]);
    }
    return out;
  }
  return value;
}
