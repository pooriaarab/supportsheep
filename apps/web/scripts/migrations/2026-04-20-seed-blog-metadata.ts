/**
 * Migration: seed real blog + category metadata.
 *
 * Replaces placeholder values the SEO audit surfaced on the public blog:
 *   - `blog_config/settings`: `siteName`, `siteDescription`, `defaultMetaTitle`,
 *     `defaultMetaDescription` (used by the homepage, `<title>`, RSS feed,
 *     llms.txt, and Open Graph `og:site_name`).
 *   - `categories/config`: the six "Imported from WordPress" descriptions
 *     plus an SEO-appropriate value for the `uncategorized` bucket.
 *
 * Safety:
 *   - Idempotent: re-running does not change already-seeded fields because
 *     we write the same canonical values every run. `updatedAt` is refreshed.
 *   - DRY_RUN=1 prints the planned writes and exits without touching Firestore.
 *
 * Usage:
 *   set -a; source apps/web/.env.local; set +a
 *   DRY_RUN=1 bun run apps/web/scripts/migrations/2026-04-20-seed-blog-metadata.ts
 *   bun run apps/web/scripts/migrations/2026-04-20-seed-blog-metadata.ts
 */

import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const DRY_RUN = process.env.DRY_RUN === "1";
const BLOG_ID = "default";

const SITE_NAME = "Supportsheep";
const DEFAULT_META_TITLE =
  "Supportsheep — website & SEO guides for supportsheeppreneurs";
const DEFAULT_META_DESCRIPTION =
  "Practical guides on building and ranking a small business website with Supportsheep's AI-powered tools.";
const SITE_DESCRIPTION = DEFAULT_META_DESCRIPTION;

const BLOG_CONFIG_FIELDS: Record<string, unknown> = {
  blogId: BLOG_ID,
  siteName: SITE_NAME,
  siteDescription: SITE_DESCRIPTION,
  seo: {
    defaultMetaTitle: DEFAULT_META_TITLE,
    defaultMetaDescription: DEFAULT_META_DESCRIPTION,
  },
};

interface CategoryUpdate {
  slug: string;
  displayName: string;
  description: string;
}

// Short, SEO-focused descriptions (140-160 chars) for each category surface.
// Kept as the source of truth so re-runs remain idempotent.
const CATEGORY_UPDATES: CategoryUpdate[] = [
  {
    slug: "uncategorized",
    displayName: "Uncategorized",
    description:
      "General articles from the Supportsheep team on building, launching, and growing a small business website with our AI-powered tools.",
  },
  {
    slug: "guides",
    displayName: "Guides",
    description:
      "Step-by-step playbooks for launching your small business online: domains, design, copy, SEO, and everything in between, written for supportsheeppreneurs.",
  },
  {
    slug: "ai",
    displayName: "AI",
    description:
      "How supportsheeppreneurs use AI to design websites, write content, and run marketing. Practical tutorials and honest reviews of tools that actually help.",
  },
  {
    slug: "website-tips",
    displayName: "Website Tips",
    description:
      "Design, UX, and performance tips to make your small business website faster, clearer, and higher-converting without hiring a developer or agency.",
  },
  {
    slug: "niches",
    displayName: "Niches",
    description:
      "Niche-specific website and SEO guides for tradespeople, creators, coaches, restaurants, and local services using Supportsheep's free AI website builder.",
  },
  {
    slug: "marketing-tips",
    displayName: "Marketing Tips",
    description:
      "Low-budget marketing tactics for supportsheeppreneurs: SEO, email, local listings, and social posts that drive real traffic to a small business website.",
  },
  {
    slug: "business-tips",
    displayName: "Business Tips",
    description:
      "Running a one-person business: pricing, operations, invoicing, and online presence advice for supportsheeppreneurs building their first brand with Supportsheep.",
  },
];

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
      privateKey: assertEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
}

async function main(): Promise<void> {
  initFirebase();
  const db = getFirestore();

  console.info(
    `== seed-blog-metadata ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ==`,
  );
  console.info(`project=${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

  const configRef = db.collection("blog_config").doc("settings");
  const categoriesRef = db.collection("categories").doc("config");

  const [configSnap, categoriesSnap] = await Promise.all([
    configRef.get(),
    categoriesRef.get(),
  ]);

  const currentConfig = (configSnap.data() ?? {}) as Record<string, unknown>;
  const currentCategories = (categoriesSnap.data() ?? {}) as {
    order?: Record<string, { description?: string; displayName?: string }>;
  };
  const currentOrder = currentCategories.order ?? {};

  const configDelta: Record<string, { before: unknown; after: unknown }> = {};
  if (currentConfig.siteName !== SITE_NAME) {
    configDelta.siteName = { before: currentConfig.siteName, after: SITE_NAME };
  }
  if (currentConfig.siteDescription !== SITE_DESCRIPTION) {
    configDelta.siteDescription = {
      before: currentConfig.siteDescription,
      after: SITE_DESCRIPTION,
    };
  }
  const currentSeo = (currentConfig.seo ?? {}) as Record<string, unknown>;
  if (currentSeo.defaultMetaTitle !== DEFAULT_META_TITLE) {
    configDelta["seo.defaultMetaTitle"] = {
      before: currentSeo.defaultMetaTitle,
      after: DEFAULT_META_TITLE,
    };
  }
  if (currentSeo.defaultMetaDescription !== DEFAULT_META_DESCRIPTION) {
    configDelta["seo.defaultMetaDescription"] = {
      before: currentSeo.defaultMetaDescription,
      after: DEFAULT_META_DESCRIPTION,
    };
  }

  const categoryDeltas: Array<{
    slug: string;
    beforeDescription: string | undefined;
    afterDescription: string;
  }> = [];

  for (const update of CATEGORY_UPDATES) {
    const current = currentOrder[update.slug];
    if (!current) {
      console.warn(
        `  ! category "${update.slug}" missing in categories/config -- will skip`,
      );
      continue;
    }
    if (current.description !== update.description) {
      categoryDeltas.push({
        slug: update.slug,
        beforeDescription: current.description,
        afterDescription: update.description,
      });
    }
  }

  console.info(
    `\n-- blog_config/settings pending changes (${Object.keys(configDelta).length}) --`,
  );
  for (const [field, change] of Object.entries(configDelta)) {
    console.info(`  ${field}:`);
    console.info(`    before: ${JSON.stringify(change.before)}`);
    console.info(`    after:  ${JSON.stringify(change.after)}`);
  }

  console.info(
    `\n-- categories/config pending changes (${categoryDeltas.length}) --`,
  );
  for (const delta of categoryDeltas) {
    console.info(`  ${delta.slug}:`);
    console.info(`    before: ${JSON.stringify(delta.beforeDescription)}`);
    console.info(`    after:  ${JSON.stringify(delta.afterDescription)}`);
  }

  if (DRY_RUN) {
    console.info("\n(dry run) no writes issued");
    return;
  }

  // blog_config/settings: merge canonical fields so the doc is fully seeded
  // even if this is the first run. `updatedAt` is always refreshed.
  await configRef.set(
    {
      ...BLOG_CONFIG_FIELDS,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  // categories/config: merge nested description updates per slug.
  const categoryMerge: {
    order: Record<string, { description: string; displayName: string }>;
    updatedAt: FirebaseFirestore.FieldValue;
    blogId: string;
  } = {
    order: {},
    updatedAt: FieldValue.serverTimestamp(),
    blogId: BLOG_ID,
  };
  for (const update of CATEGORY_UPDATES) {
    if (!currentOrder[update.slug]) continue;
    categoryMerge.order[update.slug] = {
      description: update.description,
      displayName: update.displayName,
    };
  }
  await categoriesRef.set(categoryMerge, { merge: true });

  console.info(
    `\n== done. blog_config fields written=${Object.keys(BLOG_CONFIG_FIELDS).length} category descriptions written=${Object.keys(categoryMerge.order).length} ==`,
  );
}

main().catch((err) => {
  console.error("migration failed:", err);
  process.exit(1);
});
