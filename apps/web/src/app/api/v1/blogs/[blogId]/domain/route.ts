/**
 * Custom domain API (Cloudflare for SaaS, blog-scoped)
 *
 * POST   /api/v1/blogs/{blogId}/domain -- Provision a Cloudflare for SaaS custom
 *   hostname for the blog. Stores it as "pending" and returns the CNAME the owner
 *   must add at their DNS provider.
 * GET    /api/v1/blogs/{blogId}/domain -- Return the current domain + status.
 *   Refreshes a "pending" domain's status from Cloudflare and persists changes.
 * DELETE /api/v1/blogs/{blogId}/domain -- Delete the custom hostname and clear
 *   the blog's domain fields.
 *
 * `{blogId}` must equal the caller's resolved tenant — owners manage only the
 * blog they are acting on. All operations are admin-gated.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { getDb } from "@/db";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  CloudflareApiError,
  CustomDomainsNotConfiguredError,
  createCustomHostname,
  deleteCustomHostname,
} from "@/lib/domains/cloudflare-saas";
import type { DomainGuidance } from "@/lib/domains/domain-status-guidance";
import { buildInstructions } from "@/lib/domains/instructions";
import { refreshDomainStatus } from "@/lib/domains/refresh";
import {
  clearBlogDomain,
  customDomainAvailable,
  getBlogDomain,
  setBlogDomain,
  validateCustomDomain,
  wwwCounterpart,
  type CustomDomainStatus,
} from "@/lib/domains/repository";

interface RouteParams {
  blogId: string;
}

const setDomainSchema = z.object({
  domain: z.string().min(1).max(253),
});

/** Convert a custom-domain error to a clean JSON response (never a 500/leak). */
function domainErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof CustomDomainsNotConfiguredError) {
    return NextResponse.json(
      { error: "custom_domains_not_configured", message: error.message },
      { status: 503 },
    );
  }
  if (error instanceof CloudflareApiError) {
    return NextResponse.json(
      { error: "cloudflare_error", message: error.message },
      { status: 502 },
    );
  }
  return null;
}

/**
 * POST /api/v1/blogs/{blogId}/domain
 * Provision a Cloudflare for SaaS custom hostname and store it as pending.
 */
export const POST = createApiHandler<z.infer<typeof setDomainSchema>, RouteParams>({
  auth: "admin",
  input: setDomainSchema,
  audit: "set_custom_domain",
  handler: async ({ body, params, blogId }) => {
    if (params.blogId !== blogId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const validation = validateCustomDomain(body.domain);
    if (!validation.ok) {
      return NextResponse.json(
        {
          error:
            validation.reason === "reserved"
              ? "domain_reserved"
              : "invalid_domain",
        },
        { status: 400 },
      );
    }
    const domain = validation.domain;

    if (!(await customDomainAvailable(domain, blogId))) {
      return NextResponse.json({ error: "domain_taken" }, { status: 409 });
    }

    try {
      const cf = await createCustomHostname(domain);
      await setBlogDomain(blogId, { domain, hostnameId: cf.id });
      const wwwNote = wwwCounterpart(domain);
      return NextResponse.json(
        {
          domain,
          cnameTarget: cf.dcvTarget,
          status: "pending" as CustomDomainStatus,
          ownershipVerification: cf.ownershipVerification,
          instructions: buildInstructions(
            domain,
            cf.dcvTarget,
            cf.ownershipVerification,
          ),
          // When the owner added an apex, surface that `www.` is a separate
          // hostname they'd need to add too (we don't auto-create it).
          apexNote: wwwNote
            ? `You added the apex ${domain}. ${wwwNote} is a separate hostname — add it too if you want visitors on www to reach your blog.`
            : null,
        },
        { status: 201 },
      );
    } catch (error) {
      const response = domainErrorResponse(error);
      if (response) return response;
      throw error;
    }
  },
});

/**
 * GET /api/v1/blogs/{blogId}/domain
 * Return the blog's current domain + status. Refreshes pending domains from
 * Cloudflare and persists status transitions.
 */
export const GET = createApiHandler<unknown, RouteParams>({
  auth: "admin",
  handler: async ({ params, blogId }) => {
    if (params.blogId !== blogId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const current = await getBlogDomain(blogId);
    if (!current?.domain) {
      return NextResponse.json({ domain: null, status: null });
    }

    let status = current.status;
    let verifiedAt = current.verifiedAt;
    let cnameTarget: string | null = null;
    let ownershipVerification:
      | { type: string; name: string; value: string }
      | null = null;
    let sslStatus: string | null = null;
    let guidance: DomainGuidance | null = null;
    let failureReason: string | null = current.failureReason;

    // Refresh a pending domain's status from Cloudflare; persist transitions and
    // send a deduped notification on a transition (shared with the poller).
    if (current.status === "pending" && current.hostnameId) {
      try {
        const outcome = await refreshDomainStatus(
          {
            blogId,
            hostnameId: current.hostnameId,
            currentStatus: current.status,
            notifiedStatus: current.notifiedStatus,
            pendingSince: current.lastCheckedAt,
          },
          getDb(),
        );
        cnameTarget = outcome.cf.dcvTarget;
        ownershipVerification = outcome.cf.ownershipVerification;
        sslStatus = outcome.cf.sslStatus;
        guidance = outcome.guidance;
        status = outcome.status;
        verifiedAt = outcome.status === "active" ? Date.now() : null;
        failureReason =
          outcome.status === "failed" ? outcome.guidance.userMessage : null;
      } catch (error) {
        const response = domainErrorResponse(error);
        if (response) return response;
        throw error;
      }
    }

    return NextResponse.json({
      domain: current.domain,
      status,
      verifiedAt,
      cnameTarget,
      ownershipVerification,
      sslStatus,
      failureReason,
      guidance,
      apexNote: (() => {
        const www = wwwCounterpart(current.domain);
        return www
          ? `${www} is a separate hostname — add it too if you want visitors on www to reach your blog.`
          : null;
      })(),
      instructions:
        status === "pending" && cnameTarget
          ? buildInstructions(current.domain, cnameTarget, ownershipVerification)
          : undefined,
    });
  },
});

/**
 * DELETE /api/v1/blogs/{blogId}/domain
 * Remove the Cloudflare custom hostname and clear the blog's domain fields.
 */
export const DELETE = createApiHandler<unknown, RouteParams>({
  auth: "admin",
  audit: "delete_custom_domain",
  handler: async ({ params, blogId }) => {
    if (params.blogId !== blogId) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const current = await getBlogDomain(blogId);
    if (!current?.domain) {
      return NextResponse.json({ error: "no_domain" }, { status: 404 });
    }

    // Best-effort delete at Cloudflare, then always clear our columns so the
    // owner is never stuck with an un-removable domain if the hostname is gone.
    if (current.hostnameId) {
      try {
        await deleteCustomHostname(current.hostnameId);
      } catch (error) {
        if (error instanceof CustomDomainsNotConfiguredError) {
          return NextResponse.json(
            { error: "custom_domains_not_configured", message: error.message },
            { status: 503 },
          );
        }
        // A 404 from Cloudflare (already deleted) is fine — fall through and
        // clear our side. Re-throw genuine API failures.
        if (!(error instanceof CloudflareApiError) || error.status !== 404) {
          throw error;
        }
      }
    }

    await clearBlogDomain(blogId);
    return NextResponse.json({ success: true });
  },
});
