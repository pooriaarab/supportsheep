/**
 * Resolve `{{supportsheep.*}}` template variables in content strings to formatted
 * pricing values at render time.
 *
 * Grammar (all case-sensitive, whitespace not allowed inside braces):
 *   {{supportsheep.<tier>.monthly}}         -> "$25"
 *   {{supportsheep.<tier>.monthly.monthly}} -> "$25/mo"
 *   {{supportsheep.<tier>.yearly}}          -> "$20"
 *   {{supportsheep.<tier>.yearly.monthly}}  -> "$20/mo"
 *   {{supportsheep.<tier>.yearlyAnnual}}    -> "$240/yr"
 *
 * Rules:
 *   - `<tier>` is one of `free`, `pro`, `grow`. Anything else is left
 *     unchanged so a stray `{{supportsheep.foo.monthly}}` does not silently vanish.
 *   - `yearlyAnnual` always carries an implicit `/yr` suffix -- the value only
 *     makes sense as an annual total.
 *   - `monthly` and `yearly` emit bare-dollar strings by default so copy
 *     editors can write prose like "for {{supportsheep.pro.yearly}}/mo billed
 *     annually" without doubling up units. Append the `.monthly` modifier
 *     when the surrounding sentence expects the `/mo` suffix.
 *   - Unknown placeholders (unknown tier, unknown field, unknown modifier)
 *     are returned unchanged so a mistyped token surfaces in QA rather than
 *     being dropped silently.
 *
 * Pure function: no I/O, no side effects. Safe to call at render time from a
 * server component or a build script.
 */
import type {
  SupportsheepPricing,
  SupportsheepTierKey,
} from "@/lib/supportsheep-product/pricing";

const TIER_KEYS: readonly SupportsheepTierKey[] = ["free", "pro", "grow"];

const PLACEHOLDER = /\{\{supportsheep\.([^}]+)\}\}/g;

function isTierKey(value: string): value is SupportsheepTierKey {
  return (TIER_KEYS as readonly string[]).includes(value);
}

/**
 * Replace every `{{supportsheep.*}}` placeholder in `input` with a formatted price
 * drawn from `pricing`. Unknown placeholders are preserved verbatim.
 */
export function interpolateProductVars(
  input: string,
  pricing: SupportsheepPricing,
): string {
  if (!input.includes("{{supportsheep.")) return input;

  return input.replace(PLACEHOLDER, (match, rawPath: string) => {
    const parts = rawPath.split(".");
    if (parts.length < 2 || parts.length > 3) return match;

    const [tierRaw, field, modifier] = parts;
    if (!tierRaw || !field) return match;
    if (!isTierKey(tierRaw)) return match;

    const tier = pricing[tierRaw];

    switch (field) {
      case "monthly":
      case "yearly": {
        const amount = tier[field];
        if (modifier === undefined) return `$${amount}`;
        if (modifier === "monthly") return `$${amount}/mo`;
        return match;
      }
      case "yearlyAnnual": {
        if (modifier !== undefined) return match;
        return `$${tier.yearlyAnnual}/yr`;
      }
      default:
        return match;
    }
  });
}
