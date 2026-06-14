/**
 * Migration: seed public shell branding for the current Supportsheep deployment.
 *
 * Fills in missing header/footer logo and color values in `blog_config/settings`
 * using the existing Supportsheep shell treatment so the new empty-by-default product
 * config does not visually regress this site.
 *
 * Safety:
 * - Non-destructive: only fills missing or blank values.
 * - Idempotent: re-running after the initial seed prints "no changes needed".
 * - DRY_RUN=1 prints the pending write and exits without touching Firestore.
 *
 * Usage:
 *   set -a; source apps/web/.env.local; set +a
 *   DRY_RUN=1 bun run apps/web/scripts/migrations/2026-04-24-seed-public-shell-branding.ts
 *   bun run apps/web/scripts/migrations/2026-04-24-seed-public-shell-branding.ts
 */

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const DRY_RUN = process.env.DRY_RUN === "1";
const BLOG_CONFIG_DOC = "settings";
const SITE_URL = "https://supportsheep.com";

const HEADER_BRANDING = {
  logoUrl: `${SITE_URL}/blogbat-header-logo.svg`,
  text: "",
  backgroundColor: "#1d1133",
  textColor: "#FFFFFF",
} as const;

const FOOTER_BRANDING = {
  logoUrl: `${SITE_URL}/blogbat-footer-logo.svg`,
  text: "",
  backgroundColor: "#171325",
  textColor: "#FFFFFF",
} as const;

function assertEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
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

function isMissing(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

async function main(): Promise<void> {
  initFirebase();
  const db = getFirestore();
  const configRef = db.collection("blog_config").doc(BLOG_CONFIG_DOC);
  const configSnap = await configRef.get();
  const currentConfig =
    (configSnap.data() ?? {}) as Record<string, unknown> & {
      publicAppearance?: {
        header?: Record<string, unknown>;
        footer?: Record<string, unknown>;
      };
    };

  const currentHeader = currentConfig.publicAppearance?.header ?? {};
  const currentFooter = currentConfig.publicAppearance?.footer ?? {};

  const headerUpdate: Record<string, unknown> = {};
  const footerUpdate: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(HEADER_BRANDING)) {
    if (isMissing(currentHeader[key])) {
      headerUpdate[key] = value;
    }
  }

  for (const [key, value] of Object.entries(FOOTER_BRANDING)) {
    if (isMissing(currentFooter[key])) {
      footerUpdate[key] = value;
    }
  }

  const hasHeaderChanges = Object.keys(headerUpdate).length > 0;
  const hasFooterChanges = Object.keys(footerUpdate).length > 0;

  console.info(`== seed-public-shell-branding ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"} ==`);
  console.info(`project=${process.env.FIREBASE_ADMIN_PROJECT_ID}`);

  if (!hasHeaderChanges && !hasFooterChanges) {
    console.info("no changes needed");
    return;
  }

  const payload: Record<string, unknown> = {
    publicAppearance: {
      ...(hasHeaderChanges ? { header: headerUpdate } : {}),
      ...(hasFooterChanges ? { footer: footerUpdate } : {}),
    },
    updatedAt: FieldValue.serverTimestamp(),
  };

  console.info(JSON.stringify(payload, null, 2));

  if (DRY_RUN) {
    console.info("(dry run) no writes issued");
    return;
  }

  await configRef.set(payload, { merge: true });
  console.info("done");
}

main().catch((error) => {
  console.error("migration failed:", error);
  process.exit(1);
});
