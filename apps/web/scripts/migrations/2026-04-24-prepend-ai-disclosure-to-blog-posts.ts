import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { prependAiDisclosure } from "../../src/lib/articles/prepend-ai-disclosure";
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

const DRY_RUN = process.env.DRY_RUN === "1";
const blog_id = "default";
const BATCH_LIMIT = 50;

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

async function main() {
  initFirebase();
  const db = getFirestore();
  const snapshot = await db
    .collection("articles")
    .where("blogId", "==", blog_id)
    .get();

  const counters = {
    scanned: 0,
    updated: 0,
    skippedAlreadyPresent: 0,
    skippedEmptyBody: 0,
    scannedByPostType: {} as Record<string, number>,
    updatedByPostType: {} as Record<string, number>,
  };

  const pendingWrites: Array<{
    id: string;
    patch: Partial<{ body: string; draftBody: string }>;
  }> = [];
  for (const doc of snapshot.docs) {
    counters.scanned += 1;
    const data = doc.data();
    const postType =
      typeof data.postType === "string" ? data.postType : "__missing__";
    counters.scannedByPostType[postType] =
      (counters.scannedByPostType[postType] ?? 0) + 1;
    const body = typeof data.body === "string" ? data.body : "";
    const draftBody =
      typeof data.draftBody === "string" ? data.draftBody : "";

    if (body.trim().length === 0 && draftBody.trim().length === 0) {
      counters.skippedEmptyBody += 1;
      continue;
    }

    const bodyPrepended =
      body.trim().length > 0 ? prependAiDisclosure(body) : { body, changed: false };
    const draftPrepended =
      draftBody.trim().length > 0
        ? prependAiDisclosure(draftBody)
        : { body: draftBody, changed: false };

    if (!bodyPrepended.changed && !draftPrepended.changed) {
      counters.skippedAlreadyPresent += 1;
      continue;
    }

    const patch: Partial<{ body: string; draftBody: string }> = {};
    if (bodyPrepended.changed) {
      patch.body = sanitizeArticleHtml(bodyPrepended.body);
    }
    if (draftPrepended.changed) {
      patch.draftBody = sanitizeArticleHtml(draftPrepended.body);
    }

    pendingWrites.push({
      id: doc.id,
      patch,
    });
    counters.updatedByPostType[postType] =
      (counters.updatedByPostType[postType] ?? 0) + 1;
  }

  counters.updated = pendingWrites.length;

  if (!DRY_RUN && pendingWrites.length > 0) {
    for (let i = 0; i < pendingWrites.length; i += BATCH_LIMIT) {
      const slice = pendingWrites.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      for (const item of slice) {
        batch.update(db.collection("articles").doc(item.id), {
          ...item.patch,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  }

  console.info(
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        ...counters,
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
