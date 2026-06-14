/**
 * Resolve `{{solo.*}}` template variables in content strings to formatted
 * pricing values at render time.
 *
 * Grammar (all case-sensitive, whitespace not allowed inside braces):
 *   {{solo.<tier>.monthly}}         -> "$25"
 *   {{solo.<tier>.monthly.monthly}} -> "$25/mo"
 *   {{solo.<tier>.yearly}}          -> "$20"
 *   {{solo.<tier>.yearly.monthly}}  -> "$20/mo"
 *   {{solo.<tier>.yearlyAnnual}}    -> "$240/yr"
 *
 * Rules:
 *   - `<tier>` is one of `free`, `pro`, `grow`. Anything else is left
 *     unchanged so a stray `{{solo.foo.monthly}}` does not silently vanish.
 *   - `yearlyAnnual` always carries an implicit `/yr` suffix -- the value only
 *     makes sense as an annual total.
 *   - `monthly` and `yearly` emit bare-dollar strings by default so copy
 *     editors can write prose like "for {{solo.pro.yearly}}/mo billed
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
  SoloPricing,
  SoloTierKey,
} from "@/lib/solo-product/pricing";

const TIER_KEYS: readonly SoloTierKey[] = ["free", "pro", "grow"];

const PLACEHOLDER = /\{\{solo\.([^}]+)\}\}/g;

function isTierKey(value: string): value is SoloTierKey {
  return (TIER_KEYS as readonly string[]).includes(value);
}

/**
 * Replace every `{{solo.*}}` placeholder in `input` with a formatted price
 * drawn from `pricing`. Unknown placeholders are preserved verbatim.
 */
export function interpolateProductVars(
  input: string,
  pricing: SoloPricing,
): string {
  if (!input.includes("{{solo.")) return input;

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
