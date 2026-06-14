/**
 * Canonical destinations for marketing-site calls to action.
 *
 * Sign-up / onboarding and sign-in both live on the dashboard app at
 * `app.supportsheep.com`. Centralized here so every CTA points at the same place.
 */

/** The dashboard app origin where signup, onboarding, and login live. */
export const APP_URL = "https://app.supportsheep.com";

/**
 * "Start your blog" — signup / onboarding entry point.
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
