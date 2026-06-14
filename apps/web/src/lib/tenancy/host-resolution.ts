import "server-only";

import { and, eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";

import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { blogs } from "@/db/schema/tenancy";

type DB = DrizzleD1Database<typeof schema>;

/**
 * The tenant a public request resolves to, identified by hostname. Returned by
 * the host lookups; callers map this to a `blogId`.
 */
export interface ResolvedBlog {
  id: string;
  slug: string;
  displayName: string;
}

/** The platform's apex domain. `{slug}.blogbat.com` are tenant subdomains. */
export const ROOT_DOMAIN = "blogbat.com";

/**
 * Left-most labels under `blogbat.com` that are NOT tenant blogs — they map to
 * platform surfaces (the dashboard at `app`, the API, the staging worker, etc.)
 * rather than to a `blogs.slug`. A host whose first label is one of these never
 * resolves to a tenant.
 */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  "www",
  "app",
  "admin",
  "api",
  "staging",
  "dashboard",
  "mail",
  "smtp",
  "cdn",
  "assets",
  "static",
  // The Cloudflare for SaaS fallback origin. Never a tenant; must not 404 (real
  // custom-domain traffic reaches the worker with the customer's Host, but this
  // guards the fallback host itself from the unknown-subdomain 404 path).
  "customers",
]);

/**
 * Look up a blog by its (unique) slug. Returns the minimal public identity or
 * `null` when no blog owns the slug. `slug` is lowercased before the query.
 */
export async function getBlogBySlug(
  slug: string,
  db: DB = getDb(),
): Promise<ResolvedBlog | null> {
  const rows = await db
    .select({
      id: blogs.id,
      slug: blogs.slug,
      displayName: blogs.displayName,
    })
    .from(blogs)
    .where(eq(blogs.slug, slug.toLowerCase()))
    .limit(1);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Look up a blog by its `custom_domain` **only when verification is active**.
 * A custom domain is served publicly solely after Cloudflare for SaaS has
 * validated it (`custom_domain_status = "active"`); a pending/failed domain is
 * never resolved, so an unverified host falls through to `null`. `host` is
 * lowercased before the query.
 */
export async function getBlogByVerifiedCustomDomain(
  host: string,
  db: DB = getDb(),
): Promise<ResolvedBlog | null> {
  const rows = await db
    .select({
      id: blogs.id,
      slug: blogs.slug,
      displayName: blogs.displayName,
    })
    .from(blogs)
    .where(
      and(
        eq(blogs.customDomain, host.toLowerCase()),
        eq(blogs.customDomainStatus, "active"),
      ),
    )
    .limit(1);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Backwards-compatible alias for {@link getBlogByVerifiedCustomDomain}. Custom
 * domains are only served once verified, so this requires "active" status too.
 */
export const getBlogByCustomDomain = getBlogByVerifiedCustomDomain;

/** Strip a `:port` suffix and lowercase a host header value. */
function normalizeHost(host: string): string {
  return host.split(":")[0].trim().toLowerCase();
}

/**
 * Whether an incoming request host should render the BlogBat **marketing site**
 * (the landing page) rather than a tenant blog or a platform surface.
 *
 * Marketing hosts are the platform's public front door:
 * - the apex domain itself (`blogbat.com`),
 * - the `www` host (`www.blogbat.com`),
 * - the staging apex (`staging.blogbat.com`) — the staging environment's mirror
 *   of the apex; its `/login`, `/onboarding`, … routes still resolve by path,
 * - the local-dev apex (`localhost`, `127.0.0.1`) so the landing page is
 *   reachable while developing.
 *
 * Everything else is NOT marketing:
 * - `{slug}.blogbat.com` tenant blogs (and `{slug}.staging.blogbat.com`),
 * - platform surfaces like `app.blogbat.com` (dashboard), `api.blogbat.com`,
 * - customer custom domains.
 *
 * Pure and dependency-free (no DB) so it is safe to call during static builds
 * and easy to unit test.
 */
export function isMarketingHost(host: string): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;

  // Local development apex — render marketing locally.
  if (normalized === "localhost" || normalized === "127.0.0.1") return true;

  // The apex and `www` are marketing hosts under the root domain.
  if (normalized === ROOT_DOMAIN) return true;
  if (normalized === `www.${ROOT_DOMAIN}`) return true;

  // The staging apex mirrors production's apex: `staging.blogbat.com` is the
  // staging environment's marketing front door (the staging version of
  // `blogbat.com`), not a tenant blog. Dashboard/auth routes (`/login`,
  // `/onboarding`, …) still resolve by path on the same host. Note this matches
  // ONLY the bare staging apex — `{slug}.staging.blogbat.com` stays a tenant.
  if (normalized === `staging.${ROOT_DOMAIN}`) return true;

  return false;
}

/**
 * Whether `host` belongs to the platform's own root domain — the apex
 * (`blogbat.com`) or any `*.blogbat.com` host (tenant subdomains, platform
 * surfaces like `app`/`staging`, and the `customers` fallback origin). Local-dev
 * apex hosts (`localhost`, `127.0.0.1`) count too, so dev requests are treated as
 * first-party. A foreign host (a customer custom domain like `blog.acme.com`,
 * or any arbitrary domain entering the zone) returns false.
 *
 * Used to decide what an UNRESOLVED host should fall back to: a first-party host
 * may still render marketing/default, but an unrecognized foreign host must 404
 * rather than serve the default blog (see {@link resolveRequestTenant} — this
 * matters now that the catch-all Worker route runs the worker for every host
 * entering the zone, not just blogbat.com subdomains).
 *
 * Pure and dependency-free (no DB).
 */
export function isPlatformHost(host: string): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (normalized === "localhost" || normalized === "127.0.0.1") return true;
  if (normalized === ROOT_DOMAIN) return true;
  return normalized.endsWith(`.${ROOT_DOMAIN}`);
}

/**
 * Whether `host` is a candidate tenant subdomain under the root domain — a
 * `{label}.blogbat.com` (or `{label}.staging.blogbat.com`) whose left-most
 * label is NOT reserved. True even when no blog owns the slug; callers use this
 * to decide that an unresolved tenant subdomain should 404 (rather than fall
 * back to the default blog). The apex, `www`/`app`/`staging`/… platform hosts,
 * and non-`blogbat.com` custom domains all return false.
 *
 * Pure and dependency-free (no DB).
 */
export function isTenantSubdomainHost(host: string): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (normalized === ROOT_DOMAIN) return false;
  if (!normalized.endsWith(`.${ROOT_DOMAIN}`)) return false;
  const candidateSlug = normalized.split(".")[0];
  return !RESERVED_SUBDOMAINS.has(candidateSlug);
}

/**
 * Resolve the tenant `blogId` for an incoming request host, or `null` when the
 * host is not a tenant blog.
 *
 * Rules:
 * - A `*.blogbat.com` host (including `*.staging.blogbat.com`) resolves by its
 *   left-most label as the candidate slug. If that label is reserved (see
 *   {@link RESERVED_SUBDOMAINS}), or the host is the apex (`blogbat.com`) or a
 *   bare platform host (`www`/`app`/`staging`/`admin`/… .blogbat.com, and
 *   `staging.blogbat.com` itself), it is NOT a tenant → `null`.
 * - Any other host is treated as a customer custom domain → resolved via
 *   {@link getBlogByCustomDomain}.
 * - An unknown slug / unmapped custom domain → `null`.
 *
 * Callers fall back to `DEFAULT_BLOG_ID` when this returns `null`, preserving
 * single-tenant/default behavior until real subdomains exist (see
 * `getRequestBlogId`).
 */
export async function resolveBlogIdByHost(
  host: string,
  db: DB = getDb(),
): Promise<string | null> {
  const normalized = normalizeHost(host);
  if (!normalized) return null;

  if (normalized === ROOT_DOMAIN || normalized.endsWith(`.${ROOT_DOMAIN}`)) {
    // Apex itself (blogbat.com) is reserved for marketing — not a tenant.
    if (normalized === ROOT_DOMAIN) return null;

    // Left-most label is the candidate slug. For `staging.blogbat.com` this is
    // `staging` (reserved → null); for `foo.staging.blogbat.com` it is `foo`.
    const candidateSlug = normalized.split(".")[0];
    if (RESERVED_SUBDOMAINS.has(candidateSlug)) return null;

    const blog = await getBlogBySlug(candidateSlug, db);
    return blog?.id ?? null;
  }

  const blog = await getBlogByCustomDomain(normalized, db);
  return blog?.id ?? null;
}
