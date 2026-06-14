import { describe, expect, it } from "vitest";
import {
  SOLO_PRICING,
  formatTierMonthly,
  formatTierYearly,
  formatTierYearlyAnnual,
} from "@/lib/solo-product/pricing";

describe("SOLO_PRICING", () => {
  it("exposes the current Pro and Grow tier rates", () => {
    expect(SOLO_PRICING.pro).toEqual({
      monthly: 25,
      yearly: 20,
      yearlyAnnual: 240,
    });
    expect(SOLO_PRICING.grow).toEqual({
      monthly: 120,
      yearly: 90,
      yearlyAnnual: 1080,
    });
  });

  it("zeros the free tier so formatters stay safe", () => {
    expect(SOLO_PRICING.free).toEqual({
      monthly: 0,
      yearly: 0,
      yearlyAnnual: 0,
    });
  });

  it("records a verifiedAt date and source", () => {
    expect(SOLO_PRICING.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(SOLO_PRICING.source).toContain("Pricing.ts");
  });
});

describe("format helpers", () => {
  it("formats a tier's monthly rate with a /mo suffix", () => {
    expect(formatTierMonthly("pro")).toBe("$25/mo");
    expect(formatTierMonthly("grow")).toBe("$120/mo");
  });

  it("formats a tier's annual-billed effective monthly rate", () => {
    expect(formatTierYearly("pro")).toBe("$20/mo");
  });

  it("formats a tier's total annual cost with a /yr suffix", () => {
    expect(formatTierYearlyAnnual("pro")).toBe("$240/yr");
    expect(formatTierYearlyAnnual("grow")).toBe("$1080/yr");
  });
});
