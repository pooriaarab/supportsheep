import { describe, expect, it } from "vitest";
import { normalizePublicDateValue } from "@/lib/public-content";

describe("normalizePublicDateValue", () => {
  it("accepts ISO strings and Firestore timestamp-like objects", () => {
    expect(normalizePublicDateValue("2026-04-15T00:00:00.000Z")).toBe(
      "2026-04-15T00:00:00.000Z",
    );
    expect(
      normalizePublicDateValue({
        toDate: () => new Date("2026-04-15T00:00:00.000Z"),
      }),
    ).toBe("2026-04-15T00:00:00.000Z");
    expect(normalizePublicDateValue({ _seconds: 1776211200 })).toBe(
      "2026-04-15T00:00:00.000Z",
    );
  });

  it("returns null for malformed values", () => {
    expect(normalizePublicDateValue("not-a-date")).toBeNull();
    expect(normalizePublicDateValue({})).toBeNull();
  });
});
