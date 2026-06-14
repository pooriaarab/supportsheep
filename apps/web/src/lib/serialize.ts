/**
 * Serialize Firestore document data for passing to client components.
 * Converts Firestore Timestamps to ISO strings.
 */

export function serializeDoc<T extends Record<string, unknown>>(data: T): T {
  const result = { ...data };
  for (const [key, value] of Object.entries(result)) {
    if (value && typeof value === "object" && "toDate" in value) {
      // Firestore Timestamp → ISO string
      (result as Record<string, unknown>)[key] = (
        value as { toDate: () => Date }
      )
        .toDate()
        .toISOString();
    } else if (value && typeof value === "object" && "_seconds" in value) {
      // Serialized Timestamp object → ISO string
      const ts = value as { _seconds: number };
      (result as Record<string, unknown>)[key] = new Date(
        ts._seconds * 1000,
      ).toISOString();
    }
  }
  return result;
}
