/**
 * Environment-based database configuration
 *
 * Supports three environments: dev, staging, prod
 * - dev: Uses prod credentials (default for local development)
 * - staging: Uses _STAGING suffixed env vars
 * - prod: Uses base env vars (no suffix)
 */

type Environment = "dev" | "staging" | "prod";

function getEnvironment(): Environment {
  const env = process.env.NEXT_PUBLIC_ENVIRONMENT as Environment;
  if (env !== "dev" && env !== "staging" && env !== "prod") {
    return "dev";
  }
  return env;
}

function getEnvVar(key: string, required: boolean = true): string {
  const env = getEnvironment();

  // For staging, try _STAGING suffix first, then fall back to base
  if (env === "staging") {
    const stagingValue = process.env[`${key}_STAGING`];
    if (stagingValue) return stagingValue;
  }

  // For dev and prod, or if staging value not found, use base
  const value = process.env[key];

  if (required && !value) {
    throw new Error(
      `Missing required environment variable: ${key}${env === "staging" ? " or " + key + "_STAGING" : ""}`,
    );
  }

  return value || "";
}

/**
 * Firebase client SDK config (used in browser)
 *
 * Note: Uses static references to NEXT_PUBLIC_ variables because
 * Next.js only inlines statically-referenced env vars at build time.
 * Dynamic access like process.env[key] doesn't work on the client side.
 */
export function getClientConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  };
}

/** Returns true if Firebase client credentials are configured */
export function isFirebaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);
}

/**
 * Firebase Admin SDK config (used on server)
 */
export function getAdminConfig() {
  return {
    projectId: getEnvVar("FIREBASE_ADMIN_PROJECT_ID"),
    clientEmail: getEnvVar("FIREBASE_ADMIN_CLIENT_EMAIL"),
    privateKey: getEnvVar("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
  };
}

/**
 * Get current environment
 */
export { getEnvironment };
