import { randomBytes, createHash } from "node:crypto";

const TOKEN_BYTES = 32;

/**
 * Generates a high-entropy URL-safe base64 token and its SHA-256 hash.
 * Plaintext tokens are NEVER persisted; only the SHA-256 hash is saved.
 */
export function generateMagicLinkToken(): { token: string; hash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, hash: hashMagicLinkToken(token) };
}

/**
 * Computes the SHA-256 hex hash of a plaintext magic-link token.
 */
export function hashMagicLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
