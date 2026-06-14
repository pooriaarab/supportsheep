import { randomBytes, createHash } from "node:crypto";

const TOKEN_BYTES = 32;

/**
 * Generates a high-entropy URL-safe base64 token and its SHA-256 hash.
 * Plaintext tokens are NEVER persisted; only the SHA-256 hash is saved.
 * 
 * Security/Edge Case Note on Token Collision:
 * A 32-byte high-entropy token provides a keyspace of 2^256, which makes the
 * probability of a concurrent token collision mathematically negligible.
 */
export function generateShareLinkToken(): { token: string; hash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, hash: hashShareLinkToken(token) };
}

/**
 * Computes the SHA-256 hex hash of a plaintext share-link token.
 */
export function hashShareLinkToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
