/**
 * Shallowly omit keys whose value is `undefined`.
 *
 * Useful before writing to the Firestore admin SDK when
 * `ignoreUndefinedProperties` is not in effect, or as a belt-and-braces
 * guard regardless. The Firestore admin SDK throws when any field on a
 * document is `undefined`, which produces silent failures when the
 * caller does not surface the error.
 *
 * `null` values are preserved (Firestore treats them as explicit nulls).
 * Nested objects are not traversed — strip those at construction time.
 */
export function stripUndefined<T extends object>(value: T): T {
  const result = {} as Record<string, unknown>;
  for (const [key, v] of Object.entries(value)) {
    if (v !== undefined) {
      result[key] = v;
    }
  }
  return result as T;
}
