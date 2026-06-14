import "server-only";

import { cookies } from "next/headers";

/** Cookie that hints which blog a multi-blog user is currently acting on. */
export const ACTIVE_BLOG_COOKIE = "bb_active_blog";

/** Active-blog hint lifetime: 30 days. */
export const ACTIVE_BLOG_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

/**
 * Read the active-blog hint from the request cookies.
 *
 * Resilient by design: cookie parsing must never throw into tenant resolution
 * (e.g. when `cookies()` is unavailable outside a request scope), so any failure
 * degrades to `null` and the caller falls back to its default membership. The
 * value is ONLY a hint — membership is always re-verified by the caller, so a
 * forged or stale cookie can never grant access to a blog the user isn't in.
 */
export async function readActiveBlogHint(): Promise<string | null> {
  try {
    const store = await cookies();
    const value = store.get(ACTIVE_BLOG_COOKIE)?.value;
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}
