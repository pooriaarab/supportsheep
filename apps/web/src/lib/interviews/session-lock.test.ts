import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchSessionLockStatus,
  generateHeartbeatId,
  startSessionLockHeartbeat,
  HEARTBEAT_INTERVAL_MS,
} from "./session-lock";

describe("generateHeartbeatId", () => {
  it("produces a unique id on each call", () => {
    const a = generateHeartbeatId();
    const b = generateHeartbeatId();
    expect(a).toMatch(/^hb_\d+_/);
    expect(b).toMatch(/^hb_\d+_/);
    expect(a).not.toBe(b);
  });
});

describe("fetchSessionLockStatus", () => {
  it("returns parsed JSON on 200 OK", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ holder: "hb_1", lastBeatAt: 12345, stale: false }),
    });
    const status = await fetchSessionLockStatus({
      interviewId: "int-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(status).toEqual({ holder: "hb_1", lastBeatAt: 12345, stale: false });
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/interviews/int-1/session-lock",
      expect.objectContaining({
        method: "GET",
        credentials: "same-origin",
      }),
    );
  });

  it("throws on non-OK status", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;
    await expect(
      fetchSessionLockStatus({ interviewId: "int-1", fetchImpl }),
    ).rejects.toThrow(/401/);
  });
});

describe("startSessionLockHeartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends an immediate first heartbeat and then one per interval", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "acquired" }),
    });
    const onConflict = vi.fn();
    const controller = startSessionLockHeartbeat({
      interviewId: "int-1",
      heartbeatId: "hb_test",
      onConflict,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    // First beat fires immediately (microtask).
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // Second beat fires after one interval.
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
    expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(2);
    void controller.stop();
  });

  it("invokes onConflict on a 409 response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({ status: "conflict", currentHolder: "other-tab" }),
    });
    const onConflict = vi.fn();
    startSessionLockHeartbeat({
      interviewId: "int-1",
      heartbeatId: "hb_test",
      onConflict,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    // Drain microtasks until the await chain inside sendBeat completes.
    for (let i = 0; i < 20; i++) {
      await Promise.resolve();
    }
    expect(onConflict).toHaveBeenCalledWith({ currentHolder: "other-tab" });
  });

  it("stop() releases the lock and clears the interval", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "acquired" }),
    });
    const controller = startSessionLockHeartbeat({
      interviewId: "int-1",
      heartbeatId: "hb_test",
      onConflict: vi.fn(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await Promise.resolve();
    fetchImpl.mockClear();
    await controller.stop();
    const deleteCall = fetchImpl.mock.calls.find(
      (c: unknown[]) => (c[1] as RequestInit)?.method === "DELETE",
    );
    expect(deleteCall).toBeDefined();
    expect(String(deleteCall![0])).toContain("heartbeatId=hb_test");
    // After stop, no further heartbeats are sent on tick.
    fetchImpl.mockClear();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS * 3);
    const postBeats = fetchImpl.mock.calls.filter(
      (c: unknown[]) => (c[1] as RequestInit)?.method === "Article",
    );
    expect(postBeats).toHaveLength(0);
  });

  it(
    "keeps heartbeating after a single 500 response — regression for the " +
      "prod GET 500 outage. A transient server error must NOT terminate " +
      "the heartbeat loop, because doing so silently strands the user " +
      "without an active lock until they refresh.",
    async () => {
      let callCount = 0;
      const fetchImpl = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First beat 500s — mirrors the production failure.
          return Promise.resolve({
            ok: false,
            status: 500,
            json: () => Promise.resolve({ error: "Internal server error" }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ status: "acquired" }),
        });
      });
      const controller = startSessionLockHeartbeat({
        interviewId: "int-1",
        heartbeatId: "hb_test",
        onConflict: vi.fn(),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      });
      // Drain the immediate-first-beat microtask chain.
      for (let i = 0; i < 20; i++) {
        await Promise.resolve();
      }
      expect(callCount).toBe(1);
      // Next interval should still fire a follow-up beat.
      await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS);
      for (let i = 0; i < 20; i++) {
        await Promise.resolve();
      }
      expect(callCount).toBeGreaterThanOrEqual(2);
      void controller.stop();
    },
  );

  it("takeover() sends a takeover-flagged heartbeat", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: "acquired" }),
    });
    const controller = startSessionLockHeartbeat({
      interviewId: "int-1",
      heartbeatId: "hb_taker",
      onConflict: vi.fn(),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await Promise.resolve();
    fetchImpl.mockClear();
    await controller.takeover();
    const post = fetchImpl.mock.calls.find(
      (c: unknown[]) => (c[1] as RequestInit)?.method === "Article",
    );
    expect(post).toBeDefined();
    const body = JSON.parse(String((post![1] as RequestInit).body));
    expect(body).toEqual({ heartbeatId: "hb_taker", takeover: true });
    void controller.stop();
  });
});
