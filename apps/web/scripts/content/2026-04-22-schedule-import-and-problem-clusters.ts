import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { buildFaqBlockHtml } from "../../src/lib/faq-html/build-faq-block";
import { sanitizeArticleHtml } from "../../src/lib/sanitize/article-html";

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

const blog_id = "default";
const CONCURRENCY = 2;
const DRY_RUN = process.env.DRY_RUN === "1";
const LIMIT = Number(process.env.LIMIT ?? "0");

const articleSchema = z.object({
  excerpt: z.string().min(60).max(240),
  summary: z.string().min(60).max(320),
  metaTitle: z.string().min(20).max(200),
  metaDescription: z.string().min(80).max(300),
  keywords: z.array(z.string().min(2).max(100)).min(3).max(8),
  bodyHtml: z.string().min(800),
  faqs: z
    .array(
      z.object({
        question: z.string().min(6).max(140),
        answer: z.string().min(30).max(320),
      }),
    )
    .min(3)
    .max(5),
});

type ManifestItem = {
  title: string;
  slug: string;
  category: string;
  postType: "blog_post" | "how_to";
  cluster: "import" | "problem";
};

const MANIFEST: ManifestItem[] = [
  {
    title: "How to Create a Website From a Facebook Page",
    slug: "create-website-from-facebook-page",
    category: "guides",
    postType: "how_to",
    cluster: "import",
  },
  {
    title: "How to Create a Website From a Yelp Listing",
    slug: "create-website-from-yelp-listing",
    category: "guides",
    postType: "how_to",
    cluster: "import",
  },
  {
    title: "How to Create a Website From a Thumbtack Profile",
    slug: "create-website-from-thumbtack-profile",
    category: "guides",
    postType: "how_to",
    cluster: "import",
  },
  {
    title: "How to Create a Website From a Google Business Profile",
    slug: "create-website-from-google-business-profile",
    category: "seo",
    postType: "how_to",
    cluster: "import",
  },
  {
    title: "How to Create a Website From an Existing Business Link",
    slug: "create-website-from-existing-business-link",
    category: "website-tips",
    postType: "how_to",
    cluster: "import",
  },
  {
    title: "Turn Your Facebook Business Page Into a Real Website",
    slug: "turn-facebook-page-into-website",
    category: "guides",
    postType: "how_to",
    cluster: "import",
  },
  {
    title: "Turn Your Yelp Page Into a Website You Actually Own",
    slug: "turn-yelp-page-into-website",
    category: "website-tips",
    postType: "how_to",
    cluster: "import",
  },
  {
    title: "Turn Your Thumbtack Profile Into a Website That Converts",
    slug: "turn-thumbtack-profile-into-website",
    category: "website-tips",
    postType: "how_to",
    cluster: "import",
  },
  {
    title: "Turn Your Google Business Profile Into a Full Website",
    slug: "turn-google-business-profile-into-website",
    category: "seo",
    postType: "how_to",
    cluster: "import",
  },
  {
    title: "Create a Small Business Website From a Link in Minutes",
    slug: "create-small-business-website-from-link",
    category: "website-tips",
    postType: "how_to",
    cluster: "import",
  },
  {
    title: "Why Your Plumber Website Is Not Getting Leads",
    slug: "why-plumber-website-not-getting-leads",
    category: "niches",
    postType: "blog_post",
    cluster: "problem",
  },
  {
    title: "Why Your Electrician Website Is Not Getting Leads",
    slug: "why-electrician-website-not-getting-leads",
    category: "niches",
    postType: "blog_post",
    cluster: "problem",
  },
  {
    title: "Why Your Cleaning Business Website Is Not Getting Leads",
    slug: "why-cleaning-business-website-not-getting-leads",
    category: "niches",
    postType: "blog_post",
    cluster: "problem",
  },
  {
    title: "Why Your Therapy Website Is Not Getting Inquiries",
    slug: "why-therapy-website-not-getting-inquiries",
    category: "niches",
    postType: "blog_post",
    cluster: "problem",
  },
  {
    title: "Why Your Handyman Website Is Not Getting Calls",
    slug: "why-handyman-website-not-getting-calls",
    category: "niches",
    postType: "blog_post",
    cluster: "problem",
  },
  {
    title: "How Plumbers Can Get More Local Leads From Their Website",
    slug: "how-plumbers-get-more-local-leads",
    category: "niches",
    postType: "how_to",
    cluster: "problem",
  },
  {
    title: "How Electricians Can Get More Local Leads From Their Website",
    slug: "how-electricians-get-more-local-leads",
    category: "niches",
    postType: "how_to",
    cluster: "problem",
  },
  {
    title: "How Cleaning Businesses Can Get More Local Leads Online",
    slug: "how-cleaners-get-more-local-leads",
    category: "niches",
    postType: "how_to",
    cluster: "problem",
  },
  {
    title: "How Therapists Can Get More Website Inquiries",
    slug: "how-therapists-get-more-website-inquiries",
    category: "niches",
    postType: "how_to",
    cluster: "problem",
  },
  {
    title: "How Handymen Can Show Up in Local Search",
    slug: "how-handymen-show-up-in-local-search",
    category: "seo",
    postType: "how_to",
    cluster: "problem",
  },
];

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

async function generateArticle(item: ManifestItem) {
  return generateObject({
    model: openai("gpt-5.4-mini"),
    schema: articleSchema,
    system: `Write a practical small-business article for Supportsheep.

Hard rules:
- Body must be valid HTML using h2, h3, p, ul, ol, li, strong, and a tags only.
- No markdown fences.
- Be direct, practical, and non-fluffy.
- Explain the problem clearly and connect the solution back to owning a real website, showing up in search, and converting visitors.
- Mention Supportsheep naturally as one option for building the website, not as a hard sell.
- Do not invent unsupported product claims like integrations or compliance guarantees.
- Keep the body around 900-1400 words.
- FAQs must be distinct and practical.
`,
    prompt: JSON.stringify({
      title: item.title,
      slug: item.slug,
      category: item.category,
      postType: item.postType,
      cluster: item.cluster,
      audience:
        item.cluster === "import"
          ? "small business owners trying to turn an existing profile or listing into a real website"
          : "service-business owners who need more local leads from their website",
    }),
  });
}

function buildSchedule(startDate: string, index: number) {
  const publishAt = new Date(startDate);
  publishAt.setUTCHours(15, 0, 0, 0);
  publishAt.setUTCDate(publishAt.getUTCDate() + Math.floor(index / 10));
  publishAt.setUTCMinutes((index % 10) * 12);
  return publishAt.toISOString();
}

function countWords(html: string) {
  const stripped = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return 0;
  return stripped.split(" ").filter(Boolean).length;
}

async function main() {
  initFirebase();
  const db = getFirestore();
  const startDate =
    process.env.START_DATE ??
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const manifest = LIMIT > 0 ? MANIFEST.slice(0, LIMIT) : MANIFEST;

  for (const item of manifest) {
    const existing = await db
      .collection("articles")
      .where("blogId", "==", blog_id)
      .where("slug", "==", item.slug)
      .limit(1)
      .get();
    if (!existing.empty) {
      throw new Error(`Slug already exists: ${item.slug}`);
    }
  }

  const generated = await mapWithConcurrency(
    manifest,
    CONCURRENCY,
    async (item, index) => {
      const { object } = await generateArticle(item);
      const faqHtml = buildFaqBlockHtml(object.faqs);
      const body = sanitizeArticleHtml(`${object.bodyHtml}\n${faqHtml}`);
      const scheduledAt = buildSchedule(startDate, index);
      const words = countWords(body);
      return {
        item,
        scheduledAt,
        payload: {
          blogId: blog_id,
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
          author: "Supportsheep",
          featuredImage: { url: "", alt: "" },
          ogImage: "",
          metaTitle: object.metaTitle,
          metaDescription: object.metaDescription,
          keywords: object.keywords,
          seoScore: 0,
          internalLinks: [],
          externalLinks: [],
          versions: [],
          generatedBy: "manual" as const,
          generationMeta: null,
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
            postType: article.item.postType,
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
          postType: article.item.postType,
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
