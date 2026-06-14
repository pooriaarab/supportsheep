import { describe, expect, it, beforeEach } from "vitest";
import {
  checkRateLimit,
  clearRateState,
  IDEMPOTENCY_LRU_SIZE,
  lookupIdempotent,
  MAX_TOOL_ARGS_BYTES,
  MAX_TOOL_CALLS_PER_MINUTE,
  MAX_TOOL_CALLS_PER_SESSION,
  measureArgsBytes,
  RATE_WINDOW_MS,
  rateLimitedResult,
  recordDispatch,
  rememberIdempotent,
} from "./tool-rate-limit";
import type { ToolResult } from "./tools/_types";

const ID = "int-rate-test";

describe("tool-rate-limit", () => {
  beforeEach(() => {
    clearRateState(ID);
  });

  describe("checkRateLimit", () => {
    it("returns allowed for an empty session", () => {
      const result = checkRateLimit(ID);
      expect(result.allowed).toBe(true);
    });

    it("denies once the per-session cap is reached", () => {
      for (let i = 0; i < MAX_TOOL_CALLS_PER_SESSION; i++) {
        recordDispatch(ID, Date.now() - 1_000_000); // outside minute window
      }
      const result = checkRateLimit(ID);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("session_cap");
    });

    it("denies once the per-minute cap is reached but resets after the window slides", () => {
      const t0 = 1_000_000;
      for (let i = 0; i < MAX_TOOL_CALLS_PER_MINUTE; i++) {
        recordDispatch(ID, t0 + i);
      }
      const blocked = checkRateLimit(ID, t0 + MAX_TOOL_CALLS_PER_MINUTE);
      expect(blocked.allowed).toBe(false);
      expect(blocked.reason).toBe("minute_cap");
      expect(blocked.retryAfterMs).toBeGreaterThan(0);

      // Advance time past the window — the sliding window should drop
      // the earlier timestamps so the next check passes.
      const afterWindow = t0 + RATE_WINDOW_MS + 1;
      const released = checkRateLimit(ID, afterWindow);
      expect(released.allowed).toBe(true);
    });

    it("session_cap takes priority over minute_cap", () => {
      // Fill both buckets — session cap should be reported first.
      for (let i = 0; i < MAX_TOOL_CALLS_PER_SESSION; i++) {
        recordDispatch(ID, Date.now());
      }
      const blocked = checkRateLimit(ID);
      expect(blocked.allowed).toBe(false);
      expect(blocked.reason).toBe("session_cap");
    });
  });

  describe("rateLimitedResult", () => {
    it("builds a structured ToolResult with retryAfterMs", () => {
      const r = rateLimitedResult({
        allowed: false,
        reason: "minute_cap",
        retryAfterMs: 1234,
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.category).toBe("rate_limited");
        expect(r.retryAfterMs).toBe(1234);
        expect(r.message).toContain(String(MAX_TOOL_CALLS_PER_MINUTE));
      }
    });
  });

  describe("idempotency", () => {
    it("returns the cached result for a repeated callId", () => {
      const result: ToolResult = { ok: true, summary: "first" };
      rememberIdempotent(ID, "call-1", result);
      const cached = lookupIdempotent(ID, "call-1");
      expect(cached).toEqual(result);
    });

    it("returns undefined when callId is unknown or missing", () => {
      expect(lookupIdempotent(ID, "missing")).toBeUndefined();
      expect(lookupIdempotent(ID, undefined)).toBeUndefined();
    });

    it("evicts oldest entries past the LRU size", () => {
      for (let i = 0; i < IDEMPOTENCY_LRU_SIZE + 10; i++) {
        rememberIdempotent(ID, `call-${i}`, { ok: true, summary: String(i) });
      }
      // The oldest 10 entries should be evicted.
      for (let i = 0; i < 10; i++) {
        expect(lookupIdempotent(ID, `call-${i}`)).toBeUndefined();
      }
      // The most recent entries are still present.
      expect(lookupIdempotent(ID, `call-${IDEMPOTENCY_LRU_SIZE + 9}`)).toBeDefined();
    });

    it("clearRateState wipes idempotency entries", () => {
      rememberIdempotent(ID, "call-x", { ok: true });
      clearRateState(ID);
      expect(lookupIdempotent(ID, "call-x")).toBeUndefined();
    });
  });

  describe("measureArgsBytes", () => {
    it("returns the JSON length for plain objects", () => {
      expect(measureArgsBytes({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length);
    });

    it("returns null for cyclic structures", () => {
      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;
      expect(measureArgsBytes(cyclic)).toBeNull();
    });

    it("flags payloads larger than the cap", () => {
      const big = { content: "x".repeat(MAX_TOOL_ARGS_BYTES + 1) };
      expect(measureArgsBytes(big)).toBeGreaterThan(MAX_TOOL_ARGS_BYTES);
    });
  });
});
