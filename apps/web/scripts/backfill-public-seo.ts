import "dotenv/config";

import { parseArgs } from "node:util";
import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import {
  DEFAULT_PUBLIC_SITE_DESCRIPTION,
  DEFAULT_PUBLIC_SITE_NAME,
  normalizePublicAuthor,
} from "@/lib/public-content";
import type { Article } from "@repo/types";

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: {
    "dry-run": {
      type: "boolean",
      default: false,
    },
  },
  strict: true,
});

type ArticleDoc = Article & { id: string };

function buildPrimarySignal(article: ArticleDoc): string {
  return [
    article.slug,
    article.title,
    article.excerpt,
    article.metaDescription,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ")
    .toLowerCase();
}

function buildTagSignal(article: ArticleDoc): string {
  return Array.isArray(article.tags) ? article.tags.join(" ").toLowerCase() : "";
}

function inferCategory(article: ArticleDoc): string {
  const primarySignal = buildPrimarySignal(article);
  const tagSignal = buildTagSignal(article);
  const combinedSignal = `${primarySignal} ${tagSignal}`.trim();
  const aiSignal = `${article.slug} ${article.title}`.toLowerCase();

  if (
    /\b(ai website|ai website builder|ai-powered|artificial intelligence|chatgpt|llm|generative ai|prompt engineering)\b/.test(
      aiSignal,
    ) ||
    article.slug.startsWith("ai-") ||
    article.slug.includes("-ai-")
  ) {
    return "AI";
  }

  if (
    /\b(real estate|realtor|plumber|photographer|lawyer|dentist|coach|coaching|therapist|restaurant|salon|barber|electrician|roofer|contractor|med spa|cleaning business|fitness trainer)\b/.test(
      combinedSignal,
    )
  ) {
    return "Niches";
  }

  if (
    /\b(website|websites|web site|domain|subdomain|landing page|portfolio|homepage|web design|online store|site builder|website builder)\b/.test(
      combinedSignal,
    )
  ) {
    return "Website Tips";
  }

  if (
    /\b(seo|google reviews?|search ranking|search engine|google business|backlinks?|lead generation|marketing|advertising|ads\b|social media|email marketing|local seo|google maps)\b/.test(
      combinedSignal,
    )
  ) {
    return "Marketing Tips";
  }

  if (
    /\b(business|small business|startup|pricing|bookings|customers|client acquisition|entrepreneur|launch|how to start)\b/.test(
      combinedSignal,
    )
  ) {
    return "Business Tips";
  }

  return "Guides";
}

async function main() {
  const dryRun = values["dry-run"];
  const articlesSnapshot = await collections
    .articles()
    .where("blogId", "==", "default")
    .where("status", "==", "published")
    .get();

  const articles = articlesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Article),
  }));

  const articleUpdates = articles
    .map((article) => {
      const updates: Record<string, unknown> = {};
      const normalizedAuthor = normalizePublicAuthor(article.author);

      if (normalizedAuthor !== article.author) {
        updates.author = normalizedAuthor;
      }

      if (!article.category || article.category === "Uncategorized") {
        const nextCategory = inferCategory(article);
        if (nextCategory !== article.category) {
          updates.category = nextCategory;
        }
      }

      return Object.keys(updates).length > 0
        ? {
            id: article.id,
            slug: article.slug,
            before: {
              author: article.author,
              category: article.category,
            },
            updates,
          }
        : null;
    })
    .filter(
      (
        update,
      ): update is {
        id: string;
        slug: string;
        before: { author: string; category: string };
        updates: Record<string, unknown>;
      } => Boolean(update),
    );

  const categoryCounts = articleUpdates.reduce<Record<string, number>>((acc, article) => {
    const category = typeof article.updates.category === "string"
      ? article.updates.category
      : article.before.category;
    acc[category] = (acc[category] ?? 0) + 1;
    return acc;
  }, {});

  const configRef = collections.blogConfig().doc("settings");
  const configDoc = await configRef.get();
  const existingSeo = (configDoc.data()?.seo ?? {}) as Record<string, unknown>;

  const configUpdate = {
    blogId: "default",
    siteName: DEFAULT_PUBLIC_SITE_NAME,
    siteDescription: DEFAULT_PUBLIC_SITE_DESCRIPTION,
    seo: {
      ...existingSeo,
      defaultMetaTitle: DEFAULT_PUBLIC_SITE_NAME,
      defaultMetaDescription: DEFAULT_PUBLIC_SITE_DESCRIPTION,
    },
    updatedAt: FieldValue.serverTimestamp(),
  };

  console.info(
    JSON.stringify(
      {
        dryRun,
        publishedArticleCount: articles.length,
        articleUpdateCount: articleUpdates.length,
        categoryCounts,
        sampleArticleUpdates: articleUpdates.slice(0, 20),
        configUpdatePreview: {
          siteName: DEFAULT_PUBLIC_SITE_NAME,
          siteDescription: DEFAULT_PUBLIC_SITE_DESCRIPTION,
          defaultMetaTitle: DEFAULT_PUBLIC_SITE_NAME,
          defaultMetaDescription: DEFAULT_PUBLIC_SITE_DESCRIPTION,
        },
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    return;
  }

  const db = collections.articles().firestore;
  const chunks: typeof articleUpdates[] = [];
  for (let index = 0; index < articleUpdates.length; index += 400) {
    chunks.push(articleUpdates.slice(index, index + 400));
  }

  for (const chunk of chunks) {
    const batch = db.batch();
    for (const article of chunk) {
      batch.update(collections.articles().doc(article.id), {
        ...article.updates,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }

  await configRef.set(configUpdate, { merge: true });
}

await main();
