import { redirect } from "next/navigation";

/**
 * `/dashboard/interview` is a legacy alias surface — the actual interview
 * admin routes live at `/interview/links`, `/interview/new`, etc. Without
 * this page, hitting `/dashboard/interview` (referenced in docs, prototypes,
 * and bookmarks) returns a 404 *after* the middleware 307s unauthenticated
 * users to `/login`, racing the redirect and rendering the Next.js default
 * not-found surface in the hydrated DOM.
 *
 * Redirect to the canonical interview admin home so:
 * - Authenticated visitors land on `/interview/links`.
 * - Unauthenticated visitors still get 307'd to `/login` by the middleware
 *   (this page never renders for them — the middleware short-circuits first).
 */
export default function DashboardInterviewRedirectPage() {
  redirect("/interview/links");
}
