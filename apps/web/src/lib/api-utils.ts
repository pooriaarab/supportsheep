/**
 * Centralized API utilities for request validation, auth checks, and error handling
 *
 * Consolidates patterns duplicated across API routes into reusable helpers:
 * - verifyAuthenticatedRequest(): combines auth verification + optional role check
 * - formatValidationError(): consistent Zod error formatting
 * - handleApiError(): standardized catch-block error handler
 * - validateInput(): schema validation with typed returns
 */

import { NextResponse } from "next/server";
import { verifyRequest, AuthError, type SessionData } from "@/lib/auth/session";
import { createLogger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/error-utils";
import type { ZodSchema, ZodIssue } from "zod";
import { resolveTenantForUser } from "@/lib/tenancy/repository";

const log = createLogger("api:error-handler");

/**
 * Extended session with user role information
 */
export interface AuthenticatedSession extends SessionData {
  role?: string;
}

/**
 * Verify authentication and optionally check role.
 * Combines verifyRequest() + role check in one call.
 *
 * @param requiredRole - Optional role to require (e.g., "admin")
 * @throws {AuthError} 401 if not authenticated, 403 if role check fails
 */
export async function verifyAuthenticatedRequest(
  requiredRole?: string,
): Promise<AuthenticatedSession> {
  const session = await verifyRequest();
  // Role now comes from the user's blog membership (D1), not Firestore.
  const { role } = await resolveTenantForUser(session);

  if (requiredRole && !roleSatisfies(role, requiredRole)) {
    throw new AuthError(`${requiredRole} access required`, 403);
  }

  return { ...session, role };
}

/**
 * Returns true when the caller's role satisfies the required role per the
 * project's role hierarchy. Keep this in one place so every gated route
 * has consistent behaviour.
 *
 * Hierarchy (highest → lowest):
 *   owner > admin > editor > viewer > guest
 *
 * A higher role implicitly satisfies any lower-role check.
 */
export function roleSatisfies(actual: string, required: string): boolean {
  const order = ["guest", "viewer", "editor", "admin", "owner"];
  const actualIdx = order.indexOf(actual);
  const requiredIdx = order.indexOf(required);
  if (actualIdx < 0 || requiredIdx < 0) {
    // Unknown role string on either side — fall back to strict equality so
    // we don't accidentally widen access for typos.
    return actual === required;
  }
  return actualIdx >= requiredIdx;
}

/**
 * Format Zod validation errors into a consistent response shape.
 */
export function formatValidationError(error: {
  issues: ZodIssue[];
}): NextResponse {
  const details = error.issues.map((i) => ({
    field: i.path.join("."),
    message: i.message,
  }));
  return NextResponse.json(
    { error: "Validation failed", details },
    { status: 400 },
  );
}

/**
 * Validate input against a Zod schema, returning a formatted error response on failure.
 * Returns the parsed data on success, or a NextResponse on failure.
 */
export function validateInput<T>(
  schema: ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return { success: false, response: formatValidationError(result.error) };
  }
  return { success: true, data: result.data };
}

/**
 * Standard error response handler for catch blocks.
 * Handles AuthError, Zod-like errors, and generic errors.
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  // Duck-type ZodError (has .issues array)
  if (
    error &&
    typeof error === "object" &&
    "issues" in error &&
    Array.isArray((error as { issues: unknown[] }).issues)
  ) {
    return formatValidationError(error as { issues: ZodIssue[] });
  }

  const message = getErrorMessage(error);

  // Surface known user-actionable errors with 400 instead of generic 500
  const userActionablePatterns = [
    "not configured",
    "API key",
    "api key",
    "Add it in Settings",
    "not found",
    "missing required",
  ];
  if (userActionablePatterns.some((p) => message.includes(p))) {
    log.warn("User-actionable API error", { error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const details: Record<string, unknown> = { error: message };
  if (error instanceof Error) {
    details.name = error.name;
    details.stack = error.stack;
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if ("code" in record) details.code = record.code;
    if ("details" in record) details.details = record.details;
  }
  log.error("Unhandled API error", details);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
