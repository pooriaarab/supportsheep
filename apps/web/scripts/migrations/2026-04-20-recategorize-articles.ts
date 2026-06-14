/**
 * Migration: populate `primaryCategory` + `categories[]` on articles.
 *
 * Goal:
 *   - Every article gets a stable primary category (slug) and up to 3
 *     overlapping category slugs in `categories[]` (primary first).
 *   - Articles previously stored with only a legacy `category` string are
 *     auto-classified by Claude Haiku 4.5 using title + first 300 chars of
 *     body against the 7 existing category slugs plus three new buckets
 *     ("seo", "web-builders", "troubleshooting").
 *
 * Safety:
 *   - Skips articles already populated with `primaryCategory !== "uncategorized"`
 *     (idempotent -- safe to re-run).
 *   - Aborts if estimated API cost exceeds USD 20.
 *   - DRY_RUN=1 writes nothing, samples up to 5 classifications.
 *   - Batch writes 500 docs at a time.
 *
 * Usage:
 *   DRY_RUN=1 bun run scripts/migrations/2026-04-20-recategorize-articles.ts
 *   bun run scripts/migrations/2026-04-20-recategorize-articles.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Load env from the main repo apps/web/.env.local (worktrees don't copy it).
// Allow override via ENV_FILE=/abs/path for custom locations.
const CANDIDATE_ENV_PATHS = [
  process.env.ENV_FILE,
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), "apps/web/.env.local"),
].filter((p): p is string => typeof p === "string" && p.length > 0);

for (const candidate of CANDIDATE_ENV_PATHS) {
  if (existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

const DRY_RUN = process.env.DRY_RUN === "1";
const BLOG_ID = "default";
const MODEL = "claude-haiku-4-5-20251001";
const CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 20_000;
const COST_ABORT_USD = 20;
const BODY_EXCERPT_CHARS = 300;
const BATCH_SIZE = 500;

// Haiku 4.5 pricing (USD per 1M tokens).
const PRICE_INPUT_PER_MTOK = 1.0;
const PRICE_OUTPUT_PER_MTOK = 5.0;

// Category slugs the classifier may assign. Existing 7 plus 3 new buckets.
const CATEGORY_CHOICES = [
  {
    slug: "guides",
    description: "Long-form how-to guides and playbooks walking through multi-step processes.",
  },
  {
    slug: "ai",
    description: "Articles about AI tooling, prompts, ChatGPT/Claude, and AI website builders.",
  },
  {
    slug: "website-tips",
    description: "Tactical tips for building, designing, or improving a website.",
  },
  {
    slug: "niches",
    description: "Industry- or vertical-specific website advice (e.g. plumbers, therapists, bakeries).",
  },
  {
    slug: "marketing-tips",
    description: "Organic marketing, content, social, and distribution tactics.",
  },
  {
    slug: "business-tips",
    description: "Running a small business: ops, finance, pricing, hiring, legal, side hustles.",
  },
  {
    slug: "seo",
    description: "Search engine optimization: keywords, on-page, technical SEO, rankings, local SEO.",
  },
  {
    slug: "web-builders",
    description: "Reviews, comparisons, and guides for specific website builders (Wix, Squarespace, WordPress, BlogBat, etc.).",
  },
  {
    slug: "troubleshooting",
    description: "Fixing errors, debugging domains/hosting/DNS, recovering accounts, resolving outages.",
  },
] as const;

type CategorySlug = (typeof CATEGORY_CHOICES)[number]["slug"];
const VALID_SLUGS = new Set<string>(CATEGORY_CHOICES.map((c) => c.slug));

// Map from legacy display-name category stored in docs to canonical slug.
// The WordPress import wrote title-case display names like "Website Tips".
const LEGACY_CATEGORY_ALIASES: Record<string, CategorySlug> = {
  "website tips": "website-tips",
  "marketing tips": "marketing-tips",
  "business tips": "business-tips",
  niches: "niches",
  ai: "ai",
  guides: "guides",
  seo: "seo",
  "web builders": "web-builders",
  troubleshooting: "troubleshooting",
};

interface ArticleDoc {
  id: string;
  title?: string;
  body?: string;
  excerpt?: string;
  category?: string;
  primaryCategory?: string;
  categories?: string[];
}

interface Classification {
  primary: CategorySlug;
  categories: CategorySlug[];
}

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
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

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function legacyCategoryToSlug(legacy: string | undefined): CategorySlug | null {
  if (!legacy) return null;
  const normalized = legacy.trim().toLowerCase();
  if (VALID_SLUGS.has(normalized)) return normalized as CategorySlug;
  const aliased = LEGACY_CATEGORY_ALIASES[normalized];
  return aliased ?? null;
}

let totalInputTokens = 0;
let totalOutputTokens = 0;
let apiFailures = 0;

function costUsd(): number {
  return (
    (totalInputTokens / 1_000_000) * PRICE_INPUT_PER_MTOK +
    (totalOutputTokens / 1_000_000) * PRICE_OUTPUT_PER_MTOK
  );
}

function parseClassification(raw: string): Classification | null {
  // Extract first {...} block even if wrapped in code fences.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;
  const arr = Array.isArray(obj.categories) ? obj.categories : null;
  if (!arr || arr.length === 0) return null;
  const clean = arr
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is CategorySlug => VALID_SLUGS.has(s));
  if (clean.length === 0) return null;
  const primary = clean[0]!;
  const unique = Array.from(new Set(clean)).slice(0, 3);
  return { primary, categories: unique };
}

async function classify(
  client: Anthropic,
  title: string,
  bodyExcerpt: string,
  fallback: CategorySlug,
): Promise<Classification> {
  const choiceList = CATEGORY_CHOICES.map(
    (c) => `- "${c.slug}": ${c.description}`,
  ).join("\n");
  const prompt = `Classify this blog article into up to 3 of the categories below. Return ONLY JSON matching the schema {"categories": string[]} where the first entry is the primary category. Use only slugs from this list. Prefer fewer, more precise categories over more.

Categories:
${choiceList}

Article title: ${title}

Article excerpt:
${bodyExcerpt}

Respond with JSON only, e.g. {"categories":["website-tips","seo"]}.`;

  try {
    const response = (await Promise.race([
      client.messages.create({
        model: MODEL,
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }],
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`timeout after ${REQUEST_TIMEOUT_MS}ms`)),
          REQUEST_TIMEOUT_MS,
        ),
      ),
    ])) as Anthropic.Message;

    if (response.usage) {
      totalInputTokens += response.usage.input_tokens ?? 0;
      totalOutputTokens += response.usage.output_tokens ?? 0;
    }

    const block = response.content.find((c) => c.type === "text");
    const raw = block && block.type === "text" ? block.text : "";
    const parsed = parseClassification(raw);
    if (parsed) return parsed;
    apiFailures += 1;
    console.warn(`  ! could not parse classification: ${raw.slice(0, 160)}`);
    return { primary: fallback, categories: [fallback] };
  } catch (err) {
    apiFailures += 1;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ! classification failed: ${msg}`);
    return { primary: fallback, categories: [fallback] };
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
    const results = await Promise.all(
      chunk.map((item, idx) => fn(item, i + idx)),
    );
    out.push(...results);
  }
  return out;
}

async function main(): Promise<void> {
  const apiKey = assertEnv("ANTHROPIC_API_KEY");
  initFirebase();
  const db = getFirestore();
  const client = new Anthropic({ apiKey });

  console.info(
    `== recategorize articles ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ==`,
  );
  console.info(`model=${MODEL} concurrency=${CONCURRENCY}`);

  const snap = await db
    .collection("articles")
    .where("blogId", "==", BLOG_ID)
    .get();
  console.info(`fetched ${snap.size} articles for blogId=${BLOG_ID}`);

  const pending: ArticleDoc[] = [];
  let alreadyDone = 0;
  for (const doc of snap.docs) {
    const data = doc.data() as ArticleDoc;
    const pc = data.primaryCategory?.trim().toLowerCase();
    if (pc && pc !== "uncategorized" && VALID_SLUGS.has(pc)) {
      alreadyDone += 1;
      continue;
    }
    pending.push({ ...data, id: doc.id });
  }

  console.info(`pending=${pending.length} already-done=${alreadyDone}`);

  if (pending.length === 0) {
    console.info("nothing to do");
    return;
  }

  if (DRY_RUN) {
    const sample = pending.slice(0, 5);
    console.info(`\n-- DRY RUN: sampling ${sample.length} articles --\n`);
    for (const art of sample) {
      const title = art.title ?? "";
      const bodyExcerpt = stripHtml(
        art.body ?? art.excerpt ?? "",
      ).slice(0, BODY_EXCERPT_CHARS);
      const fallback =
        legacyCategoryToSlug(art.category) ?? "website-tips";
      const result = await classify(client, title, bodyExcerpt, fallback);
      console.info(
        JSON.stringify(
          {
            id: art.id,
            title,
            legacy_category: art.category,
            primary: result.primary,
            categories: result.categories,
          },
          null,
          2,
        ),
      );
    }
    console.info(
      `\nestimated cost so far: $${costUsd().toFixed(4)} (input=${totalInputTokens} output=${totalOutputTokens})`,
    );
    console.info(`failures=${apiFailures}`);
    return;
  }

  // Live classification run.
  const start = Date.now();
  const results: Array<{
    id: string;
    primary: CategorySlug;
    categories: CategorySlug[];
  }> = [];
  let processed = 0;

  await processInChunks(pending, CONCURRENCY, async (art) => {
    const title = art.title ?? "";
    const bodyExcerpt = stripHtml(art.body ?? art.excerpt ?? "").slice(
      0,
      BODY_EXCERPT_CHARS,
    );
    const fallback = legacyCategoryToSlug(art.category) ?? "website-tips";
    const result = await classify(client, title, bodyExcerpt, fallback);
    results.push({ id: art.id, ...result });
    processed += 1;
    if (processed % 20 === 0 || processed === pending.length) {
      console.info(
        `progress: ${processed}/${pending.length} cost~$${costUsd().toFixed(4)} failures=${apiFailures} last=${result.primary}`,
      );
    }
    if (costUsd() > COST_ABORT_USD) {
      throw new Error(
        `cost guard tripped at $${costUsd().toFixed(4)} > $${COST_ABORT_USD}`,
      );
    }
  });

  console.info(
    `\nall classifications done. duration=${((Date.now() - start) / 1000).toFixed(1)}s cost=$${costUsd().toFixed(4)} failures=${apiFailures}`,
  );
  console.info(`writing ${results.length} updates to Firestore...`);

  let written = 0;
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const chunk = results.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const r of chunk) {
      batch.set(
        db.collection("articles").doc(r.id),
        {
          primaryCategory: r.primary,
          categories: r.categories,
        },
        { merge: true },
      );
    }
    await batch.commit();
    written += chunk.length;
    console.info(`  wrote batch: ${written}/${results.length}`);
  }

  // Distribution summary.
  const dist: Record<string, number> = {};
  for (const r of results) {
    dist[r.primary] = (dist[r.primary] ?? 0) + 1;
  }
  console.info("\nprimary category distribution:");
  for (const [k, v] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    console.info(`  ${k}: ${v}`);
  }
  console.info(
    `\n== done. updated=${written} failures=${apiFailures} cost=$${costUsd().toFixed(4)} ==`,
  );
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
