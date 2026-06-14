/**
 * Migration: seed a single programmatic demo landing page.
 *
 * Writes `programmatic_pages/plumbers` if it does not already exist.
 * Idempotent: re-running the script is a no-op once the demo doc is
 * present. Re-seeding after deletion is fine.
 *
 * Usage:
 *   set -a; source apps/web/.env.local; set +a
 *   bun run apps/web/scripts/migrations/2026-04-20-seed-programmatic-demo.ts
 */

import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const DOC_ID = "plumbers";
const VARIANT_KEY = "plumbers";
const COLLECTION = "programmatic_pages";

const DEMO_CONTENT = `# Built for plumbers who actually want to grow online

Running a plumbing business means juggling emergency calls, quoting jobs, and somehow still showing up first on Google when a homeowner searches "plumber near me" at 2am on a Sunday. Most plumbers don't have time to hand-write blog posts between draining water heaters and snaking sewer lines. BlogBat is built to close that gap without turning you into a part-time content marketer.

## The SEO problem every plumbing business runs into

Local service searches are won with consistent, keyword-rich content that answers the exact questions your customers type. Things like "how much does it cost to replace a sump pump", "why is my water pressure low all of a sudden", or "when do I need to repipe a 1970s house". Google rewards sites that cover these topics in depth. Directory listings alone won't cut it, and neither will a single "About Us" page.

The problem is that writing 80 or 100 service-area articles by hand is a full-time job. Outsourcing to generic content mills gives you thin, duplicated copy that gets penalized, not rewarded. BlogBat fills that middle ground: you describe your service area, pricing range, and specialties once, and the platform generates structured, locally relevant articles on demand.

## How BlogBat fits a plumbing workflow

- **Service-page scaffolding.** Generate dedicated landing pages for drain cleaning, water heater repair, trenchless sewer work, leak detection, or any niche you want to rank for.
- **Local intent pages.** Spin up city-by-city variants ("emergency plumber in Austin", "licensed plumber in Round Rock") without copy-pasting. The generator handles the variables; the thin-content guard refuses to publish pages that don't meet a minimum depth.
- **Structured data out of the box.** Every page emits WebPage, BreadcrumbList, and optional FAQPage JSON-LD so rich results are one indexing cycle away.
- **Plain English SEO feedback.** The built-in SEO sidebar flags thin headlines, missing alt text, weak internal links, and title-length issues before you hit publish.

## What a typical plumbing content plan looks like

Most of our plumbing customers start with three buckets:

1. **Emergency intent.** Short, high-converting pages for "after hours", "24/7", "burst pipe", "no hot water". These tend to be 400-600 words with a booking CTA front and center.
2. **Informational long-form.** Deeper guides like "how to tell if your water heater is about to fail" or "signs you need a sewer camera inspection". These feed middle-of-funnel traffic and support internal linking.
3. **Location pages.** One per service area, with a consistent structure: intro, services covered, common local issues, pricing guidance, FAQs, map embed.

BlogBat's generator is set up so you can run all three lanes in parallel. Schedule a batch on Monday and walk into the shop with fifteen new drafts on Tuesday morning, ready for a quick human pass.

## Keeping it honest

A quick word on something most "AI SEO" tools refuse to address: thin content hurts you more than it helps. BlogBat's programmatic landing-page framework enforces a minimum unique word count per page and automatically marks anything below the threshold as noindex. You get the upside of programmatic SEO without carpet-bombing your domain with junk that Google will eventually downrank.

## Ready to try it

Spin up a free workspace, import your existing site, and generate your first five plumbing landing pages in under an hour.
`;

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

function countWords(text: string): number {
  const stripped = text
    .replace(/<[^>]*>/g, " ")
    .replace(/[#*_`~>\[\]()!|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return 0;
  return stripped.split(" ").filter(Boolean).length;
}

async function main(): Promise<void> {
  initFirebase();
  const db = getFirestore();

  const ref = db.collection(COLLECTION).doc(DOC_ID);
  const existing = await ref.get();

  if (existing.exists) {
    console.info(`[seed] ${COLLECTION}/${DOC_ID} already exists -- skipping`);
    console.info(`[seed] created=0 skipped=1`);
    return;
  }

  const wordCount = countWords(DEMO_CONTENT);
  if (wordCount < 400) {
    throw new Error(
      `[seed] demo content is ${wordCount} words -- below the 400-word thin-content threshold`,
    );
  }

  const now = Timestamp.now();

  await ref.set({
    collection: "for",
    variantKey: VARIANT_KEY,
    variables: {
      subhead:
        "Generate local, service-specific landing pages that actually rank -- without carpet-bombing your site with thin content.",
      ctaText: "Start your plumbing blog",
      ctaHref: "https://blogbat.com",
    },
    title: "BlogBat for plumbers",
    metaDescription:
      "BlogBat helps plumbing businesses rank for local service searches with structured, SEO-aware landing pages and guardrails against thin content.",
    uniqueContent: DEMO_CONTENT,
    wordCount,
    faqs: [
      {
        question: "Do I need technical SEO knowledge to use BlogBat?",
        answer:
          "No. BlogBat surfaces SEO feedback in plain English and ships structured data automatically. If you can write a paragraph about a service, you can publish a page that ranks.",
      },
      {
        question: "How does BlogBat avoid thin-content penalties?",
        answer:
          "Every programmatic landing page is checked against a minimum word count and unique-content threshold. Pages that don't clear the bar are published as noindex or kept as drafts.",
      },
      {
        question: "Can I use BlogBat for multiple service areas?",
        answer:
          "Yes. Location-specific variants are the most common use case -- you describe your service area and pricing once, and BlogBat generates per-city pages on demand.",
      },
    ],
    publishStatus: "published",
    createdAt: now,
    updatedAt: now,
  });

  console.info(
    `[seed] wrote ${COLLECTION}/${DOC_ID} (words=${wordCount}, status=published)`,
  );
  console.info(`[seed] created=1 skipped=0`);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
