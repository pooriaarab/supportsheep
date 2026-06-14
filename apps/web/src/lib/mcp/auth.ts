/**
 * MCP Authentication
 *
 * Validates Bearer tokens against API keys stored in D1 (via api-keys repo).
 * findApiKeyByToken SHA-256-hashes the token and performs a single indexed
 * lookup — no need for client-side timing-safe loops.
 */

import "server-only";

import {
  findApiKeyByToken,
  touchApiKeyLastUsed,
} from "@/lib/api-keys/repository";
import { getMembershipForBlog } from "@/lib/tenancy/repository";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:mcp:auth");

/** Resolved identity for an authenticated MCP request. */
export interface McpAuthContext {
  apiKeyId: string;
  ownerId: string;
  blogId: string;
}

/**
 * Validate a Bearer token against stored API keys.
 *
 * Returns the resolved { apiKeyId, ownerId, blogId } when the token is valid
 * AND the key's owner still has an active membership on the key's blog
 * (defense-in-depth against revoked access). Returns null otherwise — the
 * route maps null to 401.
 */
export async function validateMcpToken(
  authHeader: string | null,
): Promise<McpAuthContext | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token || token.length < 10) {
    return null;
  }

  try {
    const result = await findApiKeyByToken(token);
    if (!result) return null;

    // Defense-in-depth: the key is bound to a blog, but the owner's membership
    // on that blog may have been revoked since the key was issued. Reject if
    // the owner no longer has an active membership on the key's blog.
    const membership = await getMembershipForBlog(
      result.ownerId,
      result.blogId,
    );
    if (!membership) {
      log.warn("MCP key owner lacks membership on key's blog", {
        apiKeyId: result.id,
        ownerId: result.ownerId,
        blogId: result.blogId,
      });
      return null;
    }

    // Fire-and-forget last-used telemetry; must never block or fail auth.
    touchApiKeyLastUsed(result.id).catch((error: unknown) => {
      log.warn("Failed to update API key lastUsed", { error });
    });

    return {
      apiKeyId: result.id,
      ownerId: result.ownerId,
      blogId: result.blogId,
    };
  } catch (error) {
    log.error("Failed to validate MCP token", { error });
    return null;
  }
}
