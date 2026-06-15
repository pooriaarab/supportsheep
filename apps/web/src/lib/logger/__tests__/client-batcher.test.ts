import { describe, it, expect, vi } from "vitest";
import {
  createClientLogBatcher,
  type ClientLogEntry,
} from "@/lib/logger/client-batcher";

function makeEntry(i: number): ClientLogEntry {
  return {
    level: "info",
    context: "test",
    message: `msg-${i}`,
    timestamp: new Date(i).toISOString(),
  };
}

interface FakeTimer {
  setTimeout: (fn: () => void, ms: number) => { id: number };
  clearTimeout: (h: { id: number }) => void;
  tick(ms: number): void;
}

function makeFakeTimer(): FakeTimer {
  const queue: Array<{ id: number; fn: () => void; due: number }> = [];
  let now = 0;
  let nextId = 1;
  return {
    setTimeout(fn, ms) {
      const item = { id: nextId++, fn, due: now + ms };
      queue.push(item);
      return { id: item.id };
    },
    clearTimeout(h) {
      const idx = queue.findIndex((q) => q.id === h.id);
      if (idx >= 0) queue.splice(idx, 1);
    },
    tick(ms) {
      now += ms;
      const due = queue.filter((q) => q.due <= now);
      for (const d of due) queue.splice(queue.indexOf(d), 1);
      for (const d of due) d.fn();
    },
  };
}

describe("client-log batcher", () => {
  it("flushes when MAX_BATCH_SIZE entries accumulate", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const timer = makeFakeTimer();
    const batcher = createClientLogBatcher({
      fetch: fetchMock as unknown as typeof fetch,
      setTimeout: timer.setTimeout as unknown as typeof setTimeout,
      clearTimeout: timer.clearTimeout as unknown as typeof clearTimeout,
      maxBatchSize: 3,
      flushIntervalMs: 1000,
    });

    batcher.enqueue(makeEntry(1));
    batcher.enqueue(makeEntry(2));
    expect(fetchMock).not.toHaveBeenCalled();
    batcher.enqueue(makeEntry(3));
    // size-triggered flush is async; let microtasks drain.
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("Article");
    const body = JSON.parse((init as { body: string }).body) as {
      entries: ClientLogEntry[];
    };
    expect(body.entries).toHaveLength(3);
    expect(body.entries[0]?.message).toBe("msg-1");
  });

  it("flushes after the timer elapses when batch is under threshold", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const timer = makeFakeTimer();
    const batcher = createClientLogBatcher({
      fetch: fetchMock as unknown as typeof fetch,
      setTimeout: timer.setTimeout as unknown as typeof setTimeout,
      clearTimeout: timer.clearTimeout as unknown as typeof clearTimeout,
      maxBatchSize: 50,
      flushIntervalMs: 1000,
    });

    batcher.enqueue(makeEntry(1));
    batcher.enqueue(makeEntry(2));
    expect(fetchMock).not.toHaveBeenCalled();

    timer.tick(1000);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as { body: string }).body,
    ) as { entries: ClientLogEntry[] };
    expect(body.entries).toHaveLength(2);
  });

  it("flushBeacon uses sendBeacon and clears the queue", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const timer = makeFakeTimer();
    const batcher = createClientLogBatcher({
      fetch: vi.fn() as unknown as typeof fetch,
      sendBeacon,
      setTimeout: timer.setTimeout as unknown as typeof setTimeout,
      clearTimeout: timer.clearTimeout as unknown as typeof clearTimeout,
      maxBatchSize: 50,
    });

    batcher.enqueue(makeEntry(1));
    batcher.enqueue(makeEntry(2));
    expect(batcher.size()).toBe(2);

    const ok = batcher.flushBeacon();
    expect(ok).toBe(true);
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(batcher.size()).toBe(0);

    const [url, payload] = sendBeacon.mock.calls[0]!;
    expect(url).toBe("/api/v1/client-logs");
    const body = JSON.parse(payload as string) as { entries: ClientLogEntry[] };
    expect(body.entries).toHaveLength(2);
  });

  it("flushBeacon is a no-op when the queue is empty", () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const batcher = createClientLogBatcher({
      fetch: vi.fn() as unknown as typeof fetch,
      sendBeacon,
    });
    expect(batcher.flushBeacon()).toBe(true);
    expect(sendBeacon).not.toHaveBeenCalled();
  });

  it("swallows fetch failures so callers never see them", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new Error("network"));
    const timer = makeFakeTimer();
    const batcher = createClientLogBatcher({
      fetch: fetchMock as unknown as typeof fetch,
      setTimeout: timer.setTimeout as unknown as typeof setTimeout,
      clearTimeout: timer.clearTimeout as unknown as typeof clearTimeout,
      maxBatchSize: 1,
    });

    batcher.enqueue(makeEntry(1));
    // wait for the size-triggered flush to settle
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalled();
    // No throw — test passes if we reach here.
    expect(batcher.size()).toBe(0);
  });
});
