/**
 * Next.js Edge Middleware
 *
 * Protects routes by checking for a session cookie.
 * Redirects unauthenticated users to the login page.
 *
 * Strategy: protect known dashboard prefixes; everything else is public.
 * Public pages include: /, /login, /blog, /search, /:category, /:category/:slug
 *
 * NOTE: This middleware runs on the Edge runtime, so it can only do
 * lightweight checks (cookie existence, not full token verification).
 * Full session verification happens in API routes and server components.
 */

import { NextResponse, type NextRequest } from "next/server";
import {
  normalizeTrailingSlash,
  resolveLegacyRedirect,
} from "@/lib/legacy-redirects";
import { normalizePathname } from "@/lib/normalize-pathname";
import { isReservedRootSlug } from "@/lib/permalinks";

/** Prefixes that REQUIRE authentication (dashboard pages + protected APIs) */
const PROTECTED_PREFIXES = [
  "/categories",
  "/dashboard",
  "/generate",
  "/media",
  "/posts",
  "/search",
  "/seo",
  "/settings",
  "/users",
  "/writing",
  "/api/v1",
  "/interview/new",
  "/interview/links",
  "/interview/sessions",
];

/** Specific routes exempted from auth even if they match a protected prefix */
const PUBLIC_API_ROUTES = new Set([
  "/api/v1/health",
  "/api/v1/mcp",
  // Browser-side log shipping. The endpoint accepts anonymous POSTs from any
  // visitor's browser (incl. on `/login` and public blog pages) and
  // self-protects via per-IP rate limiting, PII redaction, and a hard
  // per-batch entry cap. Without this exemption the auth middleware 307s
  // every batch to `/login?returnTo=…`, which floods the browser console
  // with HTTP 405s and prevents log shipping for unauthenticated users.
  "/api/v1/client-logs",
  // Internal cron-driven domain-status refresh. Machine-to-machine; it has no
  // session and self-protects via the INTERNAL_CRON_SECRET shared-secret header
  // (fail-closed). Without this exemption the auth middleware would 307 the
  // cron call to /login.
  "/api/v1/internal/domains/refresh",
]);

/** API path prefixes that are public (no auth needed) */
const PUBLIC_API_PREFIXES = [
  "/api/v1/auth/",
  "/api/v1/public/",
  "/api/v1/free-tools/public/",
  "/api/search",
  "/api/feed",
  "/api/llms.txt",
  "/api/revalidate",
  // Interview endpoints (both share-link guest flow + author flow). Each
  // route under here uses `createApiHandler` which enforces its own auth
  // contract — share-link guest routes (`auth: "none"`) need to be
  // reachable by anonymous callers, while authored routes (`auth: "user"`)
  // still return 401 from the handler itself. The middleware previously
  // 307'd every `/api/v1/interviews/*` request to `/login`, which broke
  // incognito guests on `/interview/join/<token>` (the by-token API was
  // never allowed to run) and would have broken the guest /consent /end
  // /events flow the moment a real guest tried to use a link.
  "/api/v1/interviews/",
  "/api/v1/interviews", // exact — POST /api/v1/interviews (create interview)
  // Public media bytes (blog images) served from R2. The serve route is
  // prefix-locked to the public `media/` namespace and does its own checks.
  // Without this, image extensions not in the matcher's static-file exclusion
  // (notably `.avif`) would 307→/login instead of rendering.
  "/api/v1/media/file/",
];

const MARKDOWN_DISALLOWED_PREFIXES = ["/api/", "/.well-known", "/_next"];
const MARKDOWN_DISALLOWED_PATHS = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/api/markdown",
]);

function matchesProtectedPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function wantsMarkdown(request: NextRequest) {
  return (request.headers.get("accept") ?? "")
    .toLowerCase()
    .includes("text/markdown");
}

function isMarkdownEligiblePath(pathname: string) {
  if (!pathname.startsWith("/")) {
    return false;
  }

  const normalizedPathname = normalizePathname(pathname);

  if (MARKDOWN_DISALLOWED_PATHS.has(normalizedPathname)) {
    return false;
  }

  if (
    MARKDOWN_DISALLOWED_PREFIXES.some((prefix) =>
      normalizedPathname.startsWith(prefix),
    )
  ) {
    return false;
  }

  if (
    normalizedPathname === "/" ||
    normalizedPathname === "/blog" ||
    normalizedPathname === "/docs"
  ) {
    return true;
  }

  const segments = normalizedPathname.split("/").filter(Boolean);

  if (segments[0] === "category" && segments.length === 2 && segments[1]) {
    return true;
  }

  if (segments.length === 1 && !isReservedRootSlug(segments[0])) {
    return true;
  }

  // For other non-protected multi-segment paths, prefer an explicit markdown
  // 404 from the markdown endpoint over falling back to an HTML 404 page.
  return (
    segments.length > 1 &&
    !PROTECTED_PREFIXES.some((prefix) =>
      matchesProtectedPrefix(normalizedPathname, prefix),
    )
  );
}

/**
 * Pass the request through, forwarding the resolved request host as `x-bb-host`
 * so public Server Components / route handlers can resolve the tenant blog from
 * the hostname (see `getRequestBlogId`). `getRequestBlogId` also falls back to
 * the standard `host` header, so this is a resilient, explicit hint rather than
 * the sole source of truth.
 */
function passThroughWithHost(request: NextRequest) {
  const host = request.headers.get("host");
  if (!host) return NextResponse.next();
  const headers = new Headers(request.headers);
  headers.set("x-bb-host", host);
  return NextResponse.next({ request: { headers } });
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const legacyRedirect = resolveLegacyRedirect(pathname);
  if (legacyRedirect) {
    const url = request.nextUrl.clone();
    url.pathname = legacyRedirect;
    url.search = "";
    return NextResponse.redirect(url, 301);
  }

  const strippedPathname = normalizeTrailingSlash(pathname);
  if (strippedPathname && strippedPathname !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = strippedPathname;
    return NextResponse.redirect(url, 301);
  }

  const markdownMatch = pathname.match(/^\/([^/]+)\.md$/);
  const llmsMatch = pathname.match(/^\/([^/]+)\.llms\.txt$/);

  if (pathname === "/index.md") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/markdown";
    url.searchParams.set("pathname", "/");
    const headers = new Headers(request.headers);
    const host = request.headers.get("host");
    if (host) headers.set("x-bb-host", host);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (llmsMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/${llmsMatch[1]}/llms.txt`;
    const headers = new Headers(request.headers);
    const host = request.headers.get("host");
    if (host) headers.set("x-bb-host", host);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (markdownMatch) {
    const url = request.nextUrl.clone();
    url.pathname = `/${markdownMatch[1]}/md`;
    const headers = new Headers(request.headers);
    const host = request.headers.get("host");
    if (host) headers.set("x-bb-host", host);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (
    request.method === "GET" &&
    wantsMarkdown(request) &&
    isMarkdownEligiblePath(pathname)
  ) {
    const normalizedPathname = normalizePathname(pathname);
    const url = request.nextUrl.clone();
    url.pathname = "/api/markdown";
    url.searchParams.set("pathname", normalizedPathname);
    const headers = new Headers(request.headers);
    headers.set("x-markdown-pathname", normalizedPathname);
    const host = request.headers.get("host");
    if (host) headers.set("x-bb-host", host);
    return NextResponse.rewrite(url, {
      request: {
        headers,
      },
    });
  }

  if (
    process.env.NODE_ENV === "development" &&
    process.env.DEV_AUTH_BYPASS === "true"
  ) {
    return passThroughWithHost(request);
  }

  // Demo mode: explicit opt-in only. Must never key off a missing/unset
  // credential (that would silently disable the auth gate in production).
  if (process.env.DEMO_MODE === "true") {
    return passThroughWithHost(request);
  }

  // Allow public API routes
  if (PUBLIC_API_ROUTES.has(pathname)) {
    return passThroughWithHost(request);
  }

  // Allow public API prefixes
  if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return passThroughWithHost(request);
  }

  // Check if this is a protected route
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    matchesProtectedPrefix(pathname, prefix),
  );

  // If not a protected prefix, allow through (public blog pages, etc.)
  if (!isProtected) {
    return passThroughWithHost(request);
  }

  // Accept either the Firebase session cookie or a Better Auth session cookie
  // (migration: routes auth via Better Auth on Workers, Firebase elsewhere). This
  // is a lightweight presence check only; full verification happens in the route /
  // server component. Better Auth uses `__Secure-` prefix over HTTPS.
  const sessionCookie =
    request.cookies.get("session") ??
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    // Redirect to login with return URL
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Session cookie exists — let the request through.
  // Full verification happens in server components / API routes.
  return NextResponse.next();
}

/**
 * Matcher config: run middleware on all routes except static files.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
