/**
 * Migration: featuredImage bare-string -> { url, alt } object shape.
 *
 * PR #51 introduced a new object shape for Article.featuredImage:
 *   { url: string; alt: string; width?: number; height?: number }
 *
 * Legacy Firestore documents stored featuredImage as a plain URL string.
 * This script converts all string-shape docs to object-shape and generates
 * SEO-friendly alt text per image using Claude Haiku 4.5 vision.
 *
 * Safety:
 *   - Skips docs already in object-shape (idempotent)
 *   - Falls back to article.title if the vision call fails or returns a refusal
 *   - Aborts if estimated API cost exceeds USD 20
 *   - DRY_RUN=1 writes nothing, samples up to 5 articles
 *
 * Usage:
 *   set -a; source apps/web/.env.local; set +a
 *   DRY_RUN=1 bun run scripts/migrations/2026-04-20-featured-image-object-shape.ts
 *   bun run scripts/migrations/2026-04-20-featured-image-object-shape.ts
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const DRY_RUN = process.env.DRY_RUN === "1";
const BLOG_ID = "default";
const MODEL = "claude-haiku-4-5-20251001";
const CONCURRENCY = 5;
const ALT_MAX_LEN = 125;
const REQUEST_TIMEOUT_MS = 20_000;
const COST_ABORT_USD = 20;

// Haiku 4.5 pricing (USD per 1M tokens): input $1.00, output $5.00.
const PRICE_INPUT_PER_MTOK = 1.0;
const PRICE_OUTPUT_PER_MTOK = 5.0;

const REFUSAL_PREFIXES = [
  "i cannot",
  "i can't",
  "sorry",
  "i'm unable",
  "i am unable",
  "i'm sorry",
  "i am sorry",
  "unfortunately",
];

interface ArticleDoc {
  id: string;
  title?: string;
  excerpt?: string;
  featuredImage?: unknown;
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
      // Private keys come from .env.local with literal \n in them.
      privateKey: assertEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

function isObjectShape(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { url?: unknown }).url === "string"
  );
}

function looksLikeRefusal(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return true;
  return REFUSAL_PREFIXES.some((p) => lower.startsWith(p));
}

function clampAlt(text: string): string {
  const trimmed = text.trim().replace(/^["']|["']$/g, "").trim();
  if (trimmed.length <= ALT_MAX_LEN) return trimmed;
  // Cut on word boundary where possible.
  const hard = trimmed.slice(0, ALT_MAX_LEN);
  const lastSpace = hard.lastIndexOf(" ");
  return lastSpace > 80 ? hard.slice(0, lastSpace) : hard;
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

async function generateAlt(
  client: Anthropic,
  url: string,
  title: string,
  excerpt: string,
  fallback: string,
): Promise<string> {
  const prompt = `Generate concise, SEO-friendly alt text for this blog post hero image. The article is titled: '${title}'. Article excerpt: '${excerpt.slice(0, 400)}'. The alt text should describe the visual content (not repeat the title), be accessible, under 125 chars. Respond with ONLY the alt text, no preamble, no quotes.`;

  try {
    const response = (await Promise.race([
      client.messages.create({
        model: MODEL,
        max_tokens: 150,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "url", url },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
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
    if (looksLikeRefusal(raw)) {
      return fallback;
    }
    const alt = clampAlt(raw);
    return alt || fallback;
  } catch (err) {
    apiFailures += 1;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`  ! alt generation failed for ${url}: ${msg}`);
    return fallback;
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
    `== featuredImage migration ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ==`,
  );
  console.info(`model=${MODEL} concurrency=${CONCURRENCY}`);

  const snap = await db
    .collection("articles")
    .where("blogId", "==", BLOG_ID)
    .get();
  console.info(`fetched ${snap.size} articles for blogId=${BLOG_ID}`);

  const stringShape: ArticleDoc[] = [];
  let alreadyObject = 0;
  let missingImage = 0;

  for (const doc of snap.docs) {
    const data = doc.data() as ArticleDoc;
    const fi = data.featuredImage;
    if (typeof fi === "string" && fi.length > 0) {
      stringShape.push({ ...data, id: doc.id });
    } else if (isObjectShape(fi)) {
      alreadyObject += 1;
    } else {
      missingImage += 1;
    }
  }

  console.info(
    `pending string-shape=${stringShape.length} already-object=${alreadyObject} missing/empty=${missingImage}`,
  );

  if (stringShape.length === 0) {
    console.info("nothing to do");
    return;
  }

  if (DRY_RUN) {
    const sample = stringShape.slice(0, 5);
    console.info(`\n-- DRY RUN: sampling ${sample.length} articles --\n`);
    for (const art of sample) {
      const url = art.featuredImage as string;
      const title = art.title ?? "";
      const excerpt = art.excerpt ?? "";
      const fallback = title || "Featured image";
      const alt = await generateAlt(client, url, title, excerpt, fallback);
      console.info(
        JSON.stringify({ id: art.id, title, url, generated_alt: alt }, null, 2),
      );
    }
    console.info(
      `\nestimated cost so far: $${costUsd().toFixed(4)} (input=${totalInputTokens} output=${totalOutputTokens})`,
    );
    console.info(`failures=${apiFailures}`);
    return;
  }

  const start = Date.now();
  const results: { id: string; url: string; alt: string }[] = [];
  let processed = 0;

  await processInChunks(stringShape, CONCURRENCY, async (art) => {
    const url = art.featuredImage as string;
    const title = art.title ?? "";
    const excerpt = art.excerpt ?? "";
    const fallback = title || "Featured image";
    const alt = await generateAlt(client, url, title, excerpt, fallback);
    results.push({ id: art.id, url, alt });
    processed += 1;
    if (processed % 10 === 0 || processed === stringShape.length) {
      console.info(
        `progress: ${processed}/${stringShape.length} cost~$${costUsd().toFixed(4)} failures=${apiFailures} last_alt="${alt}"`,
      );
    }
    if (costUsd() > COST_ABORT_USD) {
      throw new Error(
        `cost guard tripped at $${costUsd().toFixed(4)} > $${COST_ABORT_USD}`,
      );
    }
  });

  console.info(
    `\nall alt text generated. duration=${((Date.now() - start) / 1000).toFixed(1)}s cost=$${costUsd().toFixed(4)} failures=${apiFailures}`,
  );
  console.info(`writing ${results.length} updates to Firestore...`);

  let written = 0;
  for (let i = 0; i < results.length; i += 500) {
    const chunk = results.slice(i, i + 500);
    const batch = db.batch();
    for (const r of chunk) {
      batch.set(
        db.collection("articles").doc(r.id),
        { featuredImage: { url: r.url, alt: r.alt } },
        { merge: true },
      );
    }
    await batch.commit();
    written += chunk.length;
    console.info(`  wrote batch: ${written}/${results.length}`);
  }

  console.info(`\n== done. converted=${written} failures=${apiFailures} cost=$${costUsd().toFixed(4)} ==`);
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
