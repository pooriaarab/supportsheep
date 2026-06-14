import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import type { Article, PostType } from "@repo/types";
import { serializeDoc } from "../../src/lib/serialize";

const CANDIDATE_ENV_PATHS = [
  process.env.ENV_FILE,
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), "apps/web/.env.local"),
].filter((candidate): candidate is string => Boolean(candidate));

for (const candidate of CANDIDATE_ENV_PATHS) {
  if (existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

const DRY_RUN = process.env.DRY_RUN === "1";
const BLOG_ID = "default";
const CONCURRENCY = 4;
const LIMIT = Number(process.env.LIMIT ?? "0");

const postTypeSchema = z.object({
  postType: z.enum([
    "blog_post",
    "listicle",
    "how_to",
    "comparison",
    "product_review",
    "pillar_page",
    "glossary",
    "landing_page",
  ]),
  reason: z.string().min(1).max(240),
});

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function initFirebase(): App {
  const existing = getApps();
  if (existing.length > 0) return existing[0]!;
  return initializeApp({
    credential: cert({
      projectId: assertEnv("FIREBASE_ADMIN_PROJECT_ID"),
      clientEmail: assertEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey: assertEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

async function classifyArticle(article: Article, model: string) {
  return generateObject({
    model: openai(model),
    schema: postTypeSchema,
    system: `Classify blog content into exactly one post type.

Use:
- blog_post: general editorial article
- listicle: roundup, ranked list, "best X", "top N"
- how_to: step-by-step instructional guide
- comparison: alternatives, versus, competitor or option comparison
- product_review: review of a specific product
- pillar_page: broad evergreen hub/guide with subtopics
- glossary: term definition page
- landing_page: conversion-led or vertical landing page

Conservative rule: if unsure, choose blog_post.`,
    prompt: JSON.stringify({
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      summary: article.summary,
      category: article.primaryCategory || article.category,
      keywords: article.keywords?.slice(0, 8) ?? [],
      bodyPreview: (article.body || article.draftBody || "").slice(0, 7000),
    }),
  });
}

async function classifyWithFallback(article: Article) {
  try {
    return await classifyArticle(article, "gpt-5.4-mini");
  } catch {
    return await classifyArticle(article, "gpt-5.4");
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]!, index);
      }
    }),
  );
  return results;
}

async function main() {
  initFirebase();
  const db = getFirestore();
  const snapshot = await db
    .collection("articles")
    .where("blogId", "==", BLOG_ID)
    .get();
  const docs = snapshot.docs;
  const articles = docs.map(
    (doc) =>
      serializeDoc({ id: doc.id, ...(doc.data() as Article) }) as Article & {
        id: string;
      },
  );
  const uncappedTargets = articles.filter(
    (article) => article.postType === "blog_post",
  );
  const targets = LIMIT > 0 ? uncappedTargets.slice(0, LIMIT) : uncappedTargets;

  const changes = await mapWithConcurrency(
    targets,
    CONCURRENCY,
    async (article) => {
      const result = await classifyWithFallback(article);
      return {
        id: article.id,
        slug: article.slug,
        from: article.postType,
        to: result.object.postType as PostType,
        reason: result.object.reason,
      };
    },
  );

  const changed = changes.filter((change) => change.to !== change.from);
  const report = {
    scanned: targets.length,
    eligible: uncappedTargets.length,
    changedCount: changed.length,
    changed,
  };

  if (DRY_RUN) {
    console.info(JSON.stringify(report, null, 2));
    return;
  }

  const batch = db.batch();
  for (const change of changed) {
    batch.update(db.collection("articles").doc(change.id), {
      postType: change.to,
      updatedAt: new Date().toISOString(),
    });
  }
  await batch.commit();

  console.info(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
