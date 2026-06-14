import { describe, it, expect, vi } from "vitest";
import { withStructuredLog, type Logger } from "@/lib/logger";

function makeFakeLogger(): Logger & {
  calls: {
    debug: Array<[string, Record<string, unknown> | undefined]>;
    info: Array<[string, Record<string, unknown> | undefined]>;
    warn: Array<[string, Record<string, unknown> | undefined]>;
    error: Array<[string, Record<string, unknown> | undefined]>;
  };
} {
  const calls = {
    debug: [] as Array<[string, Record<string, unknown> | undefined]>,
    info: [] as Array<[string, Record<string, unknown> | undefined]>,
    warn: [] as Array<[string, Record<string, unknown> | undefined]>,
    error: [] as Array<[string, Record<string, unknown> | undefined]>,
  };
  return {
    debug: (message, data) => {
      calls.debug.push([message, data]);
    },
    info: (message, data) => {
      calls.info.push([message, data]);
    },
    warn: (message, data) => {
      calls.warn.push([message, data]);
    },
    error: (message, data) => {
      calls.error.push([message, data]);
    },
    calls,
  };
}

describe("withStructuredLog", () => {
  it("logs start and completed on success and returns the value", async () => {
    const log = makeFakeLogger();
    const fn = vi.fn().mockResolvedValue("ok-value");

    const result = await withStructuredLog(
      log,
      "anthropic.messages.create",
      { interviewId: "abc", model: "claude-sonnet-4-6" },
      fn,
    );

    expect(result).toBe("ok-value");
    expect(fn).toHaveBeenCalledTimes(1);

    expect(log.calls.info).toHaveLength(2);
    const [startMsg, startData] = log.calls.info[0]!;
    expect(startMsg).toBe("anthropic.messages.create started");
    expect(startData).toEqual({
      interviewId: "abc",
      model: "claude-sonnet-4-6",
    });

    const [endMsg, endData] = log.calls.info[1]!;
    expect(endMsg).toBe("anthropic.messages.create completed");
    expect(endData).toMatchObject({
      interviewId: "abc",
      model: "claude-sonnet-4-6",
      status: "success",
    });
    expect(typeof endData?.durationMs).toBe("number");
    expect(endData?.durationMs as number).toBeGreaterThanOrEqual(0);

    expect(log.calls.error).toHaveLength(0);
  });

  it("logs start and failed on throw and re-raises the original error", async () => {
    const log = makeFakeLogger();
    const original = new TypeError("upstream timeout");
    const fn = vi.fn().mockRejectedValue(original);

    await expect(
      withStructuredLog(
        log,
        "openai.realtime.mint",
        { interviewId: "xyz" },
        fn,
      ),
    ).rejects.toBe(original);

    expect(log.calls.info).toHaveLength(1);
    expect(log.calls.info[0]?.[0]).toBe("openai.realtime.mint started");

    expect(log.calls.error).toHaveLength(1);
    const [errMsg, errData] = log.calls.error[0]!;
    expect(errMsg).toBe("openai.realtime.mint failed");
    expect(errData).toMatchObject({
      interviewId: "xyz",
      status: "failed",
      errorMessage: "upstream timeout",
      errorKind: "TypeError",
    });
    expect(typeof errData?.durationMs).toBe("number");
    expect(typeof errData?.errorStack).toBe("string");
  });

  it("handles non-Error throwables with errorKind=unknown", async () => {
    const log = makeFakeLogger();
    const fn = vi.fn().mockRejectedValue("string-thrown");

    await expect(
      withStructuredLog(log, "tavus.mint", {}, fn),
    ).rejects.toBe("string-thrown");

    const [, errData] = log.calls.error[0]!;
    expect(errData).toMatchObject({
      status: "failed",
      errorMessage: "string-thrown",
      errorKind: "unknown",
    });
    expect(errData?.errorStack).toBeUndefined();
  });

  it("preserves caller-supplied context fields across start and completed logs", async () => {
    const log = makeFakeLogger();
    await withStructuredLog(
      log,
      "op",
      { interviewId: "i1", route: "/end", provider: "anthropic" },
      async () => "x",
    );

    const [, startData] = log.calls.info[0]!;
    const [, endData] = log.calls.info[1]!;
    expect(startData).toMatchObject({
      interviewId: "i1",
      route: "/end",
      provider: "anthropic",
    });
    expect(endData).toMatchObject({
      interviewId: "i1",
      route: "/end",
      provider: "anthropic",
      status: "success",
    });
  });
});
