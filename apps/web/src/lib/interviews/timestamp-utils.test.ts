import { describe, expect, it } from "vitest";
import { coerceFirestoreTimestamps, toIsoString } from "./timestamp-utils";

/**
 * Duck-typed stand-in for a Firestore `Timestamp`. The conversion helpers no
 * longer import firebase-admin — they structurally match any object exposing a
 * `toDate(): Date` method, which is exactly the legacy Timestamp contract.
 */
function makeTimestamp(date: Date): { toDate: () => Date } {
  return { toDate: () => date };
}

describe("toIsoString", () => {
  it("converts a Firestore-style Timestamp to an ISO string", () => {
    const ts = makeTimestamp(new Date("2026-01-02T03:04:05.000Z"));
    expect(toIsoString(ts)).toBe("2026-01-02T03:04:05.000Z");
  });

  it("passes through existing ISO strings", () => {
    expect(toIsoString("2026-01-02T03:04:05.000Z")).toBe("2026-01-02T03:04:05.000Z");
  });

  it("converts a Date to an ISO string", () => {
    expect(toIsoString(new Date("2026-01-02T03:04:05.000Z"))).toBe("2026-01-02T03:04:05.000Z");
  });

  it("returns null for unset values", () => {
    expect(toIsoString(undefined)).toBeNull();
    expect(toIsoString(null)).toBeNull();
  });

  it("returns null for unparseable values", () => {
    expect(toIsoString({ foo: "bar" })).toBeNull();
    expect(toIsoString(42)).toBeNull();
  });
});

describe("coerceFirestoreTimestamps", () => {
  it("converts top-level Timestamp fields to ISO strings", () => {
    const ts = makeTimestamp(new Date("2026-01-02T03:04:05.000Z"));
    const result = coerceFirestoreTimestamps({
      createdAt: ts,
      startedAt: ts,
      endedAt: ts,
      updatedAt: ts,
      title: "hello",
    }) as Record<string, unknown>;

    expect(result.createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(result.startedAt).toBe("2026-01-02T03:04:05.000Z");
    expect(result.endedAt).toBe("2026-01-02T03:04:05.000Z");
    expect(result.updatedAt).toBe("2026-01-02T03:04:05.000Z");
    expect(result.title).toBe("hello");
  });

  it("converts nested Timestamps inside objects and arrays", () => {
    const ts = makeTimestamp(new Date("2026-01-02T03:04:05.000Z"));
    const result = coerceFirestoreTimestamps({
      meta: { createdAt: ts, nested: { updatedAt: ts } },
      events: [{ at: ts }, { at: ts }],
    }) as {
      meta: { createdAt: string; nested: { updatedAt: string } };
      events: Array<{ at: string }>;
    };

    expect(result.meta.createdAt).toBe("2026-01-02T03:04:05.000Z");
    expect(result.meta.nested.updatedAt).toBe("2026-01-02T03:04:05.000Z");
    expect(result.events[0].at).toBe("2026-01-02T03:04:05.000Z");
    expect(result.events[1].at).toBe("2026-01-02T03:04:05.000Z");
  });

  it("converts Date instances to ISO strings", () => {
    const result = coerceFirestoreTimestamps({
      when: new Date("2026-01-02T03:04:05.000Z"),
    }) as { when: string };
    expect(result.when).toBe("2026-01-02T03:04:05.000Z");
  });

  it("leaves non-timestamp values alone", () => {
    const input = {
      str: "hello",
      num: 42,
      bool: true,
      nul: null,
      undef: undefined,
      arr: [1, "two", false],
    };
    const result = coerceFirestoreTimestamps(input) as typeof input;
    expect(result.str).toBe("hello");
    expect(result.num).toBe(42);
    expect(result.bool).toBe(true);
    expect(result.nul).toBeNull();
    expect(result.undef).toBeUndefined();
    expect(result.arr).toEqual([1, "two", false]);
  });

  it("returns an object whose JSON serialization contains no Timestamp residue", () => {
    const ts = makeTimestamp(new Date("2026-01-02T03:04:05.000Z"));
    const result = coerceFirestoreTimestamps({
      createdAt: ts,
      nested: { updatedAt: ts },
      events: [{ at: ts }],
    });
    const json = JSON.stringify(result);
    // Timestamp.toJSON yields {_seconds, _nanoseconds}; ensure none remain.
    expect(json).not.toContain("_seconds");
    expect(json).not.toContain("_nanoseconds");
  });

  it("passes primitives through unchanged", () => {
    expect(coerceFirestoreTimestamps(null)).toBeNull();
    expect(coerceFirestoreTimestamps(undefined)).toBeUndefined();
    expect(coerceFirestoreTimestamps("hello")).toBe("hello");
    expect(coerceFirestoreTimestamps(42)).toBe(42);
    expect(coerceFirestoreTimestamps(true)).toBe(true);
  });
});
