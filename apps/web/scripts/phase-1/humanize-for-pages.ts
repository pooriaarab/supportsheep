/**
 * Phase 1 quality pass: de-tell + humanizer pass on all programmatic pages.
 *
 * Reads each `uniqueContent` from the `for` and `alternatives_for_vertical`
 * collections and runs a Claude improvement pass to:
 *   - Remove AI writing telltales (em dashes, overused words, hedging, etc.)
 *   - Humanize the tone (remove promotional language, fix generic intros)
 *   - Preserve all HTML (tables, iframes, ordered lists)
 *   - Not change facts, Supportsheep product claims, citations, or YouTube embeds
 *
 * Tracks processed docs via a `humanizedAt` timestamp field so the script is
 * resumable with `--skip-existing`.
 *
 * Usage (from apps/web):
 *   bun --conditions react-server scripts/phase-1/humanize-for-pages.ts --dry-run
 *   bun --conditions react-server scripts/phase-1/humanize-for-pages.ts --skip-existing
 *   bun --conditions react-server scripts/phase-1/humanize-for-pages.ts
 *
 * Rate limiting: 3 docs processed in parallel, 1.5s between batches.
 *
 * Env vars required (from .env.local):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 *   ANTHROPIC_API_KEY
 */

import "dotenv/config";

import Anthropic from "@anthropic-ai/sdk";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import type { Timestamp } from "firebase-admin/firestore";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_EXISTING = process.argv.includes("--skip-existing");
const COLLECTIONS = ["for", "alternatives_for_vertical"] as const;
const CONCURRENCY = 3;
const BATCH_DELAY_MS = 1500;
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are editing programmatic SEO content to remove AI writing patterns and make it sound more natural and human. Apply these specific changes:

DE-TELL (remove AI writing telltales):
- Em dashes (—): rewrite the sentence or use a comma instead. Never just replace — with a dash.
- Remove overused AI words: "delve", "comprehensive", "navigate", "realm", "landscape", "crucial", "leverage", "streamline", "robust", "seamless", "cutting-edge", "game-changer", "transformative", "holistic". Replace with plain, direct alternatives.
- Remove filler phrases: "It's worth noting that...", "It is important to note...", "As we can see..."
- Convert passive voice to active where it reads naturally.
- Remove unnecessary hedging: avoid "may", "might", "could potentially", "often" where a direct statement is better.
- Break up lists of exactly 3 things if they feel formulaic. Either collapse to 2 or expand to 4+ with real specifics.
- Rewrite opening sentences that start with "In today's [adjective] [noun]..." — start with the problem or the specific situation instead.

HUMANIZER (make it sound like a knowledgeable person wrote it):
- Replace promotional language about Supportsheep with honest, specific statements. Include real limitations where relevant.
- Rewrite "This guide will help you..." intros — start with the reader's specific problem or situation.
- Remove sentences starting with "Ultimately..." or "In conclusion..." — just end the section, or integrate the point.
- Leave any {{supportsheep.*}} template variables unchanged — they are placeholder tokens.

PRESERVE:
- All HTML tags exactly as-is: <table>, <thead>, <tbody>, <tr>, <th>, <td>, <iframe>, <img>, <ul>, <ol>, <li>, <p>, <h1>, <h2>, <h3>, <strong>, <em>, <a href>, <div>, <figure>, <blockquote>, etc.
- All YouTube iframe src URLs — do not change embed URLs.
- All factual claims, product features, prices ({{supportsheep.*}} tokens), and citations.
- The overall structure and length — do not add new sections or make the content longer.
- Markdown headings (## H2, ### H3) — preserve exactly.

Return ONLY the improved content, with no preamble, commentary, or explanation.`;

interface PageDoc {
  id: string;
  collection: string;
  uniqueContent: string;
  humanizedAt?: Timestamp | null;
}

interface DocReport {
  slug: string;
  collection: string;
  action: "skipped_existing" | "no_change" | "updated" | "dry_run" | "error";
  inputChars?: number;
  outputChars?: number;
  error?: string;
}

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function initFirebase() {
  const apps = getApps();
  if (apps.length > 0) return apps[0]!;
  return initializeApp({
    credential: cert({
      projectId: assertEnv("FIREBASE_ADMIN_PROJECT_ID"),
      clientEmail: assertEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey: assertEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

async function humanizeContent(
  client: Anthropic,
  content: string,
): Promise<string> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: content,
      },
    ],
  });

  const block = message.content[0];
  if (!block || block.type !== "text") {
    throw new Error("Unexpected response format from Claude API");
  }
  return block.text.trim();
}

/** Minimum length ratio: output must be >= 85% of input length to guard against truncation. */
const MIN_LENGTH_RATIO = 0.85;

/**
 * Validates that the improved content is structurally sound:
 * - Output is at least 85% the length of input (truncation guard)
 * - Iframe count matches (YouTube embeds preserved)
 * - H2 heading count matches (document structure preserved)
 */
function validateImprovedContent(
  original: string,
  improved: string,
): { valid: boolean; reason?: string } {
  const lengthRatio = improved.length / original.length;
  if (lengthRatio < MIN_LENGTH_RATIO) {
    return {
      valid: false,
      reason: `output too short: ${improved.length} chars vs ${original.length} input (${(lengthRatio * 100).toFixed(1)}% — min ${MIN_LENGTH_RATIO * 100}%)`,
    };
  }

  const origIframes = (original.match(/<iframe\b/gi) ?? []).length;
  const newIframes = (improved.match(/<iframe\b/gi) ?? []).length;
  if (origIframes !== newIframes) {
    return {
      valid: false,
      reason: `iframe count changed: ${origIframes} → ${newIframes}`,
    };
  }

  const origH2 = (original.match(/^##\s+/gm) ?? []).length;
  const newH2 = (improved.match(/^##\s+/gm) ?? []).length;
  if (newH2 < origH2 - 1) {
    // Allow off-by-one (minor structural edit) but not wholesale section removal.
    return {
      valid: false,
      reason: `H2 heading count dropped significantly: ${origH2} → ${newH2}`,
    };
  }

  return { valid: true };
}

async function processDoc(
  client: Anthropic,
  db: FirebaseFirestore.Firestore,
  doc: PageDoc,
): Promise<DocReport> {
  const base: DocReport = {
    slug: doc.id,
    collection: doc.collection,
    action: "no_change",
  };

  if (SKIP_EXISTING && doc.humanizedAt) {
    return { ...base, action: "skipped_existing" };
  }

  const content = doc.uniqueContent;
  base.inputChars = content.length;

  let improved: string;
  try {
    improved = await humanizeContent(client, content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...base, action: "error", error: msg };
  }

  base.outputChars = improved.length;

  // Structural validation: guard against truncation or unintended content removal.
  const validation = validateImprovedContent(content, improved);
  if (!validation.valid) {
    return {
      ...base,
      action: "error",
      error: `Validation failed: ${validation.reason}`,
    };
  }

  // If Claude returned identical content, skip the write.
  if (improved === content) {
    return { ...base, action: "no_change" };
  }

  if (DRY_RUN) {
    return { ...base, action: "dry_run" };
  }

  // Write back to Firestore. Preserve the original in `uniqueContentPreHumanize`
  // (written only once — if already set, skip to avoid overwriting with a
  // previously-humanized version).
  const ref = db.collection("programmatic_pages").doc(doc.id);
  const snap = await ref.get();
  const existing = snap.data() ?? {};
  const backupField = existing.uniqueContentPreHumanize ? {} : { uniqueContentPreHumanize: content };

  await ref.set(
    {
      ...backupField,
      uniqueContent: improved,
      humanizedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { ...base, action: "updated" };
}

async function processInBatches<T, R>(
  items: T[],
  concurrency: number,
  delayMs: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const chunk = items.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
    if (i + concurrency < items.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return results;
}

function printReport(reports: DocReport[]) {
  const counts = {
    skipped_existing: 0,
    no_change: 0,
    updated: 0,
    dry_run: 0,
    error: 0,
  };
  for (const r of reports) counts[r.action] = (counts[r.action] ?? 0) + 1;

  console.info("\n─────────────────────────────────────────");
  console.info(`Humanizer pass  (${DRY_RUN ? "DRY RUN" : "LIVE"})`);
  console.info("─────────────────────────────────────────");
  console.info(`Total docs processed : ${reports.length}`);
  console.info(`Skipped (existing)   : ${counts.skipped_existing}`);
  console.info(`No change needed     : ${counts.no_change}`);
  console.info(`Updated              : ${counts.updated}`);
  console.info(`Dry run (would write): ${counts.dry_run}`);
  console.info(`Errors               : ${counts.error}`);

  const errors = reports.filter((r) => r.action === "error");
  if (errors.length > 0) {
    console.info("\nErrors:");
    for (const r of errors) console.info(`  ${r.slug}: ${r.error}`);
  }
}

async function main() {
  console.info(`humanize-for-pages  [${DRY_RUN ? "DRY RUN" : "LIVE"}]${SKIP_EXISTING ? " [skip-existing]" : ""}`);
  console.info(`Collections: ${COLLECTIONS.join(", ")}`);
  console.info(`Concurrency: ${CONCURRENCY}, batch delay: ${BATCH_DELAY_MS}ms`);

  initFirebase();
  const db = getFirestore();
  const client = new Anthropic({ apiKey: assertEnv("ANTHROPIC_API_KEY") });

  const coll = db.collection("programmatic_pages");
  const docs: PageDoc[] = [];

  for (const col of COLLECTIONS) {
    const snap = await coll.where("collection", "==", col).get();
    for (const d of snap.docs) {
      const data = d.data();
      if (typeof data.uniqueContent !== "string" || !data.uniqueContent.trim()) continue;
      docs.push({
        id: d.id,
        collection: col,
        uniqueContent: data.uniqueContent as string,
        humanizedAt: (data.humanizedAt as Timestamp | null | undefined) ?? null,
      });
    }
  }

  console.info(`Found ${docs.length} docs to process.`);
  if (SKIP_EXISTING) {
    const alreadyDone = docs.filter((d) => d.humanizedAt).length;
    console.info(`  ${alreadyDone} already have humanizedAt timestamp.`);
  }

  let completed = 0;

  const reports = await processInBatches(
    docs,
    CONCURRENCY,
    BATCH_DELAY_MS,
    async (doc) => {
      const report = await processDoc(client, db, doc);
      completed++;
      console.info(
        `  [${completed}/${docs.length}] ${doc.id}  → ${report.action}` +
          (report.inputChars
            ? `  (${report.inputChars} → ${report.outputChars ?? "?"} chars)`
            : ""),
      );
      return report;
    },
  );

  printReport(reports);

  if (DRY_RUN) {
    console.info(
      "\nDRY RUN complete — no Firestore writes made. Re-run without --dry-run to apply.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("humanize-for-pages failed:", err);
    process.exit(1);
  });
