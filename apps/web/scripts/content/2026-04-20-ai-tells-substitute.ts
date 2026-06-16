/**
 * Content pass: remove high-confidence AI-writing tells across the article
 * corpus.
 *
 * Corpus audit (200 affected articles out of 436):
 *   seamless     209 x
 *   comprehensive 97 x
 *   navigate      96 x
 *   streamline    96 x
 *   robust        78 x
 *   (plus leverage, landscape, foster, delve, "in today's ...")
 *
 * Approach:
 *   - HTML-aware substitution (text nodes only, skips <code>/<pre>).
 *   - See `src/lib/content/ai-tells.ts` for the rule set + safety notes.
 *   - Rewrites both `body` (published) and `draftBody` when present.
 *   - Writes an idempotency stamp `aiTellsPassAt` on each updated doc.
 *   - Skips docs already stamped (so re-running is a no-op).
 *   - Titles / metaDescriptions / tags are NOT touched in this pass.
 *
 * Safety:
 *   - DRY_RUN=1: writes nothing. Prints per-rule counts + 20 sample diffs.
 *   - LIVE run: batched commits of 500, progress every 20 docs, change log
 *     written to a local JSON file for post-hoc review.
 *
 * Usage:
 *   set -a; source apps/web/.env.local; set +a
 *   DRY_RUN=1 bun run scripts/content/2026-04-20-ai-tells-substitute.ts
 *   bun run scripts/content/2026-04-20-ai-tells-substitute.ts
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { deAiTellHtml, type AiTellChange } from "@/lib/content/ai-tells";

const DRY_RUN = process.env.DRY_RUN === "1";
const blog_id = "default";
const BATCH_SIZE = 500;
const PROGRESS_EVERY = 20;
const SAMPLE_DIFFS = 20;
const CHANGE_LOG_FILE = resolve(
  process.cwd(),
  `ai-tells-changes-${new Date().toISOString().slice(0, 10)}.json`,
);

interface ArticleDoc {
  id: string;
  title?: string;
  slug?: string;
  body?: unknown;
  draftBody?: unknown;
  aiTellsPassAt?: unknown;
}

interface PerArticleResult {
  id: string;
  slug: string;
  title: string;
  bodyChanges: AiTellChange[];
  draftChanges: AiTellChange[];
  newBody: string | null;
  newDraftBody: string | null;
  totalChanges: number;
}

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function initFirebase(): App {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0]!;
  }
  return initializeApp({
    credential: cert({
      projectId: assertEnv("FIREBASE_ADMIN_PROJECT_ID"),
      clientEmail: assertEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey: assertEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

function processArticle(doc: ArticleDoc): PerArticleResult {
  const bodyStr = typeof doc.body === "string" ? doc.body : "";
  const draftStr = typeof doc.draftBody === "string" ? doc.draftBody : "";

  const bodyResult = bodyStr ? deAiTellHtml(bodyStr) : null;
  const draftResult = draftStr ? deAiTellHtml(draftStr) : null;

  const bodyChanges = bodyResult?.changes ?? [];
  const draftChanges = draftResult?.changes ?? [];

  return {
    id: doc.id,
    slug: typeof doc.slug === "string" ? doc.slug : "",
    title: typeof doc.title === "string" ? doc.title : "",
    bodyChanges,
    draftChanges,
    newBody:
      bodyResult && bodyChanges.length > 0 ? bodyResult.html : null,
    newDraftBody:
      draftResult && draftChanges.length > 0 ? draftResult.html : null,
    totalChanges: bodyChanges.length + draftChanges.length,
  };
}

function printSampleDiffs(
  results: PerArticleResult[],
  limit: number,
): void {
  const withChanges = results.filter((r) => r.totalChanges > 0);
  console.info(`\n-- Sample diffs (first ${Math.min(limit, withChanges.length)} of ${withChanges.length} affected articles) --\n`);
  for (const r of withChanges.slice(0, limit)) {
    console.info(`article=${r.id} slug=${r.slug} title="${r.title}"`);
    const allChanges = [...r.bodyChanges, ...r.draftChanges].slice(0, 3);
    for (const c of allChanges) {
      console.info(`  [${c.rule}] "${c.from}" -> "${c.to}"`);
      console.info(`    ctx: ${c.context}`);
    }
    if (r.totalChanges > 3) {
      console.info(`  ... +${r.totalChanges - 3} more changes`);
    }
    console.info("");
  }
}

async function main(): Promise<void> {
  initFirebase();
  const db = getFirestore();

  console.info(
    `== de-ai-tell content pass ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ==`,
  );

  const snap = await db
    .collection("articles")
    .where("blogId", "==", blog_id)
    .get();
  console.info(`fetched ${snap.size} articles for blogId=${blog_id}`);

  const pending: ArticleDoc[] = [];
  let alreadyStamped = 0;
  for (const d of snap.docs) {
    const data = d.data() as ArticleDoc;
    if (data.aiTellsPassAt) {
      alreadyStamped += 1;
      continue;
    }
    pending.push({ ...data, id: d.id });
  }
  console.info(
    `pending=${pending.length} already-stamped=${alreadyStamped}`,
  );

  if (pending.length === 0) {
    console.info("nothing to do");
    return;
  }

  const results: PerArticleResult[] = [];
  const globalCounts: Record<string, number> = {};
  let processed = 0;

  for (const doc of pending) {
    const r = processArticle(doc);
    results.push(r);
    for (const c of [...r.bodyChanges, ...r.draftChanges]) {
      globalCounts[c.rule] = (globalCounts[c.rule] ?? 0) + 1;
    }
    processed += 1;
    if (processed % PROGRESS_EVERY === 0 || processed === pending.length) {
      console.info(
        `progress: processed=${processed}/${pending.length} total-changes=${Object.values(
          globalCounts,
        ).reduce((a, b) => a + b, 0)}`,
      );
    }
  }

  // Summary counts
  console.info("\n-- per-rule match counts (pre-write) --");
  const sorted = Object.entries(globalCounts).sort((a, b) => b[1] - a[1]);
  for (const [rule, count] of sorted) {
    console.info(`  ${rule.padEnd(14)} ${count}`);
  }

  const affected = results.filter((r) => r.totalChanges > 0);
  console.info(
    `\naffected articles: ${affected.length} / ${pending.length}`,
  );

  // Top-5 most-changed articles
  const topAffected = affected
    .toSorted((a, b) => b.totalChanges - a.totalChanges)
    .slice(0, 5);
  console.info(`\n-- top 5 most-affected articles --`);
  for (const r of topAffected) {
    console.info(
      `  ${r.totalChanges.toString().padStart(4)} changes -- ${r.slug} (${r.id})`,
    );
  }

  printSampleDiffs(results, SAMPLE_DIFFS);

  // Write full change log
  const changeLogPath = CHANGE_LOG_FILE;
  writeFileSync(
    changeLogPath,
    JSON.stringify(
      {
        mode: DRY_RUN ? "dry-run" : "live",
        timestamp: new Date().toISOString(),
        totals: {
          fetched: snap.size,
          alreadyStamped,
          pending: pending.length,
          affected: affected.length,
        },
        perRuleCounts: globalCounts,
        articles: affected.map((r) => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          totalChanges: r.totalChanges,
          changes: [...r.bodyChanges, ...r.draftChanges],
        })),
      },
      null,
      2,
    ),
  );
  console.info(`\nchange log written: ${changeLogPath}`);

  if (DRY_RUN) {
    console.info("\nDRY RUN complete -- no writes performed.");
    return;
  }

  // Commit updates in batches
  console.info(`\nwriting ${affected.length} updates to Firestore...`);
  let written = 0;
  for (let i = 0; i < affected.length; i += BATCH_SIZE) {
    const chunk = affected.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const r of chunk) {
      const update: Record<string, unknown> = {
        aiTellsPassAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (r.newBody !== null) update.body = r.newBody;
      if (r.newDraftBody !== null) update.draftBody = r.newDraftBody;
      batch.set(db.collection("articles").doc(r.id), update, {
        merge: true,
      });
    }
    await batch.commit();
    written += chunk.length;
    console.info(`  wrote batch: ${written}/${affected.length}`);
  }

  console.info(`\n== done. updated=${written} ==`);
}

main().catch((err) => {
  console.error("content pass failed:", err);
  process.exit(1);
});
