/**
 * One-off salvage: apply the already-generated TL;DR + FAQ content for the
 * 22 articles that failed LLM eval during the
 * `2026-04-21-backfill-tldr-faq` run. Their generated payloads are persisted
 * in `reports/2026-04-21-tldr-faq-live.json`. Manual review concluded the
 * content is acceptable — the eval was overly picky on "best X for Y"
 * listicle titles. This script replays those payloads onto Firestore without
 * paying for regeneration.
 *
 * Idempotent per article against CURRENT Firestore state (not the state at
 * time-of-failure): a sibling migration (`2026-04-21-convert-heading-faq`)
 * may have added TipTap FAQ blocks in the interim.
 *
 * Safety:
 *   - DRY_RUN=1 reports what would be written, no Firestore mutations.
 *   - No LLM calls. No network beyond Firebase.
 *
 * Usage (from apps/web):
 *   set -a; source <main-repo>/apps/web/.env.local; set +a
 *   DRY_RUN=1 bun run scripts/migrations/2026-04-21-apply-failed-eval.ts
 *   bun run scripts/migrations/2026-04-21-apply-failed-eval.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { buildFaqBlockHtml } from "../../src/lib/faq-html/build-faq-block";
import { sanitizeArticleHtml } from "../../src/lib/sanitize/article-html";

const DRY_RUN = process.env.DRY_RUN === "1";

const SOURCE_REPORT = resolve(
  __dirname,
  "reports",
  "2026-04-21-tldr-faq-live.json",
);
const REPORT_DIR = resolve(__dirname, "reports");
const REPORT_SUFFIX = DRY_RUN ? "dry-run" : "live";
const REPORT_JSON = resolve(
  REPORT_DIR,
  `2026-04-21-apply-failed-eval-${REPORT_SUFFIX}.json`,
);

// Copied verbatim from 2026-04-21-backfill-tldr-faq.ts so the idempotency
// check matches the original migration exactly.
const FAQ_PRESENT_REGEX =
  /<section\b[^>]*\bclass=(?:"[^"]*\bfaq\b[^"]*"|'[^']*\bfaq\b[^']*')/;
const FAQ_HEADING_PRESENT_REGEX =
  /<h[1-6]\b[^>]*>\s*(?:faqs?|frequently\s+asked\s+questions?|common\s+questions|questions\s+(?:and|&(?:amp;)?)\s+answers)\s*(?:<\/|$)/i;

interface GeneratedFaq {
  question: string;
  answer: string;
}

interface GeneratedContent {
  summary: string;
  faqs: GeneratedFaq[];
}

interface SourceReportEntry {
  articleId: string;
  slug: string;
  title: string;
  action: string;
  generated?: GeneratedContent;
}

interface SourceReport {
  reports: SourceReportEntry[];
}

type ApplyAction =
  | "applied"
  | "applied_tldr_only"
  | "applied_faq_only"
  | "skipped_tldr_and_faq_already_set"
  | "error";

interface ApplyReportEntry {
  articleId: string;
  slug: string;
  title: string;
  action: ApplyAction;
  wrote: { tldr: boolean; faq: boolean };
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

type FailedEvalEntry = SourceReportEntry & { generated: GeneratedContent };

function loadFailedEvalEntries(): FailedEvalEntry[] {
  const raw = readFileSync(SOURCE_REPORT, "utf8");
  const parsed = JSON.parse(raw) as SourceReport;
  return parsed.reports.filter(
    (r): r is FailedEvalEntry =>
      r.action === "failed_eval" && !!r.generated,
  );
}

async function processEntry(
  entry: FailedEvalEntry,
): Promise<ApplyReportEntry> {
  const result: ApplyReportEntry = {
    articleId: entry.articleId,
    slug: entry.slug,
    title: entry.title,
    action: "skipped_tldr_and_faq_already_set",
    wrote: { tldr: false, faq: false },
  };

  try {
    const db = getFirestore();
    const ref = db.collection("articles").doc(entry.articleId);
    const snap = await ref.get();
    if (!snap.exists) {
      result.action = "error";
      result.error = "article not found in Firestore";
      return result;
    }
    const data = snap.data() ?? {};
    const currentBody = typeof data.body === "string" ? data.body : "";
    const currentSummary = typeof data.summary === "string" ? data.summary : "";

    const needsTldr = currentSummary.trim() === "";
    const needsFaq = !bodyHasFaq(currentBody);

    if (!needsTldr && !needsFaq) {
      return result;
    }

    const patch: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (needsTldr) {
      patch.summary = entry.generated.summary;
      result.wrote.tldr = true;
    }
    if (needsFaq) {
      const faqHtml = buildFaqBlockHtml(entry.generated.faqs);
      patch.body = sanitizeArticleHtml(`${currentBody}\n${faqHtml}`);
      result.wrote.faq = true;
    }

    if (needsTldr && needsFaq) result.action = "applied";
    else if (needsTldr) result.action = "applied_tldr_only";
    else result.action = "applied_faq_only";

    if (!DRY_RUN) {
      await ref.set(patch, { merge: true });
    }
    return result;
  } catch (err) {
    result.action = "error";
    result.error = err instanceof Error ? err.message : String(err);
    return result;
  }
}

function countActions(
  reports: ApplyReportEntry[],
): Record<ApplyAction, number> {
  const counts: Record<ApplyAction, number> = {
    applied: 0,
    applied_tldr_only: 0,
    applied_faq_only: 0,
    skipped_tldr_and_faq_already_set: 0,
    error: 0,
  };
  for (const r of reports) counts[r.action] += 1;
  return counts;
}

function writeReport(
  entries: ApplyReportEntry[],
  counts: Record<ApplyAction, number>,
): void {
  mkdirSync(dirname(REPORT_JSON), { recursive: true });
  writeFileSync(
    REPORT_JSON,
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        total: entries.length,
        counts,
        reports: entries,
      },
      null,
      2,
    ),
  );
}

async function main(): Promise<void> {
  initFirebase();

  console.info(
    `== apply-failed-eval ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ==`,
  );

  const entries = loadFailedEvalEntries();
  console.info(
    `loaded ${entries.length} failed_eval entries with generated content`,
  );
  if (entries.length === 0) {
    console.info("nothing to do");
    return;
  }

  const started = Date.now();
  const reports: ApplyReportEntry[] = [];
  for (const entry of entries) {
    const r = await processEntry(entry);
    reports.push(r);
    console.info(
      `  ${r.action}: ${r.slug} (tldr=${r.wrote.tldr} faq=${r.wrote.faq})${
        r.error ? ` err=${r.error}` : ""
      }`,
    );
  }

  const counts = countActions(reports);
  writeReport(reports, counts);

  console.info(
    `applied=${counts.applied} tldr_only=${counts.applied_tldr_only} faq_only=${counts.applied_faq_only} skipped=${counts.skipped_tldr_and_faq_already_set} error=${counts.error}`,
  );
  console.info(
    `== done in ${((Date.now() - started) / 1000).toFixed(1)}s — report: ${REPORT_JSON} ==`,
  );
}

main().catch((err) => {
  console.error("apply-failed-eval failed:", err);
  process.exit(1);
});
