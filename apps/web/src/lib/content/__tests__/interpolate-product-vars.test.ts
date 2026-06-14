import { describe, expect, it } from "vitest";
import { interpolateProductVars } from "@/lib/content/interpolate-product-vars";
import { SOLO_PRICING } from "@/lib/solo-product/pricing";

describe("interpolateProductVars", () => {
  it("returns input unchanged when there are no placeholders", () => {
    const input = "BlogBat works great for small businesses.";
    expect(interpolateProductVars(input, SOLO_PRICING)).toBe(input);
  });

  it("substitutes bare-dollar monthly and yearly values", () => {
    expect(
      interpolateProductVars(
        "Pro is {{solo.pro.yearly}}/mo billed annually or {{solo.pro.monthly}}/mo month-to-month.",
        SOLO_PRICING,
      ),
    ).toBe("Pro is $20/mo billed annually or $25/mo month-to-month.");
  });

  it("supports the .monthly modifier to append a /mo suffix", () => {
    expect(
      interpolateProductVars(
        "Pro starts at {{solo.pro.yearly.monthly}}.",
        SOLO_PRICING,
      ),
    ).toBe("Pro starts at $20/mo.");
  });

  it("emits a /yr suffix for yearlyAnnual totals", () => {
    expect(
      interpolateProductVars(
        "Annual Pro is {{solo.pro.yearlyAnnual}}; annual Grow is {{solo.grow.yearlyAnnual}}.",
        SOLO_PRICING,
      ),
    ).toBe("Annual Pro is $240/yr; annual Grow is $1080/yr.");
  });

  it("handles the free tier as $0", () => {
    expect(
      interpolateProductVars(
        "Free is {{solo.free.monthly.monthly}}.",
        SOLO_PRICING,
      ),
    ).toBe("Free is $0/mo.");
  });

  it("replaces multiple tiers in one pass", () => {
    expect(
      interpolateProductVars(
        "Pro {{solo.pro.yearly}}, Grow {{solo.grow.yearly}}.",
        SOLO_PRICING,
      ),
    ).toBe("Pro $20, Grow $90.");
  });

  it("leaves unknown tiers unchanged", () => {
    const input = "Unknown {{solo.enterprise.monthly}} tier.";
    expect(interpolateProductVars(input, SOLO_PRICING)).toBe(input);
  });

  it("leaves unknown fields unchanged", () => {
    const input = "{{solo.pro.quarterly}} is not a field.";
    expect(interpolateProductVars(input, SOLO_PRICING)).toBe(input);
  });

  it("leaves unknown modifiers unchanged", () => {
    const input = "{{solo.pro.yearly.weekly}} is not a modifier.";
    expect(interpolateProductVars(input, SOLO_PRICING)).toBe(input);
  });

  it("rejects yearlyAnnual with a modifier (no double suffix)", () => {
    const input = "{{solo.pro.yearlyAnnual.monthly}} should not resolve.";
    expect(interpolateProductVars(input, SOLO_PRICING)).toBe(input);
  });

  it("ignores unrelated double-brace templates", () => {
    const input = "{{user.name}} and {{solo}} are untouched.";
    expect(interpolateProductVars(input, SOLO_PRICING)).toBe(input);
  });

  it("is safe to call twice (idempotent on resolved output)", () => {
    const first = interpolateProductVars(
      "Pro is {{solo.pro.yearly.monthly}}.",
      SOLO_PRICING,
    );
    const second = interpolateProductVars(first, SOLO_PRICING);
    expect(second).toBe(first);
    expect(second).toBe("Pro is $20/mo.");
  });
});
