import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Article, Pillar, ProgrammaticPage } from "@repo/types";
import {
  buildAlternativeArticleInput,
  buildAlternativesHubArticleInput,
  buildVsArticleInput,
  convertPillarToArticleInput,
  convertProgrammaticToArticleInput,
  type LegacyArticleDraft,
} from "../../src/lib/content-migration/legacy-to-article";
import {
  BLOGBAT_PROS_CONS,
  getCompetitorNarrative,
} from "../../src/lib/alternatives/content";
import { COMPETITORS } from "../../src/lib/alternatives/competitors";
import { isReservedRootSlug } from "../../src/lib/permalinks";
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

function wordCount(html: string): number {
  const stripped = stripHtml(html);
  if (!stripped) return 0;
  return stripped.split(" ").filter(Boolean).length;
}

function resolveTimestamp(
  ...values: Array<
    string | { _seconds: number } | { toDate: () => Date } | null | undefined
  >
) {
  for (const value of values) {
    if (!value) continue;
    const serialized =
      typeof value === "string"
        ? value
        : typeof value === "object"
          ? serializeDoc({ value }).value
          : "";
    if (typeof serialized !== "string") continue;
    if (serialized) return serialized;
  }
  return new Date().toISOString();
}

function buildArticleDoc(
  draft: LegacyArticleDraft,
  status: Article["status"],
  timestamps?: {
    createdAt?: string | { _seconds: number } | { toDate: () => Date } | null;
    updatedAt?: string | { _seconds: number } | { toDate: () => Date } | null;
    publishedAt?: string | { _seconds: number } | { toDate: () => Date } | null;
  },
): Omit<Article, "versions"> & { versions: Article["versions"] } {
  const createdAt = resolveTimestamp(timestamps?.createdAt);
  const updatedAt = resolveTimestamp(timestamps?.updatedAt, createdAt);
  const publishedAt =
    status === "published"
      ? resolveTimestamp(
          timestamps?.publishedAt,
          timestamps?.updatedAt,
          createdAt,
        )
      : null;
  const words = wordCount(draft.body);

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
    status,
    scheduledAt: null,
    publishedAt,
    postType: draft.postType,
    category: draft.category,
    primaryCategory: draft.primaryCategory,
    categories: draft.categories,
    tags: draft.tags,
    author: "Supportsheep",
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
    createdAt,
    updatedAt,
  };
}

type ReportCandidate = {
  source: string;
  sourcePath: string | null;
  slug: string;
  title: string;
  postType: string;
  status: Article["status"];
};

async function main() {
  initFirebase();
  const db = getFirestore();

  const [articlesSnap, programmaticSnap, pillarsSnap] = await Promise.all([
    db.collection("articles").where("blogId", "==", BLOG_ID).get(),
    db.collection("programmatic_pages").get(),
    db.collection("pillars").get(),
  ]);

  const existingArticles = articlesSnap.docs.map(
    (doc) =>
      serializeDoc({ id: doc.id, ...(doc.data() as Article) }) as Article & {
        id: string;
      },
  );
  const programmaticDocs = programmaticSnap.docs.map((doc) => ({
    id: doc.id,
    raw: doc,
    data: serializeDoc({
      id: doc.id,
      ...(doc.data() as Omit<ProgrammaticPage, "id"> & { collection: string }),
    }) as Omit<ProgrammaticPage, "id"> & { id: string; collection: string },
  }));
  const pillars = pillarsSnap.docs.map(
    (doc) =>
      serializeDoc({
        slug: doc.id,
        ...(doc.data() as Omit<Pillar, "slug">),
      }) as Pillar,
  );
  const pillarsBySlug = new Map<string, (typeof pillarsSnap.docs)[number]>();
  for (const doc of pillarsSnap.docs) {
    if (!pillarsBySlug.has(doc.id)) {
      pillarsBySlug.set(doc.id, doc);
    }
  }

  const usedSlugs = new Set(
    existingArticles.flatMap((article) =>
      article.slug ? [article.slug] : [],
    ),
  );
  const writes: Array<{
    source: string;
    sourceRef?: FirebaseFirestore.DocumentReference;
    article: Omit<Article, "versions"> & { versions: Article["versions"] };
  }> = [];
  const collisions: Array<{
    source: string;
    sourcePath: string | null;
    proposedSlug: string;
    reason: string;
  }> = [];

  function stage(
    candidate: ReportCandidate,
    article: Omit<Article, "versions"> & { versions: Article["versions"] },
    sourceRef?: FirebaseFirestore.DocumentReference,
  ) {
    if (isReservedRootSlug(candidate.slug)) {
      collisions.push({
        source: candidate.source,
        sourcePath: candidate.sourcePath,
        proposedSlug: candidate.slug,
        reason: "reserved-root-slug",
      });
      return;
    }
    if (usedSlugs.has(candidate.slug)) {
      collisions.push({
        source: candidate.source,
        sourcePath: candidate.sourcePath,
        proposedSlug: candidate.slug,
        reason: "duplicate-target-slug",
      });
      return;
    }
    usedSlugs.add(candidate.slug);
    writes.push({ source: candidate.source, sourceRef, article });
  }

  for (const page of programmaticDocs) {
    const draft = convertProgrammaticToArticleInput(page.data);
    const pageData = page.raw.data();
    stage(
      {
        source: `programmatic:${page.data.collection}`,
        sourcePath: draft.sourcePath,
        slug: draft.slug,
        title: draft.title,
        postType: draft.postType,
        status: "published",
      },
      buildArticleDoc(draft, "published", {
        createdAt: pageData.createdAt,
        updatedAt: pageData.updatedAt,
        publishedAt: pageData.updatedAt ?? pageData.createdAt,
      }),
      page.raw.ref,
    );
  }

  for (const pillar of pillars) {
    const draft = convertPillarToArticleInput(pillar);
    const originalDoc = pillarsBySlug.get(pillar.slug);
    const originalData = originalDoc?.data();
    stage(
      {
        source: "pillar",
        sourcePath: draft.sourcePath,
        slug: draft.slug,
        title: draft.title,
        postType: draft.postType,
        status: "published",
      },
      buildArticleDoc(draft, "published", {
        createdAt: originalData?.updatedAt,
        updatedAt: originalData?.updatedAt,
        publishedAt: originalData?.updatedAt,
      }),
      originalDoc?.ref,
    );
  }

  stage(
    {
      source: "code-backed:alternatives-hub",
      sourcePath: "/alternatives",
      slug: "blogbat-alternatives",
      title: "Supportsheep Alternatives and Comparisons",
      postType: "comparison",
      status: "published",
    },
    buildArticleDoc(buildAlternativesHubArticleInput(COMPETITORS), "published"),
  );

  for (const competitor of COMPETITORS) {
    const narrative = getCompetitorNarrative(competitor.slug);
    if (!narrative) continue;

    const alternative = buildAlternativeArticleInput(
      competitor,
      narrative,
      BLOGBAT_PROS_CONS,
    );
    stage(
      {
        source: "code-backed:alternative",
        sourcePath: alternative.sourcePath,
        slug: alternative.slug,
        title: alternative.title,
        postType: alternative.postType,
        status: "published",
      },
      buildArticleDoc(alternative, "published"),
    );

    const versus = buildVsArticleInput(competitor, narrative);
    stage(
      {
        source: "code-backed:vs",
        sourcePath: versus.sourcePath,
        slug: versus.slug,
        title: versus.title,
        postType: versus.postType,
        status: "published",
      },
      buildArticleDoc(versus, "published"),
    );
  }

  const report = {
    scanned: {
      existingArticles: existingArticles.length,
      programmaticPages: programmaticDocs.length,
      pillars: pillars.length,
      codeBackedComparisons: COMPETITORS.length * 2 + 1,
    },
    writes: writes.map(({ source, article }) => ({
      source,
      slug: article.slug,
      title: article.title,
      status: article.status,
      postType: article.postType,
      sourcePath: article.sourcePath ?? null,
    })),
    collisions,
    deletes: {
      programmaticPages: collisions.length === 0 ? programmaticDocs.length : 0,
      pillars: collisions.length === 0 ? pillars.length : 0,
    },
  };

  if (DRY_RUN || collisions.length > 0) {
    console.info(JSON.stringify(report, null, 2));
    if (collisions.length > 0 && !DRY_RUN) {
      process.exitCode = 1;
    }
    return;
  }

  const batch = db.batch();
  for (const { article } of writes) {
    const ref = db.collection("articles").doc();
    batch.set(ref, article);
  }
  for (const page of programmaticDocs) {
    batch.delete(page.raw.ref);
  }
  for (const doc of pillarsSnap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();

  console.info(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
