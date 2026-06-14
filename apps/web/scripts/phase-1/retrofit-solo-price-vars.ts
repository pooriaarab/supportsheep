/**
 * Phase 1 retrofit: replace hardcoded Supportsheep prices in the two pilot
 * programmatic-page Firestore docs with `{{solo.*}}` placeholders so the
 * interpolation pipeline in the landing components resolves them from
 * `SOLO_PRICING` (the pricing constants) at render time.
 *
 * Targets:
 *   - programmatic_pages/dentists                  (/for/dentists)
 *   - programmatic_pages/squarespace__dentists     (/alternatives/squarespace/for/dentists)
 *
 * Fields scanned and rewritten on each doc:
 *   - `uniqueContent` (markdown body)
 *   - every `faqs[i].answer` (plain text)
 *   - every `faqs[i].question` (plain text) -- safe, but unlikely to hit
 *
 * Replacement policy:
 *   - We only rewrite numbers that are UNAMBIGUOUSLY a Supportsheep plan price. The
 *     detection uses regex phrases like "Supportsheep's Pro plan ... $20" or "Supportsheep's
 *     Pro is $25/mo" -- i.e. a "Supportsheep" / "Pro" / "Grow" context word plus an
 *     adjacent known price. Naked `$20` with no Supportsheep context is skipped to
 *     avoid clobbering competitor prices or unrelated figures.
 *   - Dry-run mode (`--dry-run`) prints each proposed swap with a 60-char
 *     context snippet, then exits without writing. Inspect the output before
 *     running without the flag.
 *   - Doc is written with `set(..., { merge: true })` so unrelated fields are
 *     untouched.
 *
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/retrofit-solo-price-vars.ts --dry-run
 *   bun --conditions react-server scripts/phase-1/retrofit-solo-price-vars.ts
 *
 * Requires Firebase admin credentials in env (same as the other phase-1
 * scripts). If creds are missing, Firestore init throws and nothing is
 * written.
 */

import "dotenv/config";

import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import type { ProgrammaticFaq } from "@repo/types";

const DOC_IDS = ["dentists", "squarespace__dentists"] as const;

/**
 * Context-sensitive replacement rules. Each rule's `pattern` must match a
 * phrase that is unambiguously about a Supportsheep plan -- the numeric price is
 * wrapped in a capture group so the surrounding prose stays intact.
 *
 * Order matters: later rules are tried only if earlier ones didn't match the
 * same slice of text. The patterns are deliberately narrow so a stray
 * "$20" in competitor copy is never touched.
 */
interface Rule {
  name: string;
  /** Regex with the numeric literal inside a single capture group. */
  pattern: RegExp;
  /** Placeholder token to emit in place of the capture group. */
  replacement: string;
}

// Accepts "$20", "$20/mo", "$20 per month", "$20/month" around a Supportsheep/Pro
// context word. The `(?:/mo|\s*(?:per|a)\s*month)?` group is discarded so the
// placeholder resolves to the right format (bare or /mo-suffixed) already.
const RULES: Rule[] = [
  // Supportsheep Pro annual-billed rate: $20/mo
  {
    name: "solo.pro.yearly (billed annually)",
    pattern:
      /(Solo(?:'s)?\s+Pro\s+(?:plan\s+)?(?:is\s+|starts\s+at\s+|costs\s+|billed\s+annually\s+(?:at\s+)?|annually\s+at\s+|,\s*billed\s+annually,?\s*)?)\$20\b/gi,
    replacement: "$1{{solo.pro.yearly.monthly}}",
  },
  // Supportsheep Pro month-to-month rate: $25/mo
  {
    name: "solo.pro.monthly (month to month)",
    pattern:
      /(Solo(?:'s)?\s+Pro\s+(?:plan\s+)?(?:is\s+|starts\s+at\s+|costs\s+|billed\s+monthly\s+(?:at\s+)?|month[- ]to[- ]month\s+(?:at\s+)?)?)\$25\b/gi,
    replacement: "$1{{solo.pro.monthly.monthly}}",
  },
  // Supportsheep Pro total annual spend: $240/yr
  {
    name: "solo.pro.yearlyAnnual",
    pattern: /(Solo(?:'s)?\s+Pro\s+(?:plan\s+)?(?:is\s+|costs\s+|at\s+)?)\$240\b/gi,
    replacement: "$1{{solo.pro.yearlyAnnual}}",
  },
  // Supportsheep Grow annual-billed rate: $90/mo
  {
    name: "solo.grow.yearly (billed annually)",
    pattern:
      /(Solo(?:'s)?\s+Grow\s+(?:plan\s+)?(?:is\s+|starts\s+at\s+|costs\s+|billed\s+annually\s+(?:at\s+)?|annually\s+at\s+|,\s*billed\s+annually,?\s*)?)\$90\b/gi,
    replacement: "$1{{solo.grow.yearly.monthly}}",
  },
  // Supportsheep Grow month-to-month rate: $120/mo
  {
    name: "solo.grow.monthly (month to month)",
    pattern:
      /(Solo(?:'s)?\s+Grow\s+(?:plan\s+)?(?:is\s+|starts\s+at\s+|costs\s+|billed\s+monthly\s+(?:at\s+)?|month[- ]to[- ]month\s+(?:at\s+)?)?)\$120\b/gi,
    replacement: "$1{{solo.grow.monthly.monthly}}",
  },
  // Supportsheep Grow total annual spend: $1080/yr
  {
    name: "solo.grow.yearlyAnnual",
    pattern: /(Solo(?:'s)?\s+Grow\s+(?:plan\s+)?(?:is\s+|costs\s+|at\s+)?)\$1080\b/gi,
    replacement: "$1{{solo.grow.yearlyAnnual}}",
  },
];

interface Change {
  rule: string;
  before: string;
  after: string;
}

function applyRules(input: string): { output: string; changes: Change[] } {
  let output = input;
  const changes: Change[] = [];
  for (const rule of RULES) {
    // Use the matchAll iterator so we can record a context snippet for each
    // hit before mutating. Execution against the original `output` string is
    // safe because the patterns don't overlap across rules by construction.
    const matches = [...output.matchAll(rule.pattern)];
    if (matches.length === 0) continue;
    for (const m of matches) {
      const idx = m.index ?? 0;
      const start = Math.max(0, idx - 30);
      const end = Math.min(output.length, idx + m[0].length + 30);
      changes.push({
        rule: rule.name,
        before: output.slice(start, end),
        after: `${output.slice(start, idx)}${m[0].replace(rule.pattern, rule.replacement)}${output.slice(idx + m[0].length, end)}`,
      });
    }
    output = output.replace(rule.pattern, rule.replacement);
  }
  return { output, changes };
}

interface DocDiff {
  docId: string;
  uniqueContent: { changed: boolean; changes: Change[] };
  faqs: Array<{
    idx: number;
    question: { changed: boolean; changes: Change[] };
    answer: { changed: boolean; changes: Change[] };
  }>;
}

interface RewrittenDoc {
  uniqueContent?: string;
  faqs?: ProgrammaticFaq[];
}

function planRewrite(
  docId: string,
  data: {
    uniqueContent?: string;
    faqs?: ProgrammaticFaq[];
  },
): { diff: DocDiff; rewritten: RewrittenDoc | null } {
  const rewritten: RewrittenDoc = {};
  const diff: DocDiff = {
    docId,
    uniqueContent: { changed: false, changes: [] },
    faqs: [],
  };

  if (typeof data.uniqueContent === "string") {
    const res = applyRules(data.uniqueContent);
    diff.uniqueContent = {
      changed: res.changes.length > 0,
      changes: res.changes,
    };
    if (res.changes.length > 0) {
      rewritten.uniqueContent = res.output;
    }
  }

  if (Array.isArray(data.faqs)) {
    const newFaqs: ProgrammaticFaq[] = data.faqs.map((faq, idx) => {
      const qRes = applyRules(faq.question ?? "");
      const aRes = applyRules(faq.answer ?? "");
      diff.faqs.push({
        idx,
        question: { changed: qRes.changes.length > 0, changes: qRes.changes },
        answer: { changed: aRes.changes.length > 0, changes: aRes.changes },
      });
      return {
        question: qRes.output,
        answer: aRes.output,
      };
    });
    const anyChanged = diff.faqs.some(
      (f) => f.question.changed || f.answer.changed,
    );
    if (anyChanged) {
      rewritten.faqs = newFaqs;
    }
  }

  const hasWrites =
    (rewritten.uniqueContent !== undefined) || (rewritten.faqs !== undefined);
  return { diff, rewritten: hasWrites ? rewritten : null };
}

function printDiff(diff: DocDiff): number {
  let count = 0;
  console.info(`\n--- ${diff.docId} ---`);
  if (diff.uniqueContent.changed) {
    for (const c of diff.uniqueContent.changes) {
      count += 1;
      console.info(
        `  [uniqueContent] rule=${c.rule}\n    before: ${JSON.stringify(c.before)}\n    after:  ${JSON.stringify(c.after)}`,
      );
    }
  }
  for (const f of diff.faqs) {
    if (f.question.changed) {
      for (const c of f.question.changes) {
        count += 1;
        console.info(
          `  [faqs[${f.idx}].question] rule=${c.rule}\n    before: ${JSON.stringify(c.before)}\n    after:  ${JSON.stringify(c.after)}`,
        );
      }
    }
    if (f.answer.changed) {
      for (const c of f.answer.changes) {
        count += 1;
        console.info(
          `  [faqs[${f.idx}].answer] rule=${c.rule}\n    before: ${JSON.stringify(c.before)}\n    after:  ${JSON.stringify(c.after)}`,
        );
      }
    }
  }
  if (count === 0) {
    console.info(`  (no Supportsheep-price phrases matched; nothing to rewrite)`);
  }
  return count;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  console.info(
    `[retrofit:blogbat-price-vars] ${dryRun ? "DRY RUN" : "WRITING"} ` +
      `${DOC_IDS.length} programmatic_pages doc(s)`,
  );

  const totals: Array<{ docId: string; hits: number; wrote: boolean }> = [];

  for (const docId of DOC_IDS) {
    const ref = collections.programmaticPages().doc(docId);
    const snap = await ref.get();
    if (!snap.exists) {
      console.info(`\n--- ${docId} ---\n  (doc does not exist, skipping)`);
      totals.push({ docId, hits: 0, wrote: false });
      continue;
    }
    const data = snap.data() as {
      uniqueContent?: string;
      faqs?: ProgrammaticFaq[];
    };
    const { diff, rewritten } = planRewrite(docId, data);
    const hits = printDiff(diff);

    if (!rewritten || dryRun) {
      totals.push({ docId, hits, wrote: false });
      continue;
    }

    await ref.set(
      {
        ...rewritten,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.info(`  -> wrote ${docId} with ${hits} replacement(s)`);
    totals.push({ docId, hits, wrote: true });
  }

  console.info(`\n[retrofit:blogbat-price-vars] summary:`);
  for (const t of totals) {
    console.info(
      `  - ${t.docId}: ${t.hits} match(es)${t.wrote ? " (written)" : dryRun && t.hits > 0 ? " (dry-run; not written)" : ""}`,
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[retrofit:blogbat-price-vars] failed:", err);
    process.exit(1);
  });
