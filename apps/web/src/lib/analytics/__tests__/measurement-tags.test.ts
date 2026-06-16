import { describe, expect, it } from "vitest";
import { resolvePublicMeasurementId } from "@/lib/analytics/measurement-tags";

describe("resolvePublicMeasurementId", () => {
  it("injects the host-resolved blog's own GA4 id", () => {
    expect(resolvePublicMeasurementId("G-AAAA1111", null)).toBe("G-AAAA1111");
  });

  it("isolates tenants: blog A's config yields A's id, never B's", () => {
    const blogA = resolvePublicMeasurementId("G-BLOGAAAA", null);
    const blogB = resolvePublicMeasurementId("G-BLOGBBBB", null);
    expect(blogA).toBe("G-BLOGAAAA");
    expect(blogB).toBe("G-BLOGBBBB");
    expect(blogA).not.toBe(blogB);
  });

  it("returns null (no script) when the knowledge base has no id and no integration", () => {
    expect(resolvePublicMeasurementId("", null)).toBeNull();
    expect(resolvePublicMeasurementId(undefined, undefined)).toBeNull();
    expect(resolvePublicMeasurementId(null, "")).toBeNull();
  });

  it("treats an invalid blog id as disabled and falls back to nothing", () => {
    expect(resolvePublicMeasurementId("not-a-ga-id", null)).toBeNull();
    expect(resolvePublicMeasurementId("UA-12345-6", null)).toBeNull();
    expect(resolvePublicMeasurementId("G-", null)).toBeNull();
  });

  it("normalizes the knowledge base id (trims + upper-cases) before injection", () => {
    expect(resolvePublicMeasurementId("  g-abc123  ", null)).toBe("G-ABC123");
  });

  it("falls back to the connected integration id only when no blog id is set", () => {
    expect(resolvePublicMeasurementId("", "G-INTEG999")).toBe("G-INTEG999");
    expect(resolvePublicMeasurementId(undefined, "G-INTEG999")).toBe(
      "G-INTEG999",
    );
  });

  it("prefers the per-blog config id over the connected integration id", () => {
    expect(resolvePublicMeasurementId("G-BLOGOWN1", "G-INTEG999")).toBe(
      "G-BLOGOWN1",
    );
  });

  it("ignores an invalid connected integration id when no blog id is set", () => {
    expect(resolvePublicMeasurementId("", "garbage")).toBeNull();
  });
});
