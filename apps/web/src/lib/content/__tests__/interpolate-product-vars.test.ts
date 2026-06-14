import { describe, expect, it } from "vitest";
import { interpolateProductVars } from "@/lib/content/interpolate-product-vars";
import { SUPPORTSHEEP_PRICING } from "@/lib/supportsheep-product/pricing";

describe("interpolateProductVars", () => {
  it("returns input unchanged when there are no placeholders", () => {
    const input = "Supportsheep works great for small businesses.";
    expect(interpolateProductVars(input, SUPPORTSHEEP_PRICING)).toBe(input);
  });

  it("substitutes bare-dollar monthly and yearly values", () => {
    expect(
      interpolateProductVars(
        "Pro is {{supportsheep.pro.yearly}}/mo billed annually or {{supportsheep.pro.monthly}}/mo month-to-month.",
        SUPPORTSHEEP_PRICING,
      ),
    ).toBe("Pro is $20/mo billed annually or $25/mo month-to-month.");
  });

  it("supports the .monthly modifier to append a /mo suffix", () => {
    expect(
      interpolateProductVars(
        "Pro starts at {{supportsheep.pro.yearly.monthly}}.",
        SUPPORTSHEEP_PRICING,
      ),
    ).toBe("Pro starts at $20/mo.");
  });

  it("emits a /yr suffix for yearlyAnnual totals", () => {
    expect(
      interpolateProductVars(
        "Annual Pro is {{supportsheep.pro.yearlyAnnual}}; annual Grow is {{supportsheep.grow.yearlyAnnual}}.",
        SUPPORTSHEEP_PRICING,
      ),
    ).toBe("Annual Pro is $240/yr; annual Grow is $1080/yr.");
  });

  it("handles the free tier as $0", () => {
    expect(
      interpolateProductVars(
        "Free is {{supportsheep.free.monthly.monthly}}.",
        SUPPORTSHEEP_PRICING,
      ),
    ).toBe("Free is $0/mo.");
  });

  it("replaces multiple tiers in one pass", () => {
    expect(
      interpolateProductVars(
        "Pro {{supportsheep.pro.yearly}}, Grow {{supportsheep.grow.yearly}}.",
        SUPPORTSHEEP_PRICING,
      ),
    ).toBe("Pro $20, Grow $90.");
  });

  it("leaves unknown tiers unchanged", () => {
    const input = "Unknown {{supportsheep.enterprise.monthly}} tier.";
    expect(interpolateProductVars(input, SUPPORTSHEEP_PRICING)).toBe(input);
  });

  it("leaves unknown fields unchanged", () => {
    const input = "{{supportsheep.pro.quarterly}} is not a field.";
    expect(interpolateProductVars(input, SUPPORTSHEEP_PRICING)).toBe(input);
  });

  it("leaves unknown modifiers unchanged", () => {
    const input = "{{supportsheep.pro.yearly.weekly}} is not a modifier.";
    expect(interpolateProductVars(input, SUPPORTSHEEP_PRICING)).toBe(input);
  });

  it("rejects yearlyAnnual with a modifier (no double suffix)", () => {
    const input = "{{supportsheep.pro.yearlyAnnual.monthly}} should not resolve.";
    expect(interpolateProductVars(input, SUPPORTSHEEP_PRICING)).toBe(input);
  });

  it("ignores unrelated double-brace templates", () => {
    const input = "{{user.name}} and {{supportsheep}} are untouched.";
    expect(interpolateProductVars(input, SUPPORTSHEEP_PRICING)).toBe(input);
  });

  it("is safe to call twice (idempotent on resolved output)", () => {
    const first = interpolateProductVars(
      "Pro is {{supportsheep.pro.yearly.monthly}}.",
      SUPPORTSHEEP_PRICING,
    );
    const second = interpolateProductVars(first, SUPPORTSHEEP_PRICING);
    expect(second).toBe(first);
    expect(second).toBe("Pro is $20/mo.");
  });
});
