import { describe, expect, it } from "vitest";

import { toAsciiHostname } from "./punycode";

describe("toAsciiHostname", () => {
  it("lowercases and trims a plain ASCII host", () => {
    expect(toAsciiHostname("  Blog.Example.COM ")).toBe("blog.example.com");
  });

  it("strips a trailing dot", () => {
    expect(toAsciiHostname("example.com.")).toBe("example.com");
  });

  it("punycode-encodes an IDN host", () => {
    expect(toAsciiHostname("münchen.de")).toBe("xn--mnchen-3ya.de");
  });

  it("encodes a unicode subdomain", () => {
    expect(toAsciiHostname("blög.example.com")).toBe(
      "xn--blg-tna.example.com",
    );
  });

  it("rejects empty / whitespace input", () => {
    expect(toAsciiHostname("")).toBeNull();
    expect(toAsciiHostname("   ")).toBeNull();
  });

  it("rejects inputs with a scheme, path, or spaces", () => {
    for (const bad of [
      "http://example.com",
      "example.com/path",
      "a b.com",
      "user@example.com",
      "example.com?x=1",
    ]) {
      expect(toAsciiHostname(bad)).toBeNull();
    }
  });
});
