/**
 * Firebase Client SDK (browser-side)
 *
 * Used for:
 * - User authentication on the frontend
 * - Client-side auth state management
 * - Real-time Firestore listeners
 *
 * IMPORTANT: Only use this on the CLIENT side.
 * For server-side data, use the Cloudflare D1 repositories under `@/lib/**`.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getClientConfig } from "./config";
import { createLogger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/error-utils";

const log = createLogger("lib:db:firebase-client");

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;

/**
 * Get or initialize the Firebase app (client SDK)
 * Uses lazy initialization to avoid issues with SSR
 */
export function getApp(): FirebaseApp {
  if (!app) {
    // Check if already initialized (e.g., by another module)
    const existingApps = getApps();
    const existingApp = existingApps.find((a) => a.name === "[DEFAULT]");

    if (existingApp) {
      app = existingApp;
    } else {
      app = initializeApp(getClientConfig());
    }
  }
  return app;
}

/**
 * Get or initialize Firebase Auth (client SDK)
 */
export function getClientAuth(): Auth {
  if (!auth) {
    auth = getAuth(getApp());
  }
  return auth;
}

/**
 * Get or initialize Firestore (client SDK)
 */
export function getClientDb(): Firestore {
  if (!db) {
    db = getFirestore(getApp());
  }
  return db;
}

/**
 * Test connection to Firebase
 * Returns true if connection is successful, false otherwise
 */
export async function testConnection(): Promise<boolean> {
  try {
    const testAuth = getClientAuth();
    // Test by attempting to get current user (will be null if not logged in, but proves connection works)
    await testAuth.authStateReady();
    return true;
  } catch (error: unknown) {
    log.error("Failed to connect to Firebase", {
      error: getErrorMessage(error),
    });
    return false;
  }
}
