import { describe, expect, it } from "vitest";
import {
  generateShareLinkToken,
  hashShareLinkToken,
} from "./share-link-token";

describe("share-link-token", () => {
  it("should generate unique tokens", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const { token } = generateShareLinkToken();
      expect(tokens.has(token)).toBe(false);
      tokens.add(token);
    }
    expect(tokens.size).toBe(100);
  });

  it("should hash deterministically (same token -> same hash)", () => {
    const { token, hash } = generateShareLinkToken();
    const hash2 = hashShareLinkToken(token);
    const hash3 = hashShareLinkToken(token);

    expect(hash).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it("should have generateShareLinkToken hash match hashShareLinkToken", () => {
    const { token, hash } = generateShareLinkToken();
    expect(hashShareLinkToken(token)).toBe(hash);
  });

  it("should generate URL-safe base64 tokens (no +, /, =)", () => {
    for (let i = 0; i < 100; i++) {
      const { token } = generateShareLinkToken();
      expect(token).not.toContain("+");
      expect(token).not.toContain("/");
      expect(token).not.toContain("=");
      // Check base64url regex
      expect(token).match(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("should decode to exactly 32 bytes", () => {
    const { token } = generateShareLinkToken();
    const buffer = Buffer.from(token, "base64url");
    expect(buffer.length).toBe(32);
  });
});
