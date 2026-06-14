/**
 * Generate AI Featured Images for Blog Articles
 *
 * Uses GPT to write art-directed image prompts + gpt-image-1 to render them.
 * Uploads results to Firebase Storage and updates article featuredImage.
 *
 * Safety:
 *   - --dry-run: logs prompts + estimated cost, no generation, no writes
 *   - --slug <slug>: single article (validate before bulk)
 *   - --all: all published articles without AI-generated images
 *   - Skips articles already using ai-generated/ Storage path
 *   - Aborts if estimated cost exceeds USD 50
 *
 * Usage:
 *   set -a; source apps/web/.env.local; set +a
 *   bun run scripts/generate-featured-images.ts --slug <slug> --dry-run
 *   bun run scripts/generate-featured-images.ts --slug <slug>
 *   bun run scripts/generate-featured-images.ts --all --dry-run
 *   bun run scripts/generate-featured-images.ts --all
 */

import OpenAI from "openai";
import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";

type Bucket = ReturnType<ReturnType<typeof getStorage>["bucket"]>;

// --- Config ------------------------------------------------------------------

const DRY_RUN = process.argv.includes("--dry-run");
const ALL_MODE = process.argv.includes("--all");
const SLUG_IDX = process.argv.indexOf("--slug");
const SINGLE_SLUG = SLUG_IDX !== -1 ? process.argv[SLUG_IDX + 1] : null;

const BLOG_ID = "default";
const PROMPT_MODEL = "gpt-5.5";
const IMAGE_MODEL = "gpt-image-1";
const IMAGE_SIZE = "1536x1024" as const;
const IMAGE_QUALITY = "high" as const;
const CONCURRENCY = 2;
const COST_ABORT_USD = 50;
const COST_PER_IMAGE_USD = 0.04; // approximate gpt-image-1 high quality

const SYSTEM_PROMPT = `You are an editorial photography art director for a professional blog. Write a vivid text-to-image prompt for a blog featured image based on the article title, excerpt, and category.

Rules: (1) exactly one person doing one physical action; (2) no screens, laptops, monitors, phones, or visible text anywhere; (3) describe the person specifically (age, appearance, ethnicity, clothing); (4) show the subject through real physical action in a real location.

CRITICAL — vary the composition every time. NEVER default to "person sitting at a table looking down." Choose a shot type and angle that fits the action and feels distinct:
- Shot types to rotate: wide establishing shot, tight close-up on hands/face, low-angle looking up, high-angle bird's eye, over-shoulder, silhouette against light, action mid-motion, environmental portrait
- Actions to consider: walking, kneeling, reaching, climbing, standing outdoors, leaning against something, crouching, mid-gesture
- Environments: outdoors in natural light, a workshop, a street, a clinic, a garden, a hallway — not always indoors at a table

Use cinematic language: lighting quality, specific shot type and angle, lens, depth of field. Output ONLY the prompt string, max 110 words, no preamble, no quotes.`;

// --- Helpers -----------------------------------------------------------------

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
    storageBucket: assertEnv("FIREBASE_STORAGE_BUCKET"),
  });
}

function isAlreadyAiGenerated(featuredImage: unknown): boolean {
  if (typeof featuredImage === "object" && featuredImage !== null) {
    const url = (featuredImage as { url?: string }).url ?? "";
    return url.includes("ai-generated/");
  }
  return false;
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

// --- Core generation ---------------------------------------------------------

async function buildImagePrompt(
  client: OpenAI,
  title: string,
  excerpt: string,
  category: string,
): Promise<string> {
  const userContent = [
    `Title: ${title}`,
    excerpt ? `Excerpt: ${excerpt.slice(0, 400)}` : null,
    category ? `Category: ${category}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await client.chat.completions.create(
      {
        model: PROMPT_MODEL,
        max_completion_tokens: 600,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      },
      { signal: controller.signal },
    );
    return response.choices[0]?.message?.content?.trim() || title;
  } finally {
    clearTimeout(timeout);
  }
}

async function generateAndUpload(
  client: OpenAI,
  bucket: Bucket,
  slug: string,
  title: string,
  excerpt: string,
  category: string,
): Promise<{ url: string; alt: string; prompt: string }> {
  const prompt = await buildImagePrompt(client, title, excerpt, category);
  console.info(`  prompt: ${prompt.slice(0, 120)}...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  let imageResponse: Awaited<ReturnType<typeof client.images.generate>>;
  try {
    imageResponse = await client.images.generate(
      {
        model: IMAGE_MODEL,
        prompt,
        size: IMAGE_SIZE,
        quality: IMAGE_QUALITY,
        n: 1,
      },
      { signal: controller.signal },
    );
  } finally {
    clearTimeout(timeout);
  }

  const b64 = imageResponse.data?.[0]?.b64_json;
  if (!b64) throw new Error("gpt-image-1 returned no image data");

  const buffer = Buffer.from(b64, "base64");
  const storagePath = `images/ai-generated/${randomUUID()}-${slug}.png`;
  const bucketFile = bucket.file(storagePath);

  await bucketFile.save(buffer, {
    contentType: "image/png",
    metadata: { cacheControl: "public, max-age=31536000" },
  });
  await bucketFile.makePublic();

  const url = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  const alt = `Featured image for: ${title}`;

  return { url, alt, prompt };
}

// --- Main --------------------------------------------------------------------

interface ArticleDoc {
  id: string;
  slug: string;
  title?: string;
  excerpt?: string;
  category?: string;
  primaryCategory?: string;
  featuredImage?: unknown;
  status?: string;
}

async function main(): Promise<void> {
  if (!ALL_MODE && !SINGLE_SLUG) {
    console.error("Usage: --slug <slug> | --all [--dry-run]");
    process.exit(1);
  }

  const apiKey = assertEnv("OPENAI_API_KEY");
  const app = initFirebase();
  const db = getFirestore(app);
  const storage = getStorage(app);
  const bucketName = assertEnv("FIREBASE_STORAGE_BUCKET");
  const bucket = storage.bucket(bucketName);
  const client = new OpenAI({ apiKey });

  console.info(
    `== generate-featured-images ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ==`,
  );
  console.info(
    `model=${PROMPT_MODEL} image=${IMAGE_MODEL} concurrency=${CONCURRENCY}`,
  );

  // Build query
  let query = db
    .collection("articles")
    .where("blogId", "==", BLOG_ID) as FirebaseFirestore.Query;

  if (SINGLE_SLUG) {
    query = query.where("slug", "==", SINGLE_SLUG).limit(1);
  } else {
    query = query.where("status", "==", "published");
  }

  const snapshot = await query.get();
  const allDocs = snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as ArticleDoc[];

  // Skip already-AI-generated unless targeting a specific slug
  const articles = SINGLE_SLUG
    ? allDocs
    : allDocs.filter((a) => !isAlreadyAiGenerated(a.featuredImage));

  console.info(`\nArticles to process: ${articles.length}`);

  if (articles.length === 0) {
    console.info("Nothing to do.");
    return;
  }

  const estimatedCost = articles.length * COST_PER_IMAGE_USD;
  console.info(`Estimated cost: ~$${estimatedCost.toFixed(2)} USD`);

  if (!DRY_RUN && estimatedCost > COST_ABORT_USD) {
    console.error(
      `Aborting: estimated cost $${estimatedCost.toFixed(2)} exceeds limit $${COST_ABORT_USD}`,
    );
    process.exit(1);
  }

  if (DRY_RUN) {
    console.info("\n[DRY RUN] Would process:");
    for (const a of articles) {
      console.info(`  - ${a.slug}: ${a.title}`);
    }
    return;
  }

  let succeeded = 0;
  let failed = 0;
  let totalSpentUsd = 0;

  await processInChunks(articles, CONCURRENCY, async (article, idx) => {
    const title = article.title ?? "Untitled";
    const excerpt = article.excerpt ?? "";
    const category = article.category ?? article.primaryCategory ?? "";

    console.info(`\n[${idx + 1}/${articles.length}] ${article.slug}`);
    console.info(`  title: ${title}`);

    try {
      const result = await generateAndUpload(
        client,
        bucket,
        article.slug,
        title,
        excerpt,
        category,
      );

      await db.collection("articles").doc(article.id).update({
        featuredImage: { url: result.url, alt: result.alt },
        ogImage: result.url,
        updatedAt: new Date(),
      });

      console.info(`  updated featuredImage -> ${result.url}`);
      succeeded++;
      totalSpentUsd += COST_PER_IMAGE_USD;
      if (totalSpentUsd > COST_ABORT_USD) {
        console.error(`Cost limit reached ($${totalSpentUsd.toFixed(2)}). Stopping.`);
        process.exit(1);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  failed: ${msg}`);
      failed++;
    }
  });

  console.info(
    `\n== Done: ${succeeded} succeeded, ${failed} failed ==`,
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
