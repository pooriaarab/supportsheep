import { describe, expect, test, vi, beforeEach } from "vitest";

const infoSpy = vi.hoisted(() => vi.fn());
const errorSpy = vi.hoisted(() => vi.fn());
const warnSpy = vi.hoisted(() => vi.fn());
const debugSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: infoSpy,
    error: errorSpy,
    warn: warnSpy,
    debug: debugSpy,
  }),
}));

// Imported after the mock so the module-level `createLogger` call binds to
// the spies above.
import {
  summarizeToolArgs,
  withToolCallLogging,
} from "./tool-call-logger";

describe("tool-call-logger", () => {
  beforeEach(() => {
    infoSpy.mockClear();
    errorSpy.mockClear();
    warnSpy.mockClear();
    debugSpy.mockClear();
  });

  describe("withToolCallLogging — happy path", () => {
    test("emits invoked then completed with a shared callId", async () => {
      const result = await withToolCallLogging(
        {
          interviewId: "int-abc",
          toolName: "add_heading",
          callId: "call-fixed-123",
          argsSummary: "add_heading(text.length=12 level=2)",
        },
        async () => "ok-result",
      );

      expect(result).toBe("ok-result");
      expect(infoSpy).toHaveBeenCalledTimes(2);
      expect(errorSpy).not.toHaveBeenCalled();

      const [invokedMsg, invokedData] = infoSpy.mock.calls[0]!;
      expect(invokedMsg).toBe("Realtime AI tool invoked");
      expect(invokedData).toMatchObject({
        interviewId: "int-abc",
        toolName: "add_heading",
        callId: "call-fixed-123",
        argsSummary: "add_heading(text.length=12 level=2)",
        status: "invoked",
      });

      const [completedMsg, completedData] = infoSpy.mock.calls[1]!;
      expect(completedMsg).toBe("Realtime AI tool completed");
      expect(completedData).toMatchObject({
        interviewId: "int-abc",
        toolName: "add_heading",
        callId: "call-fixed-123",
        status: "success",
      });
      // callId is shared across both lifecycle lines so a gcloud query on
      // jsonPayload.callId returns the full invoke→complete pair.
      expect((completedData as { callId: string }).callId).toBe(
        (invokedData as { callId: string }).callId,
      );
      expect(typeof (completedData as { durationMs: number }).durationMs).toBe(
        "number",
      );
    });

    test("uses resultSummarizer when provided", async () => {
      await withToolCallLogging(
        {
          interviewId: "int-1",
          toolName: "finalize_section",
          argsSummary: 'finalize_section(sectionId="section-1")',
        },
        async () => ({ sectionId: "section-1", finalized: true }),
        (r) => `sectionId=${r.sectionId} finalized=${r.finalized}`,
      );

      const [, completedData] = infoSpy.mock.calls[1]!;
      expect((completedData as { resultSummary: string }).resultSummary).toBe(
        "sectionId=section-1 finalized=true",
      );
    });

    test("mints a uuid when no callId is supplied", async () => {
      await withToolCallLogging(
        {
          interviewId: "int-1",
          toolName: "add_bullet",
          argsSummary: "add_bullet(text.length=20)",
        },
        () => undefined,
      );

      const [, invokedData] = infoSpy.mock.calls[0]!;
      const [, completedData] = infoSpy.mock.calls[1]!;
      const invokedCallId = (invokedData as { callId: string }).callId;
      const completedCallId = (completedData as { callId: string }).callId;

      expect(invokedCallId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(invokedCallId).toBe(completedCallId);
    });

    test("falls back to 'ok' when resultSummarizer throws", async () => {
      await withToolCallLogging(
        {
          interviewId: "int-1",
          toolName: "add_heading",
          argsSummary: "add_heading()",
        },
        async () => "ignored",
        () => {
          throw new Error("summarizer blew up");
        },
      );

      const [, completedData] = infoSpy.mock.calls[1]!;
      expect((completedData as { resultSummary: string }).resultSummary).toBe(
        "ok",
      );
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe("withToolCallLogging — error path", () => {
    test("emits invoked then failed and re-throws the original error", async () => {
      const boom = new Error("anthropic timeout");
      (boom as Error & { code?: string }).code = "ETIMEDOUT";

      await expect(
        withToolCallLogging(
          {
            interviewId: "int-err",
            toolName: "add_heading",
            callId: "call-err-1",
            argsSummary: "add_heading(text.length=5)",
          },
          async () => {
            throw boom;
          },
        ),
      ).rejects.toBe(boom);

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);

      const [invokedMsg] = infoSpy.mock.calls[0]!;
      expect(invokedMsg).toBe("Realtime AI tool invoked");

      const [failedMsg, failedData] = errorSpy.mock.calls[0]!;
      expect(failedMsg).toBe("Realtime AI tool failed");
      expect(failedData).toMatchObject({
        interviewId: "int-err",
        toolName: "add_heading",
        callId: "call-err-1",
        status: "failed",
        errorMessage: "anthropic timeout",
        errorCode: "ETIMEDOUT",
      });
      expect(typeof (failedData as { durationMs: number }).durationMs).toBe(
        "number",
      );
    });

    test("string-thrown errors still produce a structured failed line", async () => {
      await expect(
        withToolCallLogging(
          {
            interviewId: "int-err",
            toolName: "add_quote",
            argsSummary: "add_quote(text.length=40)",
          },
          () => {
            throw "non-error string thrown";
          },
        ),
      ).rejects.toBe("non-error string thrown");

      expect(errorSpy).toHaveBeenCalledTimes(1);
      const [, failedData] = errorSpy.mock.calls[0]!;
      expect(failedData).toMatchObject({
        status: "failed",
        errorMessage: "non-error string thrown",
      });
    });
  });

  describe("summarizeToolArgs", () => {
    test("redacts long strings into length tokens", () => {
      const summary = summarizeToolArgs("add_heading", {
        text: "A very long heading that contains sensitive user-typed content",
        level: 2,
      });
      expect(summary).toContain("text.length=");
      expect(summary).toContain("level=2");
      expect(summary).not.toContain("sensitive");
    });

    test("keeps identifier-shaped short strings verbatim", () => {
      const summary = summarizeToolArgs("finalize_section", {
        sectionId: "section-3",
      });
      expect(summary).toBe('finalize_section(sectionId="section-3")');
    });

    test("handles arrays, nulls, and non-object args", () => {
      expect(summarizeToolArgs("noop", null)).toBe("no_args");
      expect(summarizeToolArgs("noop", undefined)).toBe("no_args");
      expect(summarizeToolArgs("noop", 42)).toBe("arg_type=number");
      expect(
        summarizeToolArgs("noop", { items: [1, 2, 3], nested: { a: 1 } }),
      ).toBe("noop(items.count=3 nested=object)");
    });
  });
});
