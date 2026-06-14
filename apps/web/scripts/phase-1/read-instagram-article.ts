/**
 * Read the existing embed-instagram-feed-on-website article from Firestore.
 * Usage:
 *   cd apps/web
 *   bun --conditions react-server scripts/phase-1/read-instagram-article.ts
 */

import "dotenv/config";

import { collections } from "@/lib/db/firebase-admin";

const snapshot = await collections
  .articles()
  .where("slug", "==", "embed-instagram-feed-on-website")
  .limit(1)
  .get();

if (snapshot.empty) {
  console.info("Article not found: embed-instagram-feed-on-website");
  process.exit(0);
}

const doc = snapshot.docs[0];
const data = doc.data();

const body = typeof data.body === "string" ? data.body : "";
const draftBody = typeof data.draftBody === "string" ? data.draftBody : "";
const activeBody = draftBody || body;

// word count (strip HTML tags)
const stripped = activeBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const wordCount = stripped ? stripped.split(" ").filter(Boolean).length : 0;

console.info(
  JSON.stringify(
    {
      id: doc.id,
      slug: data.slug,
      title: data.title,
      status: data.status,
      postType: data.postType,
      category: data.category,
      tags: data.tags,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      keywords: data.keywords,
      featuredImage: data.featuredImage,
      author: data.author,
      computedWordCount: wordCount,
      storedWordCount: data.wordCount,
      readingTime: data.readingTime,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      bodyLength: body.length,
      draftBodyLength: draftBody.length,
      bodyPreview: body.slice(0, 1500),
    },
    null,
    2,
  ),
);

process.exit(0);
