import { describe, it, expect } from "vitest";
import { normalizeTrailingSlash } from "../legacy-redirects";

describe("normalizeTrailingSlash", () => {
  it("strips trailing slash from non-root paths", () => {
    expect(normalizeTrailingSlash("/foo/")).toBe("/foo");
    expect(normalizeTrailingSlash("/foo/bar/")).toBe("/foo/bar");
  });
  it("preserves root slash", () => {
    expect(normalizeTrailingSlash("/")).toBe("/");
  });
  it("returns null when path is already canonical", () => {
    expect(normalizeTrailingSlash("/foo")).toBeNull();
  });
  it("ignores asset paths", () => {
    expect(normalizeTrailingSlash("/_next/static/foo.js/")).toBeNull();
  });
});
