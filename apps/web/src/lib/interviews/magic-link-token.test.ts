import { describe, expect, it } from "vitest";
import {
  generateMagicLinkToken,
  hashMagicLinkToken,
} from "./magic-link-token";

describe("magic-link-token", () => {
  it("should generate unique tokens", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const { token } = generateMagicLinkToken();
      expect(tokens.has(token)).toBe(false);
      tokens.add(token);
    }
    expect(tokens.size).toBe(100);
  });

  it("should hash deterministically (same token -> same hash)", () => {
    const { token, hash } = generateMagicLinkToken();
    const hash2 = hashMagicLinkToken(token);
    const hash3 = hashMagicLinkToken(token);

    expect(hash).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it("should have generateMagicLinkToken hash match hashMagicLinkToken", () => {
    const { token, hash } = generateMagicLinkToken();
    expect(hashMagicLinkToken(token)).toBe(hash);
  });

  it("should generate URL-safe base64 tokens (no +, /, =)", () => {
    for (let i = 0; i < 100; i++) {
      const { token } = generateMagicLinkToken();
      expect(token).not.toContain("+");
      expect(token).not.toContain("/");
      expect(token).not.toContain("=");
      expect(token).match(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("should decode to exactly 32 bytes", () => {
    const { token } = generateMagicLinkToken();
    const buffer = Buffer.from(token, "base64url");
    expect(buffer.length).toBe(32);
  });
});
