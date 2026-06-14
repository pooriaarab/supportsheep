/**
 * Database layer re-exports
 *
 * This module provides a clean interface for database operations.
 * Server-side data now lives in Cloudflare D1 (drizzle repositories under
 * `@/lib/**` and `@/db`); the Firebase Admin SDK has been removed. The
 * remaining exports here are the Firebase *client* SDK (still used by the
 * browser) and environment config.
 */

// Client-side database access (Firebase Client SDK)
export {
  getApp,
  getClientAuth,
  getClientDb,
  testConnection,
} from "./firebase-client";

// Environment-based configuration
export { getClientConfig, getAdminConfig, getEnvironment } from "./config";
