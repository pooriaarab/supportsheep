import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Article } from "@repo/types";
import {
  buildAlternativeArticleInput,
  buildAlternativesHubArticleInput,
  buildVsArticleInput,
  type LegacyArticleDraft,
} from "../../src/lib/content-migration/legacy-to-article";
import {
  BLOGBAT_PROS_CONS,
  getCompetitorNarrative,
} from "../../src/lib/alternatives/content";
import { COMPETITORS } from "../../src/lib/alternatives/competitors";
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

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildArticleDoc(
  draft: LegacyArticleDraft,
): Omit<Article, "versions"> & { versions: Article["versions"] } {
  const words = stripHtml(draft.body).split(" ").filter(Boolean).length;
  const now = new Date().toISOString();
  return {
    blogId: BLOG_ID,
    title: draft.title,
    slug: draft.slug,
    canonicalPath: draft.canonicalPath,
    legacyPaths: draft.legacyPaths,
    sourceUrl: null,
    sourcePath: draft.sourcePath,
    wordpressPostId: null,
    body: draft.body,
    draftBody: draft.draftBody,
    excerpt: draft.excerpt,
    summary: draft.summary,
    status: "published",
    scheduledAt: null,
    publishedAt: now,
    postType: draft.postType,
    category: draft.category,
    primaryCategory: draft.primaryCategory,
    categories: draft.categories,
    tags: draft.tags,
    author: "BlogBat",
    featuredImage: { url: "", alt: "" },
    ogImage: "",
    metaTitle: draft.metaTitle,
    metaDescription: draft.metaDescription,
    keywords: draft.keywords,
    seoScore: 0,
    internalLinks: [],
    externalLinks: [],
    versions: [],
    generatedBy: "manual",
    generationMeta: null,
    wordCount: words,
    readingTime: Math.max(1, Math.ceil(words / 200)),
    createdAt: now,
    updatedAt: now,
  };
}

async function main() {
  initFirebase();
  const db = getFirestore();
  const snapshot = await db
    .collection("articles")
    .where("blogId", "==", BLOG_ID)
    .get();
  const existing = snapshot.docs.map(
    (doc) =>
      serializeDoc({ id: doc.id, ...(doc.data() as Article) }) as Article & {
        id: string;
      },
  );
  const existingSlugs = new Set(existing.map((article) => article.slug));

  const candidates = [buildAlternativesHubArticleInput(COMPETITORS)];
  for (const competitor of COMPETITORS) {
    const narrative = getCompetitorNarrative(competitor.slug);
    if (!narrative) continue;
    candidates.push(
      buildAlternativeArticleInput(competitor, narrative, BLOGBAT_PROS_CONS),
    );
    candidates.push(buildVsArticleInput(competitor, narrative));
  }

  const missing = candidates.filter(
    (candidate) => !existingSlugs.has(candidate.slug),
  );
  const report = {
    scannedExistingArticles: existing.length,
    candidateArticles: candidates.length,
    missingCount: missing.length,
    missing: missing.map((article) => ({
      slug: article.slug,
      title: article.title,
      sourcePath: article.sourcePath,
    })),
  };

  if (DRY_RUN || missing.length === 0) {
    console.info(JSON.stringify(report, null, 2));
    return;
  }

  const batch = db.batch();
  for (const article of missing) {
    batch.set(db.collection("articles").doc(), buildArticleDoc(article));
  }
  await batch.commit();

  console.info(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
