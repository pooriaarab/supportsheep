import { describe, expect, it } from "vitest";
import {
  isValidTopBannerHex,
  normalizeTopBannerHex,
} from "@/lib/top-banner-color";

describe("normalizeTopBannerHex", () => {
  it("normalizes valid hex with or without # to uppercase #RRGGBB", () => {
    expect(normalizeTopBannerHex("a1b2c3")).toBe("#A1B2C3");
    expect(normalizeTopBannerHex("#d4e5f6")).toBe("#D4E5F6");
    expect(normalizeTopBannerHex("  #abcdef  ")).toBe("#ABCDEF");
  });

  it("returns null for partial or invalid hex input", () => {
    expect(normalizeTopBannerHex("abc")).toBeNull();
    expect(normalizeTopBannerHex("#12345")).toBeNull();
    expect(normalizeTopBannerHex("zzzzzz")).toBeNull();
    expect(normalizeTopBannerHex("#12G45Z")).toBeNull();
    expect(normalizeTopBannerHex("")).toBeNull();
    expect(normalizeTopBannerHex("   ")).toBeNull();
  });
});

describe("isValidTopBannerHex", () => {
  it("reports whether a value is a valid banner hex", () => {
    expect(isValidTopBannerHex("#A1B2C3")).toBe(true);
    expect(isValidTopBannerHex("d4e5f6")).toBe(true);
    expect(isValidTopBannerHex(" #abcdef ")).toBe(true);

    expect(isValidTopBannerHex("abcd")).toBe(false);
    expect(isValidTopBannerHex("#12345")).toBe(false);
    expect(isValidTopBannerHex("#12G45Z")).toBe(false);
  });
});
