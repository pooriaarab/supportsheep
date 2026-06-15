import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { NAMED_AUTHORS } from "@/lib/authors-catalog";
import {
  BLOG_EDITORIAL_BATCH,
  buildEditorialSchedule,
  EDITORIAL_CATEGORY_SEEDS,
  type EditorialPostSpec,
} from "@/lib/editorial-calendar";
import { buildFaqBlockHtml } from "@/lib/faq-html/build-faq-block";
import { sanitizeArticleHtml } from "@/lib/sanitize/article-html";

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

const BLOG_ID = "default";
const CONCURRENCY = Number(process.env.CONCURRENCY ?? "3");
const DRY_RUN = process.env.DRY_RUN === "1";
const LIMIT = Number(process.env.LIMIT ?? "0");

const articleSchema = z.object({
  excerpt: z.string().min(80).max(240),
  summary: z.string().min(60).max(320),
  metaTitle: z.string().min(20).max(200),
  metaDescription: z.string().min(90).max(300),
  keywords: z.array(z.string().min(2).max(100)).min(4).max(8),
  bodyHtml: z.string().min(1200),
  faqs: z
    .array(
      z.object({
        question: z.string().min(6).max(140),
        answer: z.string().min(40).max(320),
      }),
    )
    .min(3)
    .max(5),
});

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
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

async function mapWithConcurrency<T, R>(
  items: readonly T[],
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

function buildAudience(item: EditorialPostSpec) {
  switch (item.cluster) {
    case "vertical-seo":
      return "local service businesses and supportsheep operators who need more qualified leads from organic search";
    case "migration":
      return "small business owners changing website builders and trying to protect their rankings, redirects, and content";
    case "local-seo":
      return "service businesses depending on Google Business Profile, reviews, and local landing pages";
    case "buyer-intent":
      return "buyers comparing website builders for a specific profession or service business";
    case "technical-seo":
      return "small business owners and marketers troubleshooting indexing, crawling, and migration problems";
  }
}

function buildAngle(item: EditorialPostSpec) {
  switch (item.cluster) {
    case "vertical-seo":
      return "Make the advice local-search specific, operational, and tailored to how this industry actually gets calls or inquiries.";
    case "migration":
      return "Prioritize redirects, canonicals, internal links, sitemap updates, and preserving existing rankings during the switch.";
    case "local-seo":
      return "Focus on Google Business Profile, reviews, service area pages, conversion intent, and practical local ranking signals.";
    case "buyer-intent":
      return "Be comparative and commercial without turning the article into sales copy. Give clear decision criteria and tradeoffs.";
    case "technical-seo":
      return "Diagnose root causes, explain what each issue means, and provide a step-by-step remediation sequence.";
  }
}

async function ensureCategories() {
  const db = getFirestore();
  const ref = db.collection("categories").doc("config");
  const snapshot = await ref.get();
  const data = snapshot.exists
    ? (snapshot.data() as {
        order?: Record<
          string,
          {
            displayName?: string;
            description?: string;
            icon?: string;
            order?: number;
            postCount?: number;
          }
        >;
      })
    : {};
  const current = data.order ?? {};
  let nextOrder =
    Object.values(current).reduce(
      (max, entry) => Math.max(max, entry.order ?? 0),
      -1,
    ) + 1;

  const updates: Record<
    string,
    {
      displayName?: string;
      description?: string;
      icon?: string;
      order?: number;
      postCount?: number;
    }
  > = { ...current };

  for (const seed of EDITORIAL_CATEGORY_SEEDS) {
    const existing = current[seed.slug];
    updates[seed.slug] = {
      displayName: seed.displayName,
      description: seed.description,
      icon: existing?.icon ?? "",
      order: existing?.order ?? nextOrder++,
      postCount: existing?.postCount ?? 0,
    };
  }

  if (DRY_RUN) {
    console.info(
      JSON.stringify(
        {
          ensuredCategories: Object.keys(updates),
        },
        null,
        2,
      ),
    );
    return;
  }

  await ref.set(
    {
      blogId: BLOG_ID,
      order: updates,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function countWords(html: string) {
  const stripped = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!stripped) return 0;
  return stripped.split(" ").filter(Boolean).length;
}

function getDefaultSubmissionStatus() {
  return {
    status: "not_configured" as const,
    lastSubmittedAt: null,
    lastUrl: null,
    lastError: null,
  };
}

async function ensureNamedAuthors() {
  const db = getFirestore();
  const now = FieldValue.serverTimestamp();

  await db.collection("authors").doc("blogbat-editorial-team").set(
    {
      name: "Supportsheep Editorial Team",
      jobTitle: "Editorial Team",
      bio: "The Supportsheep Editorial Team covers launching and growing small-business websites.",
      avatarUrl: "",
      email: "",
      sameAs: ["https://supportsheep.com"],
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  for (const author of NAMED_AUTHORS) {
    const { id, ...data } = author;
    await db.collection("authors").doc(id).set(
      {
        ...data,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
  }
}

async function generateArticle(item: EditorialPostSpec) {
  return generateObject({
    model: openai("gpt-5.4-mini"),
    schema: articleSchema,
    system: `Write practical SEO/editorial content for Supportsheep.

Hard rules:
- Body must be valid HTML using h2, h3, p, ul, ol, li, strong, em, and a tags only.
- No markdown fences and no wrapping <html>, <body>, or <article> tags.
- Open with a direct answer, not scene-setting.
- Keep sections extractable and specific. Avoid filler and generic motivational copy.
- Mention Supportsheep naturally when relevant as one option, not the center of the article.
- Do not invent unsupported product claims or fabricated stats.
- Include concrete examples, checklists, and operational details.
- Body should land around 1,100-1,800 words.
- FAQs must be distinct from the body headings and genuinely useful.`,
    prompt: JSON.stringify({
      title: item.title,
      slug: item.slug,
      category: item.category,
      postType: item.postType,
      cluster: item.cluster,
      audience: buildAudience(item),
      angle: buildAngle(item),
      productContext:
        "Supportsheep is an AI-powered blog and website platform for solopreneurs and small service businesses. It is strongest for simple marketing websites, local SEO content, and fast setup. Do not claim it has native scheduling, advanced ecommerce, or enterprise features unless explicitly true.",
    }),
  });
}

async function main() {
  initFirebase();
  await ensureNamedAuthors();
  await ensureCategories();

  const db = getFirestore();
  const startDate =
    process.env.START_DATE ??
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const manifest =
    LIMIT > 0 ? BLOG_EDITORIAL_BATCH.slice(0, LIMIT) : BLOG_EDITORIAL_BATCH;

  for (const item of manifest) {
    const existing = await db
      .collection("articles")
      .where("blogId", "==", BLOG_ID)
      .where("slug", "==", item.slug)
      .limit(1)
      .get();
    if (!existing.empty) {
      throw new Error(`Slug already exists: ${item.slug}`);
    }
  }

  const authorById = new Map(NAMED_AUTHORS.map((author) => [author.id, author]));

  const generated = await mapWithConcurrency(
    manifest,
    CONCURRENCY,
    async (item, index) => {
      const { object } = await generateArticle(item);
      const faqHtml = buildFaqBlockHtml(object.faqs);
      const body = sanitizeArticleHtml(`${object.bodyHtml}\n${faqHtml}`);
      const scheduledAt = buildEditorialSchedule(startDate, index);
      const words = countWords(body);
      const author = authorById.get(item.authorId);
      if (!author) {
        throw new Error(`Missing author seed for ${item.authorId}`);
      }

      return {
        item,
        scheduledAt,
        payload: {
          blogId: BLOG_ID,
          title: item.title,
          slug: item.slug,
          canonicalPath: `/${item.slug}`,
          legacyPaths: [],
          sourceUrl: null,
          sourcePath: null,
          wordpressPostId: null,
          body,
          draftBody: body,
          excerpt: object.excerpt,
          summary: object.summary,
          status: "scheduled" as const,
          scheduledAt,
          publishedAt: null,
          postType: item.postType,
          category: item.category,
          primaryCategory: item.category,
          categories: [item.category],
          tags: [item.cluster, item.category, ...object.keywords.slice(0, 3)],
          author: author.name,
          authorId: author.id,
          featuredImage: { url: "", alt: "" },
          ogImage: "",
          metaTitle: object.metaTitle,
          metaDescription: object.metaDescription,
          keywords: object.keywords,
          seoScore: 0,
          internalLinks: [],
          externalLinks: [],
          versions: [],
          generatedBy: "bulk" as const,
          generationMeta: null,
          submissionStatus: {
            indexNow: getDefaultSubmissionStatus(),
          },
          wordCount: words,
          readingTime: Math.max(1, Math.ceil(words / 200)),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
    },
  );

  if (DRY_RUN) {
    console.info(
      JSON.stringify(
        {
          created: generated.length,
          scheduled: generated.map((article) => ({
            slug: article.item.slug,
            scheduledAt: article.scheduledAt,
            authorId: article.item.authorId,
            category: article.item.category,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const batch = db.batch();
  for (const article of generated) {
    const ref = db.collection("articles").doc();
    batch.set(ref, article.payload);
  }
  await batch.commit();

  console.info(
    JSON.stringify(
      {
        created: generated.length,
        scheduled: generated.map((article) => ({
          slug: article.item.slug,
          scheduledAt: article.scheduledAt,
          authorId: article.item.authorId,
          category: article.item.category,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
