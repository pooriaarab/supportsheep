/**
 * Audit logging utilities for user/admin actions
 *
 * Persists audit events to the `audit_logs` D1 table via drizzle
 * and logs a summary line for observability.
 */

import { desc, sql } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { nanoid } from "nanoid";
import { getDb } from "@/db";
import type * as schema from "@/db/schema";
import { auditLogs } from "@/db/schema/audit-log";
import { createLogger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/error-utils";

const log = createLogger("lib:audit-log");

/**
 * Audit action types -- extend with your application's actions
 */
export type AuditAction =
  | "login"
  | "logout"
  | "create_user"
  | "update_user"
  | "delete_user"
  | "create_item"
  | "update_item"
  | "delete_item"
  | "settings_updated"
  | "create_api_key"
  | "revoke_api_key"
  | "create_task"
  | "update_task"
  | "delete_task"
  | "create_notification"
  | "update_notification"
  | "delete_notification"
  | "create_integration"
  | "update_integration"
  | "delete_integrations"
  | "delete_api_keys"
  | "create_template"
  | "update_template"
  | "delete_template"
  | "ai_chat_message"
  | "ai_chat_clear"
  | "create_article"
  | "update_article"
  | "delete_article"
  | "create_category"
  | "update_category"
  | "delete_category"
  | "create_author"
  | "update_author"
  | "delete_author"
  | "upload_media"
  | "delete_media"
  | "generate_keyword"
  | "generate_bulk"
  | "generate_content_plan"
  | "generate_image"
  | "generate_image_prompt"
  | "create_context_tag"
  | "update_context_tag"
  | "delete_context_tag"
  | "create_writing_skill"
  | "update_writing_skill"
  | "delete_writing_skill"
  | "reorder_writing_skills"
  | "run_skills_pipeline"
  | "create_internal_link_rule"
  | "update_internal_link_rule"
  | "delete_internal_link_rule"
  | "create_sitemap"
  | "refresh_sitemap"
  | "delete_sitemap"
  | "update_blog_config"
  | "trigger_function"
  | "start_import"
  | "create_share_link"
  | "update_share_link"
  | "revoke_share_link"
  | "regenerate_share_link"
  | "resolve_share_link"
  | "submit_for_review"
  | "upload_async_question"
  | "upload_async_response"
  | "end_async_interview"
  | "create_blog"
  | "create_signup_code"
  | "agent_signup"
  | "create_invite"
  | "revoke_invite"
  | "accept_invite"
  | "switch_blog"
  | "set_custom_domain"
  | "delete_custom_domain"
  | "join_domain_waitlist"
  | "dev_login";

/**
 * Target entity types for audit logging
 */
type AuditTargetType = "user" | "item" | "settings" | "api_key" | null;

/**
 * Result types for audit logging
 */
export type AuditResult = "success" | "failure";

/**
 * Audit log entry structure
 */
export interface AuditLog {
  /** UID of the user who performed the action */
  actorId: string;

  /** Email of the user who performed the action */
  actorEmail: string;

  /** Type of action performed */
  action: AuditAction;

  /** Type of target entity (if applicable) */
  targetType: AuditTargetType;

  /** ID of the target entity (if applicable) */
  targetId: string | null;

  /** Additional metadata about the action (flexible JSON) */
  metadata: Record<string, unknown>;

  /** Timestamp of the action (ISO 8601, server-generated) */
  createdAt: string;

  /** IP address of the request */
  ip: string | null;

  /** Result of the action */
  result: AuditResult;

  /** Error message if result is 'failure' */
  errorMessage?: string | null;
}

/**
 * Input for logging an audit event
 */
interface LogAuditEventInput {
  /** UID of the user who performed the action */
  actorId: string;

  /** Email of the user who performed the action */
  actorEmail: string;

  /** Type of action performed */
  action: AuditAction;

  /** Type of target entity (if applicable) */
  targetType?: AuditTargetType;

  /** ID of the target entity (if applicable) */
  targetId?: string | null;

  /** Additional metadata about the action */
  metadata?: Record<string, unknown>;

  /** IP address of the request */
  ip?: string | null;

  /** Result of the action */
  result: AuditResult;

  /** Error message if result is 'failure' */
  errorMessage?: string | null;
}

/**
 * Log an audit event to the `audit_logs` D1 table.
 *
 * @param input - Audit log event data
 * @returns ID of the created audit log entry, or empty string on error
 */
export async function logAuditEvent(
  input: LogAuditEventInput,
  db: DrizzleD1Database<typeof schema> = getDb(),
): Promise<string> {
  try {
    // Log summary for observability
    const targetInfo = input.targetId
      ? ` on ${input.targetType}:${input.targetId}`
      : "";
    const resultInfo =
      input.result === "failure" ? ` [FAILED: ${input.errorMessage}]` : "";
    log.info(
      `[AUDIT] ${input.action} by ${input.actorEmail}${targetInfo}${resultInfo}`,
    );

    // Persist to D1 (Workers-native). createdAt is set by the schema's default.
    const id = nanoid();
    await db.insert(auditLogs).values({
      id,
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? {},
      ip: input.ip ?? null,
      result: input.result,
      errorMessage: input.errorMessage ?? null,
    });
    return id;
  } catch (error: unknown) {
    log.error("Error logging audit event", { error: getErrorMessage(error) });
    // Don't throw - audit logging failures shouldn't block operations
    return "";
  }
}

/**
 * A single audit-log row formatted for the read API.
 */
export interface AuditLogListItem {
  id: string;
  timestamp: string | null;
  actor: string;
  action: string;
  target: string;
  ip: string;
}

export interface ListAuditLogsResult {
  logs: AuditLogListItem[];
  total: number;
}

/**
 * List audit-log entries (newest first) with limit/offset pagination.
 * Reads from the `audit_logs` D1 table.
 */
export async function listAuditLogs(
  opts: { limit: number; offset: number },
  db: DrizzleD1Database<typeof schema> = getDb(),
): Promise<ListAuditLogsResult> {
  const rows = await db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(opts.limit)
    .offset(opts.offset);

  const countResult = await db
    .select({ n: sql<number>`count(*)` })
    .from(auditLogs);
  const total = (countResult[0]?.n ?? 0) as number;

  const logs: AuditLogListItem[] = rows.map((row) => ({
    id: row.id,
    timestamp: row.createdAt ?? null,
    actor: row.actorEmail || row.actorId || "unknown",
    action: row.action ?? "unknown",
    target: row.targetId ?? row.targetType ?? "",
    ip: row.ip ?? "",
  }));

  return { logs, total };
}

/**
 * Extract client IP address from request headers.
 *
 * Prefers `cf-connecting-ip` — Cloudflare sets this to the authoritative client
 * IP and a client cannot spoof it past the edge. Falls back to `x-real-ip`, then
 * the first hop of `x-forwarded-for`. The rate limiter keys on this value, so
 * trusting the authoritative header first is what makes per-IP throttling sound.
 */
export function getClientIp(request: Request): string | null {
  // Cloudflare's authoritative client IP (cannot be spoofed past the edge).
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  // x-real-ip as the next fallback.
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2".
  // Return the first hop (the original client IP).
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  return null;
}
