/**
 * Migration: convert prose-style `<h2>Frequently Asked Questions</h2>` FAQ
 * sections into TipTap-schema FAQ blocks (`<section class="faq" data-block="faq">`)
 * so they emit `FAQPage` JSON-LD on the public article page.
 *
 * Input: articles where the body contains a FAQ heading (detected by the same
 * regex the sibling TL;DR/FAQ backfill uses) but NO existing TipTap FAQ block.
 *
 * Idempotent: skips articles whose body already contains
 * `<section class="faq" data-block="faq">`. Safe to re-run after partial
 * success.
 *
 * Safety:
 *   - DRY_RUN=1 writes a JSON + MD report with before/after HTML and makes
 *     NO Firestore mutations.
 *   - Pure HTML transform — no LLM calls, no external spend.
 *
 * Usage (from apps/web):
 *   set -a; source <main-repo>/apps/web/.env.local; set +a
 *   DRY_RUN=1 bun run scripts/migrations/2026-04-21-convert-heading-faq.ts
 *   bun run scripts/migrations/2026-04-21-convert-heading-faq.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  buildFaqBlockHtmlRich,
  type RichFaqEntry,
} from "../../src/lib/faq-html/build-faq-block";
import { sanitizeArticleHtml } from "../../src/lib/sanitize/article-html";

const DRY_RUN = process.env.DRY_RUN === "1";
const blog_id = "default";
const STATUSES = ["published", "scheduled"];

const REPORT_DIR = resolve(__dirname, "reports");
const REPORT_SUFFIX = DRY_RUN ? "dry-run" : "live";
const REPORT_JSON = resolve(
  REPORT_DIR,
  `2026-04-21-convert-heading-faq-${REPORT_SUFFIX}.json`,
);
const REPORT_MD = resolve(
  REPORT_DIR,
  `2026-04-21-convert-heading-faq-${REPORT_SUFFIX}.md`,
);

/** TipTap-schema FAQ block — if present, the article is already converted. */
const FAQ_TIPTAP_PRESENT_REGEX =
  /<section\b[^>]*\bclass=(?:"[^"]*\bfaq\b[^"]*"|'[^']*\bfaq\b[^']*')[^>]*\bdata-block=(?:"faq"|'faq')/;
/** FAQ heading captured with its level so we know what the question level is. */
const FAQ_HEADING_REGEX =
  /<h([1-6])\b[^>]*>\s*(?:faqs?|frequently\s+asked\s+questions?|common\s+questions|questions\s+(?:and|&(?:amp;)?)\s+answers)\s*<\/h\1>/i;

interface ArticleDoc {
  id: string;
  title?: string;
  slug?: string;
  body?: string;
  status?: string;
}

type Action =
  | "skipped_already_tiptap"
  | "skipped_no_section_found"
  | "skipped_too_few_items"
  | "dry_run_would_convert"
  | "converted"
  | "error";

interface Report {
  articleId: string;
  slug: string;
  title: string;
  action: Action;
  parsedFaqCount: number;
  originalFaqHtml: string;
  newBlock: string;
  bodyBeforeLen: number;
  bodyAfterLen: number;
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

/**
 * Local copy of the renderer's stripTags helper. Kept standalone so this
 * script has no dependency on React component modules.
 */
function stripTags(html: string): string {
  return html
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6]|br|blockquote)\s*\/?>/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Find where the prose FAQ section ends: the first occurrence after the FAQ
 * heading of either a heading at the same-or-higher level OR an `<hr>` tag.
 * If no such boundary exists, the section runs to the end of the body.
 */
function findSectionEnd(body: string, afterHeading: number, headingLevel: number): number {
  const upper = Math.max(1, headingLevel);
  const levels = Array.from({ length: upper }, (_, i) => i + 1).join("");
  const boundary = new RegExp(`<(?:h[${levels}]|hr)\\b[^>]*>`, "gi");
  boundary.lastIndex = afterHeading;
  const match = boundary.exec(body);
  return match ? match.index : body.length;
}

interface ConvertOutcome {
  action: Exclude<Action, "error">;
  faqs: RichFaqEntry[];
  originalFaqHtml: string;
  newBody: string | null;
  newBlock: string;
  bodyBeforeLen: number;
  bodyAfterLen: number;
}

function convertBody(body: string): ConvertOutcome {
  const empty: ConvertOutcome = {
    action: "skipped_no_section_found",
    faqs: [],
    originalFaqHtml: "",
    newBody: null,
    newBlock: "",
    bodyBeforeLen: 0,
    bodyAfterLen: 0,
  };

  if (!body) return empty;
  if (FAQ_TIPTAP_PRESENT_REGEX.test(body)) {
    return { ...empty, action: "skipped_already_tiptap" };
  }

  const headingMatch = FAQ_HEADING_REGEX.exec(body);
  if (!headingMatch) return empty;

  const headingLevel = Number(headingMatch[1]);
  const headingStart = headingMatch.index;
  const headingEnd = headingMatch.index + headingMatch[0].length;
  const sectionEnd = findSectionEnd(body, headingEnd, headingLevel);

  const sectionInner = body.slice(headingEnd, sectionEnd);
  const bodyBefore = body.slice(0, headingStart);
  const bodyAfter = body.slice(sectionEnd);
  const originalFaqHtml = body.slice(headingStart, sectionEnd);

  const questionLevel = headingLevel + 1;
  const questionRegex = new RegExp(
    `<h${questionLevel}\\b[^>]*>([\\s\\S]*?)<\\/h${questionLevel}>`,
    "gi",
  );
  const questionMatches = Array.from(sectionInner.matchAll(questionRegex));

  const faqs: RichFaqEntry[] = [];
  for (let i = 0; i < questionMatches.length; i += 1) {
    const m = questionMatches[i]!;
    const qStart = m.index ?? 0;
    const qEnd = qStart + m[0].length;
    const nextStart = questionMatches[i + 1]?.index ?? sectionInner.length;
    const question = stripTags(m[1] ?? "");
    const answerHtml = sectionInner.slice(qEnd, nextStart).trim();
    if (!question || !answerHtml) continue;
    faqs.push({ question, answerHtml });
  }

  const base = {
    faqs,
    originalFaqHtml,
    bodyBeforeLen: bodyBefore.length,
    bodyAfterLen: bodyAfter.length,
  };

  if (faqs.length < 2) {
    return {
      ...base,
      action: "skipped_too_few_items",
      newBody: null,
      newBlock: "",
    };
  }

  const newBlock = buildFaqBlockHtmlRich(faqs);
  const newBody = sanitizeArticleHtml(`${bodyBefore}${newBlock}${bodyAfter}`);
  return {
    ...base,
    action: DRY_RUN ? "dry_run_would_convert" : "converted",
    newBody,
    newBlock,
  };
}

function countActions(reports: Report[]): Record<Action, number> {
  const counts: Record<Action, number> = {
    skipped_already_tiptap: 0,
    skipped_no_section_found: 0,
    skipped_too_few_items: 0,
    dry_run_would_convert: 0,
    converted: 0,
    error: 0,
  };
  for (const r of reports) counts[r.action] += 1;
  return counts;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n… [truncated ${value.length - max} chars]`;
}

function formatReportMarkdown(
  reports: Report[],
  totals: { total: number; pending: number; alreadyTiptap: number },
): string {
  const lines: string[] = [];
  lines.push(`# heading-FAQ -> TipTap conversion report (${DRY_RUN ? "DRY RUN" : "LIVE"})`);
  lines.push("");
  lines.push(`- Total articles scanned: ${totals.total}`);
  lines.push(`- Already TipTap (skipped before processing): ${totals.alreadyTiptap}`);
  lines.push(`- Processed here: ${reports.length}`);
  lines.push("");
  for (const r of reports) {
    lines.push(`## ${r.slug} — \`${r.action}\``);
    lines.push(`- Title: ${r.title}`);
    lines.push(`- Parsed FAQ count: ${r.parsedFaqCount}`);
    lines.push(`- bodyBefore=${r.bodyBeforeLen} bodyAfter=${r.bodyAfterLen}`);
    if (r.error) lines.push(`- Error: ${r.error}`);
    if (r.originalFaqHtml) {
      lines.push("");
      lines.push("### Original FAQ HTML");
      lines.push("```html");
      lines.push(truncate(r.originalFaqHtml, 2000));
      lines.push("```");
    }
    if (r.newBlock) {
      lines.push("");
      lines.push("### Converted TipTap block");
      lines.push("```html");
      lines.push(truncate(r.newBlock, 2000));
      lines.push("```");
    }
    lines.push("");
  }
  return lines.join("\n");
}

function writeReports(
  reports: Report[],
  totals: { total: number; pending: number; alreadyTiptap: number },
): void {
  mkdirSync(dirname(REPORT_JSON), { recursive: true });
  writeFileSync(
    REPORT_JSON,
    JSON.stringify({ ...totals, reports }, null, 2),
  );
  writeFileSync(REPORT_MD, formatReportMarkdown(reports, totals));
}

async function main(): Promise<void> {
  initFirebase();
  const db = getFirestore();

  console.info(`== convert-heading-faq ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ==`);

  const snap = await db
    .collection("articles")
    .where("blogId", "==", blog_id)
    .where("status", "in", STATUSES)
    .get();
  console.info(`fetched ${snap.size} articles`);

  const articles: ArticleDoc[] = snap.docs.map((d) => ({
    ...(d.data() as ArticleDoc),
    id: d.id,
  }));

  const candidates = articles.filter((a) => {
    const body = a.body ?? "";
    if (!body) return false;
    if (FAQ_TIPTAP_PRESENT_REGEX.test(body)) return false;
    return FAQ_HEADING_REGEX.test(body);
  });
  const alreadyTiptap = articles.filter((a) =>
    FAQ_TIPTAP_PRESENT_REGEX.test(a.body ?? ""),
  ).length;

  console.info(
    `to process: ${candidates.length} | skipped_already_tiptap: ${alreadyTiptap}`,
  );
  if (candidates.length === 0) {
    console.info("nothing to do");
    return;
  }

  const started = Date.now();
  console.info(`-- processing ${candidates.length} articles --`);
  const reports: Report[] = [];
  let processed = 0;

  for (const art of candidates) {
    const base: Report = {
      articleId: art.id,
      slug: art.slug ?? art.id,
      title: art.title ?? "(untitled)",
      action: "skipped_no_section_found",
      parsedFaqCount: 0,
      originalFaqHtml: "",
      newBlock: "",
      bodyBeforeLen: 0,
      bodyAfterLen: 0,
    };
    try {
      const outcome = convertBody(art.body ?? "");
      base.action = outcome.action;
      base.parsedFaqCount = outcome.faqs.length;
      base.originalFaqHtml = outcome.originalFaqHtml;
      base.newBlock = outcome.newBlock;
      base.bodyBeforeLen = outcome.bodyBeforeLen;
      base.bodyAfterLen = outcome.bodyAfterLen;

      if (!DRY_RUN && outcome.action === "converted" && outcome.newBody) {
        await db
          .collection("articles")
          .doc(art.id)
          .set(
            { body: outcome.newBody, updatedAt: FieldValue.serverTimestamp() },
            { merge: true },
          );
      }
    } catch (err) {
      base.action = "error";
      base.error = err instanceof Error ? err.message : String(err);
    }
    reports.push(base);
    processed += 1;
    if (processed % 10 === 0 || processed === candidates.length) {
      console.info(
        `progress ${processed}/${candidates.length} last=${base.action}:${base.slug}`,
      );
    }
  }

  writeReports(reports, {
    total: articles.length,
    pending: candidates.length,
    alreadyTiptap,
  });
  const counts = countActions(reports);
  const convertedLabel = DRY_RUN ? counts.dry_run_would_convert : counts.converted;
  console.info(
    `actions: converted=${convertedLabel} skipped_no_section_found=${counts.skipped_no_section_found} skipped_too_few_items=${counts.skipped_too_few_items} error=${counts.error}`,
  );
  console.info(
    `== done in ${((Date.now() - started) / 1000).toFixed(1)}s ==`,
  );
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
