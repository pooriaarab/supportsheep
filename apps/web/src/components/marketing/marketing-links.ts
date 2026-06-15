/**
 * Canonical destinations for marketing-site calls to action.
 *
 * Sign-up / onboarding and sign-in both live on the dashboard app at
 * `app.supportsheep.com`. Centralized here so every CTA points at the same place.
 */

// If we're on staging, point to staging. Otherwise point to prod.
// In Cloudflare Workers, this is usually determined by host headers or process.env,
// but for static rendering, we can use NEXT_PUBLIC_ENVIRONMENT.
// Actually, since these are static client links and NEXT_PUBLIC_APP_URL is not always set right in CF pages build,
// let's use a function or fallback to a relative path where possible, or rely on NEXT_PUBLIC_APP_URL.
const getAppUrl = () => {
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  // Fallback to production if not set
  return "https://app.supportsheep.com";
};

/** The dashboard app origin where signup, onboarding, and login live. */
export const APP_URL = getAppUrl();

/**
 * "Get Started" — signup / onboarding entry point.
 *
 * Routes through the magic-link login with a `returnTo` of `/onboarding`. New
 * visitors enter their email, follow the magic link, and land on the
 * create-your-blog form; the bare app origin (`app.supportsheep.com`) is a reserved
 * platform host that renders the default public blog, not a signup surface, so
 * we must target the auth flow explicitly.
 */
export const APP_SIGNUP_URL = `${APP_URL}/login?returnTo=/onboarding`;

/** "Sign in" — existing-account login. */
export const APP_LOGIN_URL = `${APP_URL}/login`;
