import { describe, it, expect } from "vitest";
import { redactLogEntry, redactValue } from "@/lib/logger/redact-pii";

describe("redactValue", () => {
  it("redacts strings containing sensitive substrings (case-insensitive)", () => {
    expect(redactValue("Bearer abc123")).toBe("[REDACTED]");
    expect(redactValue("session-TOKEN-xyz")).toBe("[REDACTED]");
    expect(redactValue("cookie=ses123")).toBe("[REDACTED]");
    expect(redactValue("user PASSWORD reset")).toBe("[REDACTED]");
    expect(redactValue("sk_live_apikey_abc")).toBe("[REDACTED]");
  });

  it("leaves clean strings untouched", () => {
    expect(redactValue("hello world")).toBe("hello world");
    expect(redactValue("")).toBe("");
  });

  it("redacts values for sensitive keys regardless of value content", () => {
    const out = redactValue({ apiKey: "anything", normal: "ok" });
    expect(out).toEqual({ apiKey: "[REDACTED]", normal: "ok" });
  });

  it("walks nested objects and arrays", () => {
    const out = redactValue({
      meta: {
        headers: { authorization: "Bearer xyz" },
        tags: ["plain", "Token: abc"],
      },
    });
    expect(out).toEqual({
      meta: {
        headers: { authorization: "[REDACTED]" },
        tags: ["plain", "[REDACTED]"],
      },
    });
  });

  it("preserves non-string scalar values", () => {
    expect(redactValue(42)).toBe(42);
    expect(redactValue(true)).toBe(true);
    expect(redactValue(null)).toBeNull();
    expect(redactValue(undefined)).toBeUndefined();
  });
});

describe("redactLogEntry", () => {
  it("redacts message and data tree", () => {
    const out = redactLogEntry({
      message: "received Bearer token xyz",
      data: { headers: { cookie: "abc" }, ok: 1 },
    });
    expect(out.message).toBe("[REDACTED]");
    expect(out.data).toEqual({ headers: { cookie: "[REDACTED]" }, ok: 1 });
  });

  it("returns clean entries untouched", () => {
    const out = redactLogEntry({
      message: "user navigated",
      data: { path: "/posts/123", durationMs: 12 },
    });
    expect(out.message).toBe("user navigated");
    expect(out.data).toEqual({ path: "/posts/123", durationMs: 12 });
  });

  it("handles missing data", () => {
    const out = redactLogEntry({ message: "hi" });
    expect(out).toEqual({ message: "hi", data: undefined });
  });
});
