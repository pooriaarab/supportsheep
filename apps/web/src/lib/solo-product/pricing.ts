/**
 * Single source of truth for Supportsheep product pricing referenced by blog content.
 *
 * Any page, script, or template that mentions a Supportsheep plan price must read
 * from here rather than hardcoding numbers, so the whole blog stays in sync
 * when pricing changes. Surface-level copy in Firestore (`uniqueContent`,
 * FAQ answers) references these values via `{{solo.*}}` placeholders that
 * `interpolateProductVars` resolves at render time.
 *
 * Values verified 2026-04-21 against the upstream pricing source.
 * When pricing changes, update BOTH the numbers AND `verifiedAt` in the same commit.
 */
export type SoloTierKey = "free" | "pro" | "grow";

export interface SoloPricingTier {
  /** USD per month when billed month-to-month. */
  monthly: number;
  /** USD per month when billed annually (the advertised "/mo" rate). */
  yearly: number;
  /** Total USD per year when on the annual plan. */
  yearlyAnnual: number;
}

export interface SoloPricing extends Record<SoloTierKey, SoloPricingTier> {
  verifiedAt: string;
  source: string;
}

export const SOLO_PRICING: SoloPricing = {
  free: { monthly: 0, yearly: 0, yearlyAnnual: 0 },
  pro: { monthly: 25, yearly: 20, yearlyAnnual: 240 },
  grow: { monthly: 120, yearly: 90, yearlyAnnual: 1080 },
  verifiedAt: "2026-04-21",
  source: "apps/website/src/data/Pricing.ts",
};

/** Format a tier's monthly rate (billed monthly) as "$25/mo". */
export function formatTierMonthly(tier: SoloTierKey): string {
  return `$${SOLO_PRICING[tier].monthly}/mo`;
}

/** Format a tier's annual-billed effective monthly rate as "$20/mo". */
export function formatTierYearly(tier: SoloTierKey): string {
  return `$${SOLO_PRICING[tier].yearly}/mo`;
}

/** Format a tier's total annual cost as "$240/yr". */
export function formatTierYearlyAnnual(tier: SoloTierKey): string {
  return `$${SOLO_PRICING[tier].yearlyAnnual}/yr`;
}
