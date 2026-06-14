/**
 * Migration: backfill `summary` (TL;DR) and append an inline FAQ block to
 * `body` for every published/scheduled article in Firestore.
 *
 * Idempotent: skips articles whose `summary` is already populated and whose
 * body already contains `<section class="faq">`. Both checks are independent
 * so a partial prior run is resumable.
 *
 * Safety:
 *   - DRY_RUN=1 samples up to DRY_RUN_SAMPLE_SIZE articles, writes a report,
 *     and makes NO Firestore mutations.
 *   - Cost guard aborts the run when combined OpenAI + Tabstack spend exceeds
 *     USD 60.
 *   - Inline self-eval + single retry per article; articles failing eval
 *     twice are skipped and listed in the report.
 *
 * Usage (from apps/web):
 *   set -a; source <main-repo>/apps/web/.env.local; set +a
 *   export TABSTACK_API_KEY=...   # optional
 *   DRY_RUN=1 bun run scripts/migrations/2026-04-21-backfill-tldr-faq.ts
 *   bun run scripts/migrations/2026-04-21-backfill-tldr-faq.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import type { LanguageModelUsage } from "ai";
import { buildFaqBlockHtml } from "../../src/lib/faq-html/build-faq-block";
import { sanitizeArticleHtml } from "../../src/lib/sanitize/article-html";
import {
  evalTldrFaq,
  generateTldrFaq,
  localLint,
  type GeneratedContent,
} from "../lib/tldr-faq-generate";
import { tabstackResearch } from "../lib/tabstack-research";

const DRY_RUN = process.env.DRY_RUN === "1";
const USE_TABSTACK = process.env.TABSTACK !== "0";
const BLOG_ID = "default";
const STATUSES = ["published", "scheduled"];
const CONCURRENCY = 3;
const COST_ABORT_USD = 60;
const DRY_RUN_SAMPLE_SIZE = 10;

const PRICE = {
  gpt54: { in: 2.0, out: 8.0 },
  gpt54Mini: { in: 0.15, out: 0.60 },
  tabstackPerCall: 0.1,
};

const REPORT_DIR = resolve(__dirname, "reports");
const REPORT_SUFFIX = DRY_RUN ? "dry-run" : "live";
const REPORT_JSON = resolve(REPORT_DIR, `2026-04-21-tldr-faq-${REPORT_SUFFIX}.json`);
const REPORT_MD = resolve(REPORT_DIR, `2026-04-21-tldr-faq-${REPORT_SUFFIX}.md`);

const FAQ_PRESENT_REGEX =
  /<section\b[^>]*\bclass=(?:"[^"]*\bfaq\b[^"]*"|'[^']*\bfaq\b[^']*')/;
/**
 * Articles imported from WordPress frequently contain a prose FAQ section
 * authored as `<h2>Frequently Asked Questions</h2>` (or `<h2>FAQ</h2>`).
 * Those sections don't match the TipTap schema so they wouldn't be detected
 * by {@link FAQ_PRESENT_REGEX}, but appending a second FAQ block would visibly
 * duplicate content. A future migration can convert these to TipTap schema
 * so they also get `FAQPage` JSON-LD; for now, skip the append.
 */
const FAQ_HEADING_PRESENT_REGEX =
  /<h[1-6]\b[^>]*>\s*(?:faqs?|frequently\s+asked\s+questions?|common\s+questions|questions\s+(?:and|&(?:amp;)?)\s+answers)\s*(?:<\/|$)/i;

interface ArticleDoc {
  id: string;
  title?: string;
  slug?: string;
  body?: string;
  excerpt?: string;
  summary?: string;
  keywords?: string[];
  status?: string;
}

interface Report {
  articleId: string;
  slug: string;
  title: string;
  needs: { tldr: boolean; faq: boolean };
  research?: { query: string; answerChars: number; sources: string[] };
  generated?: GeneratedContent;
  eval?: { pass: boolean; issues: string[]; retried: boolean };
  action:
    | "skipped_has_both"
    | "written"
    | "dry_run_would_write"
    | "failed_eval"
    | "error";
  error?: string;
}

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function initFirebase(): App {
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

function bodyHasFaq(body: string): boolean {
  return FAQ_PRESENT_REGEX.test(body) || FAQ_HEADING_PRESENT_REGEX.test(body);
}

function countActions(reports: Report[]): Record<Report["action"], number> {
  const counts: Record<string, number> = {
    skipped_has_both: 0,
    written: 0,
    dry_run_would_write: 0,
    failed_eval: 0,
    error: 0,
  };
  for (const r of reports) counts[r.action] = (counts[r.action] ?? 0) + 1;
  return counts as Record<Report["action"], number>;
}

let totalCost = 0;

function tallyOpenAI(modelKey: "gpt54" | "gpt54Mini", usage: LanguageModelUsage | null) {
  if (!usage) return;
  const price = modelKey === "gpt54" ? PRICE.gpt54 : PRICE.gpt54Mini;
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  totalCost += (inputTokens / 1_000_000) * price.in + (outputTokens / 1_000_000) * price.out;
}

async function runGenAndEval(input: {
  title: string;
  excerpt: string;
  body: string;
  keywords: string[];
  researchContext?: string;
}): Promise<{ output: GeneratedContent; evalResult: { pass: boolean; issues: string[] } }> {
  const { output, usage } = await generateTldrFaq(input);
  tallyOpenAI("gpt54", usage);
  const localIssues = localLint(output);
  if (localIssues.length > 0) {
    return { output, evalResult: { pass: false, issues: localIssues } };
  }
  const { eval: llm, usage: evalUsage } = await evalTldrFaq({ title: input.title, body: input.body }, output);
  tallyOpenAI("gpt54Mini", evalUsage);
  return { output, evalResult: llm };
}

async function processArticle(
  art: ArticleDoc,
  tabstackKey: string | null,
): Promise<Report> {
  const base: Report = {
    articleId: art.id,
    slug: art.slug ?? art.id,
    title: art.title ?? "(untitled)",
    needs: { tldr: false, faq: false },
    action: "skipped_has_both",
  };
  const body = art.body ?? "";
  const needsTldr = !art.summary || art.summary.trim() === "";
  const needsFaq = !bodyHasFaq(body);
  base.needs = { tldr: needsTldr, faq: needsFaq };
  if (!needsTldr && !needsFaq) return base;

  try {
    let researchContext: string | undefined;
    if (tabstackKey && USE_TABSTACK) {
      const query = `${art.title ?? "article"} — factual overview as of April 2026`;
      try {
        const r = await tabstackResearch(query, { apiKey: tabstackKey, mode: "fast" });
        researchContext = r.answer.slice(0, 2_000);
        totalCost += PRICE.tabstackPerCall;
        base.research = { query, answerChars: r.answer.length, sources: r.sources.slice(0, 5) };
      } catch (err) {
        base.research = { query, answerChars: 0, sources: [] };
        console.warn(`  tabstack failed for ${art.id}: ${(err as Error).message}`);
      }
    }

    const input = {
      title: art.title ?? "",
      excerpt: art.excerpt ?? "",
      body,
      keywords: art.keywords ?? [],
      researchContext,
    };

    let { output, evalResult } = await runGenAndEval(input);
    let retried = false;
    if (!evalResult.pass) {
      retried = true;
      ({ output, evalResult } = await runGenAndEval(input));
    }
    base.generated = output;
    base.eval = { ...evalResult, retried };
    if (!evalResult.pass) {
      base.action = "failed_eval";
      return base;
    }
    base.action = DRY_RUN ? "dry_run_would_write" : "written";
    return base;
  } catch (err) {
    base.action = "error";
    base.error = err instanceof Error ? err.message : String(err);
    return base;
  }
}

async function processInChunks<T, R>(
  items: T[],
  size: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    const results = await Promise.all(chunk.map((item, idx) => fn(item, i + idx)));
    out.push(...results);
  }
  return out;
}

function formatReportMarkdown(reports: Report[], totals: { total: number; pending: number }): string {
  const lines: string[] = [];
  lines.push(`# TLDR/FAQ backfill report (${DRY_RUN ? "DRY RUN" : "LIVE"})`);
  lines.push("");
  lines.push(`- Total articles scanned: ${totals.total}`);
  lines.push(`- Pending (missing TLDR or FAQ): ${totals.pending}`);
  lines.push(`- Processed here: ${reports.length}`);
  lines.push(`- Total spend: $${totalCost.toFixed(4)}`);
  lines.push("");
  for (const r of reports) {
    lines.push(`## ${r.slug} — \`${r.action}\``);
    lines.push(`- Title: ${r.title}`);
    lines.push(`- Needs: tldr=${r.needs.tldr} faq=${r.needs.faq}`);
    if (r.research) {
      lines.push(`- Research sources: ${r.research.sources.join(", ") || "(none)"}`);
    }
    if (r.generated) {
      const words = r.generated.summary.trim().split(/\s+/).filter(Boolean).length;
      lines.push(`- **TL;DR** (${words} words): ${r.generated.summary}`);
      lines.push(`- **FAQs** (${r.generated.faqs.length}):`);
      for (const f of r.generated.faqs) {
        lines.push(`  - **Q:** ${f.question}`);
        lines.push(`    **A:** ${f.answer}`);
      }
    }
    if (r.eval) {
      const issues = r.eval.issues.join("; ") || "(none)";
      lines.push(`- Eval: pass=${r.eval.pass} retried=${r.eval.retried} issues=${issues}`);
    }
    if (r.error) lines.push(`- Error: ${r.error}`);
    lines.push("");
  }
  return lines.join("\n");
}

function writeReports(reports: Report[], totals: { total: number; pending: number }): void {
  mkdirSync(dirname(REPORT_JSON), { recursive: true });
  writeFileSync(
    REPORT_JSON,
    JSON.stringify(
      { total: totals.total, pending: totals.pending, totalCost, reports },
      null,
      2,
    ),
  );
  writeFileSync(REPORT_MD, formatReportMarkdown(reports, totals));
}

async function main(): Promise<void> {
  assertEnv("OPENAI_API_KEY");
  const tabstackKey = process.env.TABSTACK_API_KEY || null;
  if (USE_TABSTACK && !tabstackKey) {
    console.warn("TABSTACK_API_KEY not set — proceeding without research enrichment");
  }

  initFirebase();
  const db = getFirestore();

  console.info(`== backfill-tldr-faq ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ==`);
  console.info(
    `concurrency=${CONCURRENCY} tabstack=${!!(tabstackKey && USE_TABSTACK)} cost_abort=$${COST_ABORT_USD}`,
  );

  const snap = await db
    .collection("articles")
    .where("blogId", "==", BLOG_ID)
    .where("status", "in", STATUSES)
    .get();
  console.info(`fetched ${snap.size} articles (status in ${JSON.stringify(STATUSES)})`);

  const articles: ArticleDoc[] = snap.docs.map((d) => ({
    ...(d.data() as ArticleDoc),
    id: d.id,
  }));
  const pending = articles.filter(
    (a) => !a.summary?.trim() || !bodyHasFaq(a.body ?? ""),
  );
  console.info(
    `to process: ${pending.length} | already complete: ${articles.length - pending.length}`,
  );
  if (pending.length === 0) {
    console.info("nothing to do");
    return;
  }

  const limitEnv = Number.parseInt(process.env.LIMIT ?? "", 10);
  const limit = Number.isFinite(limitEnv) && limitEnv > 0 ? limitEnv : pending.length;
  if (limit < pending.length) {
    console.info(`LIMIT=${limit} — processing first ${limit} of ${pending.length} pending`);
    pending.length = limit;
  }

  if (DRY_RUN) {
    const sample = pending.slice(0, DRY_RUN_SAMPLE_SIZE);
    console.info(`-- DRY RUN: processing ${sample.length} sample articles --`);
    const reports = await processInChunks(sample, CONCURRENCY, (a) =>
      processArticle(a, tabstackKey),
    );
    writeReports(reports, { total: articles.length, pending: pending.length });
    const counts = countActions(reports);
    console.info(
      `actions: written=${counts.dry_run_would_write} failed_eval=${counts.failed_eval} error=${counts.error} skipped=${counts.skipped_has_both}`,
    );
    console.info(`\ntotal spent: $${totalCost.toFixed(4)}`);
    console.info(`report: ${REPORT_JSON}`);
    const projected = sample.length > 0
      ? (totalCost / sample.length) * pending.length
      : 0;
    console.info(`projected full-run cost: $${projected.toFixed(2)}`);
    return;
  }

  const started = Date.now();
  const reports: Report[] = [];
  let processed = 0;
  await processInChunks(pending, CONCURRENCY, async (a) => {
    if (totalCost > COST_ABORT_USD) {
      throw new Error(
        `cost abort: $${totalCost.toFixed(2)} > $${COST_ABORT_USD}`,
      );
    }
    const r = await processArticle(a, tabstackKey);
    reports.push(r);
    processed += 1;
    if (r.action === "written" && r.generated) {
      const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (r.needs.tldr) patch.summary = r.generated.summary;
      if (r.needs.faq) {
        const faqHtml = buildFaqBlockHtml(r.generated.faqs);
        patch.body = sanitizeArticleHtml(`${a.body ?? ""}\n${faqHtml}`);
      }
      await db.collection("articles").doc(a.id).set(patch, { merge: true });
    }
    if (processed % 5 === 0 || processed === pending.length) {
      console.info(
        `progress ${processed}/${pending.length} cost=$${totalCost.toFixed(3)} last=${r.action}:${r.slug}`,
      );
    }
  });

  writeReports(reports, { total: articles.length, pending: pending.length });
  const counts = countActions(reports);
  console.info(
    `actions: written=${counts.written} failed_eval=${counts.failed_eval} error=${counts.error} skipped=${counts.skipped_has_both}`,
  );
  console.info(
    `\n== done in ${((Date.now() - started) / 1000).toFixed(1)}s cost=$${totalCost.toFixed(2)} ==`,
  );
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
