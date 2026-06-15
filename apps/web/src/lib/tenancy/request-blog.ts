import "server-only";

import { headers } from "next/headers";

import {
  isMarketingHost,
  isPlatformHost,
  isTenantSubdomainHost,
  resolveBlogIdByHost,
} from "@/lib/tenancy/host-resolution";
import { DEFAULT_blog_id } from "@/lib/tenancy/repository";

/**
 * Resolve the tenant `blogId` for the current public request from its host.
 *
 * The incoming host is read from the request headers (`x-bb-host`, set by
 * middleware, falling back to the standard `host` header) and resolved via
 * {@link resolveBlogIdByHost}. When the host is not a tenant blog (apex/`www`/
 * `staging`/`app`, an unknown slug, an unmapped custom domain) — or when the
 * resolver/DB is unavailable (e.g. during a static build, where `getDb()` has
 * no Cloudflare context) — this falls back to `DEFAULT_blog_id`, preserving the
 * current single-tenant/default behavior. It never throws, so a resolver hiccup
 * can never 500 a public page.
 */
export async function getRequestBlogId(): Promise<string> {
  try {
    const headerList = await headers();
    const host =
      headerList.get("x-bb-host") ?? headerList.get("host") ?? "";
    if (!host) return DEFAULT_blog_id;
    const resolved = await resolveBlogIdByHost(host);
    return resolved ?? DEFAULT_blog_id;
  } catch {
    return DEFAULT_blog_id;
  }
}

/**
 * How a public request's host should be served. Distinguishes:
 * - `blog`: a real tenant (a `{slug}.supportsheep.com` whose slug exists, or a
 *   verified custom domain) → render that tenant's content.
 * - `marketing`: the apex / `www` / local-dev host (and first-party platform
 *   hosts such as `app`/`staging`/`customers`.supportsheep.com) → render the
 *   marketing site or, in single-tenant mode, the default blog.
 * - `not-found`: render a 404 instead of silently serving the default blog.
 *   This covers BOTH an unknown `*.supportsheep.com` tenant subdomain AND any
 *   unrecognized FOREIGN host (a custom domain that isn't a verified blog).
 *
 * The foreign-host → not-found rule is required by the catch-all Cloudflare
 * Worker route: it runs the worker for EVERY host entering the supportsheep.com zone
 * (the only way Cloudflare for SaaS custom hostnames reach us), so an arbitrary
 * or unmapped/unverified custom domain now hits the worker. Without this it would
 * fall through to marketing/default and silently serve the wrong blog; it must
 * 404 instead. First-party `*.supportsheep.com` hosts still fall back to marketing.
 */
export type RequestTenant =
  | { kind: "blog"; blogId: string }
  | { kind: "marketing" }
  | { kind: "not-found" };

/**
 * Pure host-classification used by {@link resolveRequestTenant}, factored out so
 * the routing decision is unit-testable without mocking request headers.
 *
 * @param host the request host (may include a port; case-insensitive)
 * @param resolvedBlogId the knowledge base id `resolveBlogIdByHost` returned for `host`,
 *   or `null` when no verified tenant owns it.
 */
export function classifyRequestTenant(
  host: string,
  resolvedBlogId: string | null,
): RequestTenant {
  if (!host) return { kind: "marketing" };
  if (isMarketingHost(host)) return { kind: "marketing" };
  if (resolvedBlogId) return { kind: "blog", blogId: resolvedBlogId };

  // Unresolved. An unknown `*.supportsheep.com` tenant subdomain → 404. An
  // unrecognized FOREIGN host (custom domain not mapped/verified, or arbitrary
  // host entering the zone via the `*/*` route) → 404 too, so it never serves
  // the default blog. Other first-party platform hosts (apex already handled by
  // isMarketingHost; `app`/`staging`/`customers`.supportsheep.com, local dev) fall
  // back to marketing/default so they keep working.
  if (isTenantSubdomainHost(host)) return { kind: "not-found" };
  if (!isPlatformHost(host)) return { kind: "not-found" };
  return { kind: "marketing" };
}

export async function resolveRequestTenant(): Promise<RequestTenant> {
  try {
    const headerList = await headers();
    const host =
      headerList.get("x-bb-host") ?? headerList.get("host") ?? "";
    if (!host) return { kind: "marketing" };

    const resolved = isMarketingHost(host)
      ? null
      : await resolveBlogIdByHost(host);
    return classifyRequestTenant(host, resolved);
  } catch {
    return { kind: "marketing" };
  }
}
