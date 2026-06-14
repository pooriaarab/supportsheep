import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  buildInterviewTokenCookie,
  mintInterviewToken,
  verifyInterviewToken,
} from "./interview-token";

describe("interview-token", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should support minting and verifying a valid token", () => {
    const interviewId = "test-interview-123";
    const token = mintInterviewToken(interviewId);
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");

    const payload = verifyInterviewToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.interviewId).toBe(interviewId);
    expect(payload?.iat).toBeTypeOf("number");
    expect(payload?.exp).toBeTypeOf("number");
  });

  it("should return null for a tampered body", () => {
    const interviewId = "test-interview-123";
    const token = mintInterviewToken(interviewId);
    const [body, sig] = token.split(".");

    // Decode, tamper body, re-encode
    const decoded = JSON.parse(Buffer.from(body, "base64url").toString());
    decoded.interviewId = "different-interview-456";
    const tamperedBody = Buffer.from(JSON.stringify(decoded)).toString("base64url");

    const tamperedToken = `${tamperedBody}.${sig}`;
    expect(verifyInterviewToken(tamperedToken)).toBeNull();
  });

  it("should return null for a tampered signature", () => {
    const interviewId = "test-interview-123";
    const token = mintInterviewToken(interviewId);
    const [body, sig] = token.split(".");

    // Alter one character of the signature
    const tamperedSig = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    const tamperedToken = `${body}.${tamperedSig}`;

    expect(verifyInterviewToken(tamperedToken)).toBeNull();
  });

  it("should return null for an expired token", () => {
    const interviewId = "test-interview-123";
    const token = mintInterviewToken(interviewId, 60); // 60s TTL

    // Advance time by 61 seconds
    vi.advanceTimersByTime(61 * 1000);

    expect(verifyInterviewToken(token)).toBeNull();
  });

  it("should successfully decode and return the wrong interview ID if token was minted for a different ID", () => {
    const interviewId1 = "interview-1";
    const token1 = mintInterviewToken(interviewId1);

    const payload = verifyInterviewToken(token1);
    expect(payload).not.toBeNull();
    expect(payload?.interviewId).not.toBe("interview-2");
    expect(payload?.interviewId).toBe("interview-1");
  });

  it("should generate distinct tokens for the same ID at different times", () => {
    const interviewId = "test-interview-123";
    const token1 = mintInterviewToken(interviewId);

    // Advance time by 10 seconds
    vi.advanceTimersByTime(10 * 1000);

    const token2 = mintInterviewToken(interviewId);
    expect(token1).not.toBe(token2);
  });

  describe("buildInterviewTokenCookie", () => {
    it("uses sameSite=lax to avoid the connect-time SSE cookie race after magic-link nav", () => {
      // SameSite=Strict (the previous setting) drove a documented production
      // symptom: the cookie was not attached on the very first same-site
      // EventSource after a cross-site magic-link arrival, which 401'd the
      // SSE connection and triggered the client's backoff/reconnect loop.
      // `lax` preserves CSRF defence on third-party POSTs while letting
      // the EventSource ship the cookie on the first attempt.
      const cookie = buildInterviewTokenCookie("int-123", "tok-xyz", 60);
      expect(cookie.options.sameSite).toBe("lax");
    });

    it("scopes the cookie path to the per-interview prefix so unrelated routes never see it", () => {
      const cookie = buildInterviewTokenCookie("int-123", "tok-xyz", 60);
      expect(cookie.options.path).toBe("/api/v1/interviews/int-123");
    });

    it("names the cookie per-interview so a leaked cookie cannot be replayed across interviews", () => {
      const cookie = buildInterviewTokenCookie("int-abc", "tok", 60);
      expect(cookie.name).toBe("interview_token_int-abc");
    });

    it("flags HttpOnly so JS cannot read or exfiltrate the token via XSS", () => {
      const cookie = buildInterviewTokenCookie("int-123", "tok", 60);
      expect(cookie.options.httpOnly).toBe(true);
    });

    it("propagates the supplied TTL into maxAge so browsers evict the cookie alongside HMAC expiry", () => {
      const cookie = buildInterviewTokenCookie("int-123", "tok", 1234);
      expect(cookie.options.maxAge).toBe(1234);
    });
  });
});
