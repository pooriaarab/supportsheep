import { describe, it, expect } from "vitest";
import { resolveLegacyRedirect } from "@/lib/legacy-redirects";

describe("resolveLegacyRedirect", () => {
  it("redirects /uncategorized/foo to /foo", () => {
    expect(resolveLegacyRedirect("/uncategorized/foo")).toBe("/foo");
  });
  it("redirects /website-tips/foo to /foo", () => {
    expect(resolveLegacyRedirect("/website-tips/foo")).toBe("/foo");
  });
  it("redirects /tag/foo to /", () => {
    expect(resolveLegacyRedirect("/tag/foo")).toBe("/");
  });
  it("does not redirect canonical /category/foo archive paths", () => {
    expect(resolveLegacyRedirect("/category/foo")).toBeNull();
  });
  it("redirects nested /uncategorized/a/b to /b (last-segment canonical)", () => {
    expect(resolveLegacyRedirect("/uncategorized/a/b")).toBe("/b");
  });
  it("returns null for already-flat paths", () => {
    expect(resolveLegacyRedirect("/foo")).toBeNull();
    expect(resolveLegacyRedirect("/")).toBeNull();
  });
  it("returns null for API/asset paths", () => {
    expect(resolveLegacyRedirect("/api/v1/articles")).toBeNull();
    expect(resolveLegacyRedirect("/_next/static/x.js")).toBeNull();
  });
  it("strips trailing slash from input before matching", () => {
    expect(resolveLegacyRedirect("/uncategorized/foo/")).toBe("/foo");
  });
  it("redirects bare /tag to /", () => {
    expect(resolveLegacyRedirect("/tag")).toBe("/");
  });
  it("redirects bare /category to /", () => {
    expect(resolveLegacyRedirect("/category")).toBe("/");
  });
  it("redirects bare /uncategorized to /", () => {
    expect(resolveLegacyRedirect("/uncategorized")).toBe("/");
  });
  it("redirects bare /website-tips to /", () => {
    expect(resolveLegacyRedirect("/website-tips")).toBe("/");
  });
  it("redirects /niches/<slug> to /<slug>", () => {
    expect(resolveLegacyRedirect("/niches/website-for-wedding-planners")).toBe(
      "/website-for-wedding-planners",
    );
  });
  it("redirects /marketing-tips/<slug> to /<slug>", () => {
    expect(
      resolveLegacyRedirect("/marketing-tips/top-massage-therapy-marketing"),
    ).toBe("/top-massage-therapy-marketing");
  });
  it("redirects /business-tips/<slug> to /<slug>", () => {
    expect(
      resolveLegacyRedirect("/business-tips/landscaping-business-tips"),
    ).toBe("/landscaping-business-tips");
  });
  it("redirects /doc/<anything> to / (no modern doc paths on blog)", () => {
    expect(resolveLegacyRedirect("/doc/privacy-policy")).toBe("/");
  });
  it("redirects /support/<anything> to / (no support paths on blog)", () => {
    expect(resolveLegacyRedirect("/support/privacy-policy")).toBe("/");
  });
  it("redirects /alternatives/wix to /vs/wix", () => {
    expect(resolveLegacyRedirect("/alternatives/wix")).toBe("/vs/wix");
  });
  it("redirects /alternatives/squarespace to /vs/squarespace", () => {
    expect(resolveLegacyRedirect("/alternatives/squarespace")).toBe(
      "/vs/squarespace",
    );
  });
  it("does not redirect /alternatives hub page", () => {
    expect(resolveLegacyRedirect("/alternatives")).toBeNull();
  });
  it("does not redirect /alternatives/slug/for/vertical subpaths", () => {
    expect(
      resolveLegacyRedirect("/alternatives/squarespace/for/dentists"),
    ).toBeNull();
  });
});
