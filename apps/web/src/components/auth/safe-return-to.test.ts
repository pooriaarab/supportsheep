import { describe, it, expect } from "vitest";

import { safeReturnTo } from "./safe-return-to";

describe("safeReturnTo", () => {
  it("allows a normal same-origin path", () => {
    expect(safeReturnTo("/dashboard")).toBe("/dashboard");
    expect(safeReturnTo("/posts/123?tab=seo")).toBe("/posts/123?tab=seo");
    expect(safeReturnTo("/")).toBe("/");
  });

  it("rejects protocol-relative URLs", () => {
    expect(safeReturnTo("//evil.com")).toBe("/dashboard");
  });

  it("rejects backslash open-redirect bypasses (browsers normalize \\ to /)", () => {
    expect(safeReturnTo("/\\evil.com")).toBe("/dashboard");
    expect(safeReturnTo("/foo\\bar")).toBe("/dashboard");
  });

  it("rejects absolute URLs and non-path values", () => {
    expect(safeReturnTo("https://evil.com")).toBe("/dashboard");
    expect(safeReturnTo("javascript:alert(1)")).toBe("/dashboard");
    expect(safeReturnTo("evil.com")).toBe("/dashboard");
  });

  it("falls back when empty/missing", () => {
    expect(safeReturnTo("")).toBe("/dashboard");
    expect(safeReturnTo(null)).toBe("/dashboard");
    expect(safeReturnTo(undefined)).toBe("/dashboard");
  });

  it("honors a custom fallback", () => {
    expect(safeReturnTo("//evil.com", "/home")).toBe("/home");
  });
});
