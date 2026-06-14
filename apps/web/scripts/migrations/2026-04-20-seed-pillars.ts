/**
 * Migration: seed 5 pillar pages into the `pillars` Firestore collection.
 *
 * Each pillar has a slug (URL), title, summary, heroEyebrow, and a list of
 * clusters. Each cluster has a title, description, and a list of article
 * slugs drawn from the live `articles` collection. Cluster composition is
 * computed dynamically from article `primaryCategory` + `categories[]` +
 * keyword matches in the title, so this script is safe to re-run after new
 * articles land.
 *
 * Usage:
 *   DRY_RUN=1 bun run scripts/migrations/2026-04-20-seed-pillars.ts
 *   bun run scripts/migrations/2026-04-20-seed-pillars.ts
 */

import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

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
const MAX_PER_CLUSTER = 6;

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

interface ArticleRecord {
  slug: string;
  title: string;
  primaryCategory?: string;
  categories?: string[];
  legacyCategory?: string;
  publishedAt?: string | null;
}

interface ClusterSpec {
  title: string;
  description: string;
  /**
   * Return true if the article belongs in this cluster. Applied in order;
   * each article lands in the first cluster it matches, to avoid duplicates
   * on the page.
   */
  match: (article: ArticleRecord) => boolean;
}

interface PillarSpec {
  slug: string;
  title: string;
  heroEyebrow: string;
  summary: string;
  order: number;
  clusters: ClusterSpec[];
}

function hasCat(article: ArticleRecord, slug: string): boolean {
  if (article.primaryCategory === slug) return true;
  if (article.categories?.includes(slug)) return true;
  return false;
}

function titleMatches(
  article: ArticleRecord,
  keywords: readonly string[],
): boolean {
  const t = article.title.toLowerCase();
  return keywords.some((k) => t.includes(k));
}

const PILLARS: PillarSpec[] = [
  {
    slug: "small-business-website-guide",
    title: "The Small Business Website Guide",
    heroEyebrow: "Pillar",
    summary:
      "Everything you need to plan, launch, and grow a website that actually brings in customers -- from first decisions to ongoing marketing.",
    order: 1,
    clusters: [
      {
        title: "Getting started",
        description: "Foundational guides and checklists for new websites.",
        match: (a) =>
          hasCat(a, "guides") ||
          titleMatches(a, [
            "start a",
            "how to build",
            "how to create",
            "how to launch",
            "first website",
            "beginner",
          ]),
      },
      {
        title: "Design and content",
        description:
          "Pages, copy, layouts, and visuals that convert visitors into customers.",
        match: (a) =>
          hasCat(a, "website-tips") &&
          !titleMatches(a, ["seo", "google", "search", "rank"]),
      },
      {
        title: "Marketing and growth",
        description:
          "Drive traffic, capture leads, and keep growing after launch.",
        match: (a) => hasCat(a, "marketing-tips"),
      },
      {
        title: "Running the business",
        description: "Pricing, operations, finance, and side hustles.",
        match: (a) => hasCat(a, "business-tips"),
      },
    ],
  },
  {
    slug: "ai-website-builders",
    title: "AI Website Builders, Explained",
    heroEyebrow: "Pillar",
    summary:
      "Reviews, comparisons, and hands-on guides for AI-powered website builders -- which one fits your business, workflow, and budget.",
    order: 2,
    clusters: [
      {
        title: "Platform comparisons",
        description: "Head-to-head comparisons across the top builders.",
        match: (a) =>
          hasCat(a, "web-builders") &&
          titleMatches(a, [
            " vs ",
            "compare",
            "alternative",
            "better than",
          ]),
      },
      {
        title: "Builder deep dives",
        description:
          "Hands-on reviews and walkthroughs of individual platforms.",
        match: (a) => hasCat(a, "web-builders"),
      },
      {
        title: "AI tools and prompts",
        description:
          "Using AI assistants, prompts, and agents to build sites faster.",
        match: (a) => hasCat(a, "ai"),
      },
      {
        title: "When to use a builder",
        description:
          "Choosing a builder (vs custom code, vs freelancer) for your situation.",
        match: (a) =>
          titleMatches(a, [
            "best website",
            "cheapest",
            "free website",
            "platform",
          ]),
      },
    ],
  },
  {
    slug: "seo-for-service-businesses",
    title: "SEO for Service Businesses",
    heroEyebrow: "Pillar",
    summary:
      "Rank locally, capture buyers searching for the work you do, and turn SEO into a repeatable growth channel -- no agency required.",
    order: 3,
    clusters: [
      {
        title: "SEO fundamentals",
        description: "Core concepts: keywords, on-page, technical basics.",
        match: (a) => hasCat(a, "seo"),
      },
      {
        title: "Local and Google Business Profile",
        description:
          "Showing up in Google Maps, reviews, and local 3-pack results.",
        match: (a) =>
          titleMatches(a, [
            "google business",
            "google review",
            "local seo",
            "local rank",
            "maps",
          ]),
      },
      {
        title: "Content that ranks",
        description:
          "Content strategy, keyword research, and writing for search intent.",
        match: (a) =>
          hasCat(a, "marketing-tips") &&
          titleMatches(a, [
            "content",
            "blog",
            "keyword",
            "rank",
            "traffic",
          ]),
      },
    ],
  },
  {
    slug: "industry-website-playbooks",
    title: "Industry Website Playbooks",
    heroEyebrow: "Pillar",
    summary:
      "Niche-by-niche playbooks showing what a high-converting website looks like for plumbers, therapists, consultants, creators, and more.",
    order: 4,
    clusters: [
      {
        title: "Trades and home services",
        description:
          "Plumbers, electricians, cleaners, contractors, landscapers.",
        match: (a) =>
          hasCat(a, "niches") &&
          titleMatches(a, [
            "plumb",
            "electric",
            "clean",
            "contractor",
            "landscap",
            "handy",
            "hvac",
            "roof",
          ]),
      },
      {
        title: "Health and wellness",
        description: "Therapists, coaches, trainers, yoga, nutrition.",
        match: (a) =>
          hasCat(a, "niches") &&
          titleMatches(a, [
            "therap",
            "coach",
            "train",
            "yoga",
            "fitness",
            "nutri",
            "wellness",
          ]),
      },
      {
        title: "Creative and professional services",
        description:
          "Photographers, designers, consultants, writers, agencies.",
        match: (a) =>
          hasCat(a, "niches") &&
          titleMatches(a, [
            "photograph",
            "design",
            "consult",
            "writer",
            "agency",
            "freelanc",
          ]),
      },
      {
        title: "Other niches",
        description: "Everything else with a specific industry angle.",
        match: (a) => hasCat(a, "niches"),
      },
    ],
  },
  {
    slug: "domain-and-hosting-troubleshooting",
    title: "Domain and Hosting Troubleshooting",
    heroEyebrow: "Pillar",
    summary:
      "Fix errors fast: broken domains, DNS issues, lost accounts, bad redirects, and every other thing that can break a live site.",
    order: 5,
    clusters: [
      {
        title: "Domains and DNS",
        description:
          "Buying, connecting, transferring, and renewing domain names.",
        match: (a) =>
          titleMatches(a, [
            "domain",
            "dns",
            "subdomain",
            "nameserver",
            "cname",
          ]),
      },
      {
        title: "Hosting and site errors",
        description:
          "Walk-throughs for the most common hosting, deploy, and browser errors.",
        match: (a) =>
          hasCat(a, "troubleshooting") ||
          titleMatches(a, [
            "error",
            "fix",
            "not working",
            "can't",
            "cannot",
            "broken",
            "502",
            "404",
            "500",
          ]),
      },
      {
        title: "Email and deliverability",
        description:
          "Custom email on your domain, SPF/DKIM/DMARC, and inbox issues.",
        match: (a) =>
          titleMatches(a, ["email", "inbox", "spam", "deliverability"]),
      },
    ],
  },
];

async function main(): Promise<void> {
  initFirebase();
  const db = getFirestore();

  console.info(`== seed pillars ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ==`);

  const snap = await db
    .collection("articles")
    .where("blogId", "==", BLOG_ID)
    .where("status", "==", "published")
    .get();

  const articles: ArticleRecord[] = snap.docs
    .map((doc) => {
      const d = doc.data() as Record<string, unknown>;
      return {
        slug: (d.slug as string) ?? "",
        title: (d.title as string) ?? "",
        primaryCategory: d.primaryCategory as string | undefined,
        categories: d.categories as string[] | undefined,
        legacyCategory: d.category as string | undefined,
        publishedAt: (d.publishedAt as string | null | undefined) ?? null,
      };
    })
    .filter((a) => a.slug);

  console.info(`fetched ${articles.length} published articles`);

  for (const pillar of PILLARS) {
    const assigned = new Set<string>();
    const filledClusters = pillar.clusters.map((cluster) => {
      const matching = articles
        .filter(
          (a) => !assigned.has(a.slug) && cluster.match(a),
        )
        .sort((a, b) => {
          const at = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
          const bt = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
          return bt - at;
        })
        .slice(0, MAX_PER_CLUSTER);
      for (const m of matching) assigned.add(m.slug);
      return {
        title: cluster.title,
        description: cluster.description,
        articleSlugs: matching.map((m) => m.slug),
      };
    });

    const totalArticles = filledClusters.reduce(
      (sum, c) => sum + c.articleSlugs.length,
      0,
    );
    console.info(
      `pillar "${pillar.slug}": ${filledClusters.length} clusters, ${totalArticles} articles total`,
    );
    for (const c of filledClusters) {
      console.info(`  - ${c.title}: ${c.articleSlugs.length} articles`);
    }

    if (DRY_RUN) continue;

    await db
      .collection("pillars")
      .doc(pillar.slug)
      .set(
        {
          slug: pillar.slug,
          title: pillar.title,
          heroEyebrow: pillar.heroEyebrow,
          summary: pillar.summary,
          order: pillar.order,
          clusters: filledClusters,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: false },
      );
  }

  console.info(
    `\n== done. ${DRY_RUN ? "no writes performed" : `wrote ${PILLARS.length} pillars`} ==`,
  );
}

main().catch((err) => {
  console.error("seed failed:", err);
  process.exit(1);
});
