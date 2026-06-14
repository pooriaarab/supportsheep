/**
 * Declarative API route handler that bundles auth, validation, error handling,
 * and audit logging. Routes only need to specify config + business logic.
 *
 * @example
 * ```typescript
 * export const POST = createApiHandler({
 *   auth: 'user',
 *   input: myZodSchema,
 *   audit: 'create_item',
 *   handler: async ({ session, body }) => {
 *     // ... business logic
 *     return NextResponse.json({ id }, { status: 201 });
 *   },
 * });
 * ```
 */

import { NextResponse, type NextRequest } from "next/server";
import type { ZodSchema } from "zod";
import { verifyRequest, AuthError, type SessionData } from "@/lib/auth/session";
import {
  handleApiError,
  formatValidationError,
  roleSatisfies,
  type AuthenticatedSession,
} from "@/lib/api-utils";
import {
  resolveTenantForUser,
  DEFAULT_BLOG_ID,
  NeedsOnboardingError,
} from "@/lib/tenancy/repository";
import {
  logAuditEvent,
  getClientIp,
  type AuditAction,
} from "@/lib/audit-log";
import {
  generateCorrelationId,
  withCorrelationId,
} from "@/lib/correlation";
import { checkRateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const rateLimitLog = createLogger("lib:create-api-handler:rate-limit");

interface RateLimitConfig {
  /** Stable identifier for the route — used as the doc-key prefix. */
  key: string;
  /** Max requests allowed per IP per 1-minute window. */
  maxPerMinute: number;
}

interface HandlerConfig<TBody = unknown, TParams = unknown> {
  /** Auth level: 'user' (default) requires login + a resolved blog membership;
   * 'admin' also checks admin role; 'session' requires login but NOT a membership
   * (onboarding / cross-tenant routes like blog creation — blogId is "", role null);
   * 'none' skips auth. */
  auth?: "user" | "admin" | "none" | "session";
  /** Zod schema for request body (POST/PATCH/PUT) */
  input?: ZodSchema<TBody>;
  /** Audit action name — auto-logs on success if provided */
  audit?: AuditAction;
  /**
   * Per-IP rate limit applied before auth + validation. Returns 429 with a
   * `Retry-After` header when exceeded. Intended for public endpoints
   * (`auth: "none"`) that anonymous callers can flood.
   */
  rateLimit?: RateLimitConfig;
  /** The handler — receives validated input, session, and resolved tenant */
  handler: (ctx: {
    request: NextRequest;
    session: SessionData | AuthenticatedSession;
    body: TBody;
    params: TParams;
    /** Tenant resolved from the caller's blog membership. For `auth: "none"`
     * routes this is the default blog until public hostname routing lands. */
    blogId: string;
    /** Caller's role on `blogId`, or null for `auth: "none"`. */
    role: string | null;
  }) => Promise<NextResponse>;
}

/**
 * Creates a Next.js API route handler with built-in auth, validation,
 * error handling, and optional audit logging.
 *
 * Features:
 * - Correlation ID propagation (x-correlation-id header)
 * - Auth verification (session cookie or admin role check)
 * - Zod schema validation for request bodies
 * - Automatic audit logging on success
 * - Standardized error responses
 */
export function createApiHandler<TBody = unknown, TParams = unknown>(
  config: HandlerConfig<TBody, TParams>,
) {
  return async function routeHandler(
    request: NextRequest,
    context?: { params?: Promise<TParams> },
  ): Promise<NextResponse> {
    // Sanitize client-provided correlation IDs to prevent log injection
    // (newlines, brackets, or excessively long values could corrupt log parsing).
    const rawCorrelationId = request.headers.get("x-correlation-id");
    const correlationId =
      rawCorrelationId && /^[\w-]{1,64}$/.test(rawCorrelationId)
        ? rawCorrelationId
        : generateCorrelationId();

    return withCorrelationId(correlationId, async () => {
      try {
        // 0. Per-IP rate limit (before auth so unauthenticated floods are
        //    blocked at the cheapest point in the pipeline).
        if (config.rateLimit) {
          const ip = getClientIp(request) || "unknown";
          const rate = await checkRateLimit({
            key: config.rateLimit.key,
            ip,
            maxPerMinute: config.rateLimit.maxPerMinute,
          });
          if (!rate.allowed) {
            const retryAfterSec = Math.max(
              1,
              Math.ceil((rate.resetAt - Date.now()) / 1000),
            );
            rateLimitLog.warn("rate limit exceeded", {
              key: config.rateLimit.key,
              ip,
              limit: rate.limit,
              retryAfterSec,
            });
            const response = NextResponse.json(
              { error: "Rate limit exceeded" },
              {
                status: 429,
                headers: {
                  "Retry-After": String(retryAfterSec),
                  "X-RateLimit-Limit": String(rate.limit),
                  "X-RateLimit-Remaining": "0",
                  "X-RateLimit-Reset": String(rate.resetAt),
                  "Cache-Control": "no-store",
                },
              },
            );
            response.headers.set("x-correlation-id", correlationId);
            return response;
          }
        }

        // 1. Auth + tenant resolution
        let session: SessionData | AuthenticatedSession;
        let blogId: string;
        let role: string | null;
        if (config.auth === "none") {
          // No auth required — placeholder session. Public routes operate on
          // the default blog until hostname→blog routing lands (later slice).
          session = { uid: "anonymous", email: "", authTime: 0 };
          blogId = DEFAULT_BLOG_ID;
          role = null;
        } else if (config.auth === "session") {
          // Authenticated but membership-optional — onboarding / cross-tenant
          // routes (blog creation, listing the caller's blogs). No tenant is
          // resolved, so handlers must rely on session.uid, not blogId.
          session = await verifyRequest();
          blogId = "";
          role = null;
        } else {
          session = await verifyRequest();
          let tenant: Awaited<ReturnType<typeof resolveTenantForUser>>;
          try {
            tenant = await resolveTenantForUser(session);
          } catch (error) {
            // A user with no blog membership must complete onboarding first.
            // Surface a distinct 409 so the client can route to /onboarding;
            // all other resolution errors propagate to the standard handler.
            if (error instanceof NeedsOnboardingError) {
              const response = NextResponse.json(
                { error: "needs_onboarding" },
                { status: 409 },
              );
              response.headers.set("x-correlation-id", correlationId);
              return response;
            }
            throw error;
          }
          blogId = tenant.blogId;
          role = tenant.role;
          if (config.auth === "admin" && !roleSatisfies(role, "admin")) {
            throw new AuthError("admin access required", 403);
          }
        }

        // 2. Validate body
        let body = undefined as TBody;
        if (config.input) {
          const parsed = await parseJsonBody(request);
          if (!parsed.ok) {
            return parsed.response;
          }

          const result = config.input.safeParse(parsed.data);
          if (!result.success) {
            return formatValidationError(result.error);
          }
          body = result.data;
        }

        // 3. Resolve params
        const params = context?.params
          ? await context.params
          : (undefined as TParams);

        // 4. Execute handler
        const response = await config.handler({
          request,
          session,
          body,
          params,
          blogId,
          role,
        });

        // 5. Set correlation ID on response
        response.headers.set("x-correlation-id", correlationId);

        // 6. Audit (fire-and-forget on success)
        if (config.audit && config.auth !== "none" && response.status < 400) {
          logAuditEvent({
            actorId: session.uid,
            actorEmail: session.email,
            action: config.audit,
            ip: getClientIp(request),
            result: "success",
          }).catch(() => {});
        }

        return response;
      } catch (error: unknown) {
        const errorResponse = handleApiError(error);
        errorResponse.headers.set("x-correlation-id", correlationId);
        return errorResponse;
      }
    });
  };
}

async function parseJsonBody(
  request: NextRequest,
): Promise<
  { ok: true; data: unknown } | { ok: false; response: NextResponse }
> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 },
      ),
    };
  }
}
