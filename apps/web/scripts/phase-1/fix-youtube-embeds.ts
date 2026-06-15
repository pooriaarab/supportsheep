/**
 * Phase 1 quality pass: verify and replace broken YouTube embeds in
 * programmatic_pages documents.
 *
 * Checks all docs in the `for` and `alternatives_for_vertical` collections.
 * For each doc that contains a YouTube embed, it verifies the video is still
 * available via the YouTube oEmbed endpoint. If unavailable, it searches for
 * a replacement using YouTube's oEmbed endpoint to validate candidate IDs, and
 * writes the replacement back to Firestore.
 *
 * Usage (from apps/web):
 *   bun --conditions react-server scripts/phase-1/fix-youtube-embeds.ts --dry-run
 *   bun --conditions react-server scripts/phase-1/fix-youtube-embeds.ts
 *
 * Env vars required (from .env.local):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

import "dotenv/config";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const DRY_RUN = process.argv.includes("--dry-run");
const COLLECTIONS = ["for", "alternatives_for_vertical"] as const;

// Curated replacement video IDs per vertical, verified available via oEmbed
// as of 2026-04-21. Each array is tried in order; first available video wins.
//
// Generic fallbacks are used for any vertical not in this map. All IDs were
// verified: curl "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<ID>&format=json"
const CURATED_REPLACEMENTS: Record<string, string[]> = {
  // Vertical-specific replacements
  lawyers: ["i2toEZE4AKA", "h5Sp3kuLuF4", "UAvY7B--c0A", "6mFppPtl0y0"],
  "immigration-lawyers": ["i2toEZE4AKA", "h5Sp3kuLuF4", "UAvY7B--c0A"],
  "personal-injury-lawyers": ["i2toEZE4AKA", "h5Sp3kuLuF4", "6mFppPtl0y0"],
  "estate-planning-attorneys": ["i2toEZE4AKA", "GEJAfXhDfBY", "h5Sp3kuLuF4"],
  "family-lawyers": ["i2toEZE4AKA", "UAvY7B--c0A", "6mFppPtl0y0"],
  photographers: ["uvX8QSLSBqE", "3egQBpzYt3o", "FCLc6AmJ5dA"],
  "photographers-real-estate": ["uvX8QSLSBqE", "866s3rfzigU", "3egQBpzYt3o"],
  videographers: ["866s3rfzigU", "uvX8QSLSBqE", "FCLc6AmJ5dA"],
  therapists: ["X9Z8IhrQPpQ", "v6WKxDwP5rw", "7-Jq0jPMj54"],
  "occupational-therapists": ["X9Z8IhrQPpQ", "v6WKxDwP5rw", "7-Jq0jPMj54"],
  "speech-therapists": ["X9Z8IhrQPpQ", "v6WKxDwP5rw", "7-Jq0jPMj54"],
  "massage-therapists": ["X9Z8IhrQPpQ", "vpxNAi06UFs", "FMab5WTOiL4"],
  "physical-therapists": ["X9Z8IhrQPpQ", "v6WKxDwP5rw", "vpxNAi06UFs"],
  plumbers: ["oWwHvlFiY4o", "XoHGsd2GRYM", "vpxNAi06UFs"],
  "hvac-technicians": ["oWwHvlFiY4o", "vpxNAi06UFs", "FMab5WTOiL4"],
  electricians: ["oWwHvlFiY4o", "vpxNAi06UFs", "FMab5WTOiL4"],
  handymen: ["oWwHvlFiY4o", "XoHGsd2GRYM", "vpxNAi06UFs"],
  roofers: ["oWwHvlFiY4o", "vpxNAi06UFs", "FMab5WTOiL4"],
  painters: ["oWwHvlFiY4o", "vpxNAi06UFs", "FMab5WTOiL4"],
  designers: ["FCLc6AmJ5dA", "gAZmBqngc1M", "uvX8QSLSBqE"],
  "graphic-designers": ["FCLc6AmJ5dA", "gAZmBqngc1M", "7iX-HKlQ-HY"],
  illustrators: ["7iX-HKlQ-HY", "FCLc6AmJ5dA", "gAZmBqngc1M"],
};

// Generic fallback videos verified available 2026-04-21:
// - IqCQ35e1beU: "The Best FREE Website Builder Right Now (Works In 2026)"
// - omTBa58uVNk: "Use These Small Business Website Builders for 2026 Success (No Code)"
// - vpxNAi06UFs: "How to Build a Small Business Website | From Zero to Launch"
// - kMH2BHQUDz4: "Best Website Builders for Small Business 2025 Edition"
// - FMab5WTOiL4: "How To Create a Website For Your Local Business In 2025"
// - llRNY6E_H00: "Build a Website in 24 Hours with me for my solopreneur Community"
// - R4v_7hh4Yys: "How to Create a Website – WordPress Tutorial for Beginners 2025"
const GENERIC_FALLBACKS = [
  "IqCQ35e1beU",
  "omTBa58uVNk",
  "vpxNAi06UFs",
  "kMH2BHQUDz4",
  "FMab5WTOiL4",
  "llRNY6E_H00",
  "R4v_7hh4Yys",
];

interface PageDoc {
  id: string;
  collection: string;
  uniqueContent: string;
  variantKey?: string;
  title?: string;
}

interface EmbedReport {
  slug: string;
  collection: string;
  oldVideoId: string;
  newVideoId: string | null;
  newVideoTitle: string | null;
  action: "ok" | "replaced" | "no_replacement" | "error" | "dry_run";
  error?: string;
}

function assertEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function initFirebase() {
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

function extractVideoIds(content: string): string[] {
  const pattern =
    /https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]+)/g;
  const seen = new Map<string, true>();
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(content)) !== null) {
    const id = m[1]!;
    if (!seen.has(id)) {
      seen.set(id, true);
      ids.push(id);
    }
  }
  return ids;
}

interface OembedResult {
  available: boolean;
  title?: string;
}

async function checkVideoAvailability(videoId: string): Promise<OembedResult> {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "supportsheep-quality-bot/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { available: false };
    const text = await res.text();
    // oEmbed returns a JSON object; an unavailable video returns 401/404 (caught
    // above) or occasionally a JSON error body.
    try {
      const json = JSON.parse(text) as { title?: string; error?: string };
      if (json.error) return { available: false };
      return { available: true, title: json.title };
    } catch {
      return { available: false };
    }
  } catch {
    return { available: false };
  }
}

function deriveVertical(doc: PageDoc): string {
  // For "for" collection, id is the vertical (e.g., "dentists").
  // For "alternatives_for_vertical", variantKey is "competitor__vertical".
  if (doc.collection === "for") return doc.id;
  const parts = (doc.variantKey ?? doc.id).split("__");
  return parts[parts.length - 1] ?? doc.id;
}

async function findReplacementVideo(
  vertical: string,
): Promise<{ videoId: string; title: string } | null> {
  // Try vertical-specific curated list first, then fall back to generic videos.
  const candidates = [
    ...(CURATED_REPLACEMENTS[vertical] ?? []),
    ...GENERIC_FALLBACKS,
  ];

  // Deduplicate while preserving order.
  const seen = new Map<string, true>();
  const deduped: string[] = [];
  for (const id of candidates) {
    if (!seen.has(id)) {
      seen.set(id, true);
      deduped.push(id);
    }
  }

  for (const candidateId of deduped) {
    const result = await checkVideoAvailability(candidateId);
    if (result.available && result.title) {
      return { videoId: candidateId, title: result.title };
    }
    // Small delay to avoid hammering the oEmbed endpoint.
    await new Promise((r) => setTimeout(r, 300));
  }

  return null;
}

async function processDoc(
  doc: PageDoc,
): Promise<{ report: EmbedReport; newContent: string | null }> {
  const videoIds = extractVideoIds(doc.uniqueContent);

  if (videoIds.length === 0) {
    // No embed found — nothing to do.
    return {
      report: {
        slug: doc.id,
        collection: doc.collection,
        oldVideoId: "(none)",
        newVideoId: null,
        newVideoTitle: null,
        action: "ok",
      },
      newContent: null,
    };
  }

  // Check the first (usually only) video ID.
  const videoId = videoIds[0]!;
  const check = await checkVideoAvailability(videoId);

  if (check.available) {
    return {
      report: {
        slug: doc.id,
        collection: doc.collection,
        oldVideoId: videoId,
        newVideoId: videoId,
        newVideoTitle: check.title ?? null,
        action: "ok",
      },
      newContent: null,
    };
  }

  console.info(`  [broken] ${doc.id}  videoId=${videoId}  → searching replacement…`);

  const vertical = deriveVertical(doc);
  const replacement = await findReplacementVideo(vertical);

  if (!replacement) {
    return {
      report: {
        slug: doc.id,
        collection: doc.collection,
        oldVideoId: videoId,
        newVideoId: null,
        newVideoTitle: null,
        action: "no_replacement",
      },
      newContent: null,
    };
  }

  // Replace all occurrences of the old video ID in the content.
  const newContent = doc.uniqueContent.replace(
    new RegExp(
      `(https?://(?:www\\.)?youtube(?:-nocookie)?\\.com/embed/)${videoId}`,
      "g",
    ),
    `https://www.youtube-nocookie.com/embed/${replacement.videoId}`,
  );

  return {
    report: {
      slug: doc.id,
      collection: doc.collection,
      oldVideoId: videoId,
      newVideoId: replacement.videoId,
      newVideoTitle: replacement.title,
      action: DRY_RUN ? "dry_run" : "replaced",
    },
    newContent: DRY_RUN ? null : newContent,
  };
}

function printReport(reports: EmbedReport[]) {
  const broken = reports.filter((r) => r.action !== "ok");
  const replaced = reports.filter((r) => r.action === "replaced" || r.action === "dry_run");
  const missing = reports.filter((r) => r.action === "no_replacement");
  const errors = reports.filter((r) => r.action === "error");

  console.info("\n─────────────────────────────────────────");
  console.info(`YouTube embed audit  (${DRY_RUN ? "DRY RUN" : "LIVE"})`);
  console.info(`─────────────────────────────────────────`);
  console.info(`Total docs checked   : ${reports.length}`);
  console.info(`Videos OK            : ${reports.filter((r) => r.action === "ok").length}`);
  console.info(`Broken found         : ${broken.length}`);
  console.info(`Replaced             : ${replaced.length}`);
  console.info(`No replacement found : ${missing.length}`);
  console.info(`Errors               : ${errors.length}`);

  if (broken.length > 0) {
    console.info("\nBroken / replaced videos:");
    console.info(
      "slug".padEnd(40) +
        "old ID".padEnd(15) +
        "new ID".padEnd(15) +
        "new title",
    );
    console.info("─".repeat(100));
    for (const r of broken) {
      const newId = r.newVideoId ?? "(none)";
      const title = r.newVideoTitle ?? r.action;
      console.info(
        r.slug.padEnd(40) +
          r.oldVideoId.padEnd(15) +
          newId.padEnd(15) +
          title,
      );
    }
  }

  if (missing.length > 0) {
    console.info("\nDocs with no replacement found:");
    for (const r of missing) console.info(`  ${r.slug}  (old: ${r.oldVideoId})`);
  }

  if (errors.length > 0) {
    console.info("\nErrors:");
    for (const r of errors) console.info(`  ${r.slug}: ${r.error}`);
  }
}

async function main() {
  console.info(`fix-youtube-embeds  [${DRY_RUN ? "DRY RUN" : "LIVE"}]`);
  console.info(`Collections: ${COLLECTIONS.join(", ")}`);

  initFirebase();
  const db = getFirestore();
  const coll = db.collection("programmatic_pages");

  const docs: PageDoc[] = [];
  for (const col of COLLECTIONS) {
    const snap = await coll
      .where("collection", "==", col)
      .get();
    for (const d of snap.docs) {
      const data = d.data();
      // Only process docs that have uniqueContent with a YouTube embed.
      if (
        typeof data.uniqueContent === "string" &&
        /youtube(?:-nocookie)?\.com\/embed\//.test(data.uniqueContent)
      ) {
        docs.push({
          id: d.id,
          collection: data.collection as string,
          uniqueContent: data.uniqueContent as string,
          variantKey: data.variantKey as string | undefined,
          title: data.title as string | undefined,
        });
      }
    }
  }

  console.info(`Found ${docs.length} docs with YouTube embeds to check.`);

  const reports: EmbedReport[] = [];
  let batch = db.batch();
  let writeCount = 0;
  let pendingInBatch = 0;

  for (const doc of docs) {
    process.stdout.write(`  checking ${doc.id} … `);
    let result: { report: EmbedReport; newContent: string | null };
    try {
      result = await processDoc(doc);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.info(`ERROR: ${msg}`);
      reports.push({
        slug: doc.id,
        collection: doc.collection,
        oldVideoId: "(unknown)",
        newVideoId: null,
        newVideoTitle: null,
        action: "error",
        error: msg,
      });
      continue;
    }

    console.info(result.report.action);
    reports.push(result.report);

    if (result.newContent && !DRY_RUN) {
      const ref = coll.doc(doc.id);
      batch.set(
        ref,
        {
          uniqueContent: result.newContent,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      writeCount++;
      pendingInBatch++;

      // Commit in batches of 400 to stay under Firestore's 500-op limit.
      if (pendingInBatch >= 400) {
        await batch.commit();
        console.info(`  [batch committed ${writeCount} writes so far]`);
        batch = db.batch();
        pendingInBatch = 0;
      }
    }

    // Small pause between oEmbed calls to avoid rate limits.
    await new Promise((r) => setTimeout(r, 200));
  }

  if (pendingInBatch > 0 && !DRY_RUN) {
    await batch.commit();
    console.info(`  [final batch committed, total writes: ${writeCount}]`);
  }

  printReport(reports);

  if (DRY_RUN) {
    console.info(
      "\nDRY RUN complete — no Firestore writes made. Re-run without --dry-run to apply.",
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("fix-youtube-embeds failed:", err);
    process.exit(1);
  });
