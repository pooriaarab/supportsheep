import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import type { ToolResult } from "./_types";

// Mocks must be declared BEFORE the import-under-test so vitest's
// hoisting kicks in cleanly. Interview events + the cost-cap read now run on
// D1; we mock the repositories directly.

const mockToolExecutionsInsert = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined),
);
const mockAppendEvents = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSumMonthlyCost = vi.hoisted(() => vi.fn().mockResolvedValue(0));
const mockGetBlogConfig = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ interview: { monthlyCostCapUsd: null } }),
);

vi.mock("@/lib/interviews/events-repository", () => ({
  appendEvents: (...args: unknown[]) => mockAppendEvents(...args),
}));

vi.mock("@/lib/interviews/interviews-repository", () => ({
  sumMonthlyInterviewCostUsd: (...args: unknown[]) =>
    mockSumMonthlyCost(...args),
}));

vi.mock("../tool-executions-repository", () => ({
  insertToolExecution: mockToolExecutionsInsert,
}));

vi.mock("@/lib/blog-config", () => ({
  getBlogConfig: mockGetBlogConfig,
}));

/** Flatten the events passed across all `appendEvents` calls. */
function allEvents(): Array<{ kind: string; payload: Record<string, unknown> }> {
  return mockAppendEvents.mock.calls.flatMap(
    (c) => (c[2] as Array<{ kind: string; payload: Record<string, unknown> }>),
  );
}

// Imported after the mocks so the module-under-test binds to the mocked
// `@/lib/db` and `@/lib/blog-config` rather than the real Firebase admin.
import {
  buildToolContext,
  clearSessionState,
  dispatchTool,
} from "./index";
import { WriterWorker } from "../writer-worker";
import {
  clearRateState,
  MAX_TOOL_ARGS_BYTES,
  MAX_TOOL_CALLS_PER_MINUTE,
  MAX_TOOL_CALLS_PER_SESSION,
} from "../tool-rate-limit";

function makeCtx(interviewId: string) {
  const worker = new WriterWorker({ interviewId, apiKey: "test-key" });
  return {
    ctx: buildToolContext({ interviewId, worker }),
    worker,
  };
}

function resetSession(interviewId: string) {
  clearSessionState(interviewId);
  clearRateState(interviewId);
}

describe("tool dispatcher hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBlogConfig.mockResolvedValue({
      interview: { monthlyCostCapUsd: null },
    });
    mockSumMonthlyCost.mockResolvedValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("argument size cap", () => {
    it("rejects args exceeding MAX_TOOL_ARGS_BYTES before invoking the handler", async () => {
      const id = "int-args-too-large";
      resetSession(id);
      const { ctx, worker } = makeCtx(id);

      const huge = "x".repeat(MAX_TOOL_ARGS_BYTES + 100);
      const result = await dispatchTool("add_heading", { text: huge }, ctx);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.category).toBe("args_too_large");
      }
      // Handler never ran — no section added.
      expect(worker.getCanvas().sections).toHaveLength(0);
    });
  });

  describe("global per-session rate limit", () => {
    it("blocks dispatch once the per-session cap is reached and resets on session end", async () => {
      const id = "int-session-cap";
      resetSession(id);
      const { ctx } = makeCtx(id);

      // Pre-fill the per-session counter so we don't need to fire 200
      // real dispatches to exercise the cap.
      const { recordDispatch } = await import("../tool-rate-limit");
      for (let i = 0; i < MAX_TOOL_CALLS_PER_SESSION; i++) {
        recordDispatch(id, Date.now() - 1_000_000);
      }

      const blocked = await dispatchTool("add_heading", { text: "Hi" }, ctx);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.category).toBe("rate_limited");
      }

      // After clearSessionState the budget is fresh.
      clearSessionState(id);
      const after = await dispatchTool("add_heading", { text: "Hi" }, ctx);
      expect(after.ok).toBe(true);
    });
  });

  describe("per-minute sliding rate limit", () => {
    it("blocks past MAX_TOOL_CALLS_PER_MINUTE within a single minute and recovers as the window slides", async () => {
      const id = "int-minute-cap";
      resetSession(id);
      const { ctx } = makeCtx(id);

      const { recordDispatch } = await import("../tool-rate-limit");
      const t0 = Date.now();
      for (let i = 0; i < MAX_TOOL_CALLS_PER_MINUTE; i++) {
        recordDispatch(id, t0 + i);
      }

      // Cap hit — next dispatch should be rate_limited.
      const blocked = await dispatchTool("add_heading", { text: "x" }, ctx);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.category).toBe("rate_limited");
        expect(blocked.retryAfterMs).toBeGreaterThanOrEqual(0);
      }

      // Slide the window by clearing state — equivalent to "60s passed".
      resetSession(id);
      const after = await dispatchTool("add_heading", { text: "x" }, ctx);
      expect(after.ok).toBe(true);
    });
  });

  describe("idempotency", () => {
    it("invokes the handler once for two dispatches sharing the same callId", async () => {
      const id = "int-idempotent";
      resetSession(id);
      const { ctx, worker } = makeCtx(id);

      const first = await dispatchTool(
        "add_heading",
        { text: "Once" },
        ctx,
        { callId: "abc-123" },
      );
      const second = await dispatchTool(
        "add_heading",
        { text: "Once" },
        ctx,
        { callId: "abc-123" },
      );

      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      // The second call returned the cached ack — only one section.
      expect(worker.getCanvas().sections).toHaveLength(1);
      // Same exact object identity is the strongest evidence of cache hit.
      expect(second).toBe(first);
    });

    it("treats distinct callIds as independent dispatches", async () => {
      const id = "int-idempotent-distinct";
      resetSession(id);
      const { ctx, worker } = makeCtx(id);

      await dispatchTool("add_heading", { text: "A" }, ctx, { callId: "c-1" });
      await dispatchTool("add_heading", { text: "B" }, ctx, { callId: "c-2" });
      expect(worker.getCanvas().sections).toHaveLength(2);
    });
  });

  describe("upstream 429 / 5xx handling", () => {
    it("maps a 429 into upstream_error and emits a tool_failed event without throwing", async () => {
      const id = "int-upstream-429";
      resetSession(id);
      const { ctx } = makeCtx(id);

      const headingMod = await import("./add-heading");
      const original = headingMod.default;
      const originalHandler = original.handler;
      try {
        Object.assign(original, {
          handler: () => {
            const err = new Error("Rate limit") as Error & {
              status: number;
              headers: Record<string, string>;
            };
            err.status = 429;
            err.headers = { "retry-after": "3" };
            throw err;
          },
        });

        const result = await dispatchTool(
          "add_heading",
          { text: "X" },
          ctx,
          { callId: "upstream-1" },
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.category).toBe("upstream_error");
          expect(result.retryAfterMs).toBe(3000);
        }

        // tool_failed SSE event was written to the events subcollection.
        // A `tool_result` event is also written alongside it (narration cue
        // pipeline) — the assertion just needs to find the tool_failed one.
        const failedPayload = allEvents().find((p) => p.kind === "tool_failed");
        expect(failedPayload).toBeDefined();
        expect(failedPayload!.payload.toolName).toBe("add_heading");
        expect(failedPayload!.payload.callId).toBe("upstream-1");
        expect(failedPayload!.payload.errorKind).toBe("upstream_error");
      } finally {
        Object.assign(original, { handler: originalHandler });
      }
    });

    it("maps a 503 into upstream_error", async () => {
      const id = "int-upstream-503";
      resetSession(id);
      const { ctx } = makeCtx(id);

      const headingMod = await import("./add-heading");
      const original = headingMod.default;
      const originalHandler = original.handler;
      try {
        Object.assign(original, {
          handler: () => {
            const err = new Error("Service unavailable") as Error & {
              response: { status: number };
            };
            err.response = { status: 503 };
            throw err;
          },
        });

        const result = await dispatchTool("add_heading", { text: "X" }, ctx);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.category).toBe("upstream_error");
        }
      } finally {
        Object.assign(original, { handler: originalHandler });
      }
    });

    it("non-HTTP errors still surface as permanent (no tool_failed SSE)", async () => {
      const id = "int-permanent";
      resetSession(id);
      const { ctx } = makeCtx(id);

      const headingMod = await import("./add-heading");
      const original = headingMod.default;
      const originalHandler = original.handler;
      try {
        Object.assign(original, {
          handler: () => {
            throw new Error("plain bug");
          },
        });

        const result = await dispatchTool("add_heading", { text: "X" }, ctx);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.category).toBe("permanent");
        }
        // No tool_failed event for permanent (non-upstream) errors —
        // the narration `tool_result` event may still fire, but the
        // dispatcher must not write a tool_failed for control-flow
        // errors like validation/not-found/permanent.
        const failedCalls = allEvents().filter((p) => p.kind === "tool_failed");
        expect(failedCalls).toHaveLength(0);
      } finally {
        Object.assign(original, { handler: originalHandler });
      }
    });
  });

  describe("workspace cost-cap audit", () => {
    it("refuses dispatch with cost_cap_exceeded BEFORE calling the handler when total >= cap", async () => {
      const id = "int-cost-cap";
      resetSession(id);
      const { ctx, worker } = makeCtx(id);

      mockGetBlogConfig.mockResolvedValue({
        interview: { monthlyCostCapUsd: 10 },
      });
      mockSumMonthlyCost.mockResolvedValue(15);

      const headingMod = await import("./add-heading");
      const original = headingMod.default;
      try {
        // Flip `incursLlmCost` so the dispatcher runs the cost-cap check.
        Object.assign(original, { incursLlmCost: true });

        const result = await dispatchTool("add_heading", { text: "X" }, ctx);

        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.category).toBe("cost_cap_exceeded");
        }
        // Handler never ran.
        expect(worker.getCanvas().sections).toHaveLength(0);
      } finally {
        delete (original as { incursLlmCost?: boolean }).incursLlmCost;
      }
    });

    it("ignores cost-cap when the tool does not incur LLM cost", async () => {
      const id = "int-cost-cap-no-llm";
      resetSession(id);
      const { ctx, worker } = makeCtx(id);

      mockGetBlogConfig.mockResolvedValue({
        interview: { monthlyCostCapUsd: 10 },
      });
      mockSumMonthlyCost.mockResolvedValue(1000);

      // add_heading has no incursLlmCost flag — cost cap should not gate it.
      const result = await dispatchTool("add_heading", { text: "X" }, ctx);
      expect(result.ok).toBe(true);
      expect(worker.getCanvas().sections).toHaveLength(1);
    });

    it("passes through when totalUsd is below the cap", async () => {
      const id = "int-cost-cap-under";
      resetSession(id);
      const { ctx } = makeCtx(id);

      mockGetBlogConfig.mockResolvedValue({
        interview: { monthlyCostCapUsd: 100 },
      });
      mockSumMonthlyCost.mockResolvedValue(5);

      const headingMod = await import("./add-heading");
      const original = headingMod.default;
      try {
        Object.assign(original, { incursLlmCost: true });
        const result = await dispatchTool("add_heading", { text: "Hi" }, ctx);
        expect(result.ok).toBe(true);
      } finally {
        delete (original as { incursLlmCost?: boolean }).incursLlmCost;
      }
    });
  });

  describe("audit log", () => {
    it("writes a tool_executions row on success", async () => {
      const id = "int-audit-success";
      resetSession(id);
      const { ctx } = makeCtx(id);

      await dispatchTool("add_heading", { text: "Hello" }, ctx, {
        callId: "call-success",
      });

      expect(mockToolExecutionsInsert).toHaveBeenCalledTimes(1);
      const [blogId, row] = mockToolExecutionsInsert.mock.calls[0];
      expect(blogId).toBe("default");
      expect(row.interviewId).toBe(id);
      expect(row.toolName).toBe("add_heading");
      expect(row.callId).toBe("call-success");
      expect(row.status).toBe("success");
      expect(row.durationMs).toBeTypeOf("number");
      expect(row.argsSummary).toContain("add_heading");
    });

    it("writes a tool_executions row on failure with errorKind set", async () => {
      const id = "int-audit-failure";
      resetSession(id);
      const { ctx } = makeCtx(id);

      // Trigger a validation failure by sending invalid args.
      const result: ToolResult = await dispatchTool(
        "add_heading",
        {},
        ctx,
        { callId: "call-fail" },
      );

      expect(result.ok).toBe(false);
      expect(mockToolExecutionsInsert).toHaveBeenCalledTimes(1);
      const row = mockToolExecutionsInsert.mock.calls[0][1];
      expect(row.status).toBe("error");
      expect(row.errorKind).toBe("validation");
      expect(row.callId).toBe("call-fail");
    });

    it("never throws when the audit write itself fails", async () => {
      const id = "int-audit-throws";
      resetSession(id);
      const { ctx } = makeCtx(id);

      mockToolExecutionsInsert.mockRejectedValueOnce(new Error("d1 down"));

      const result = await dispatchTool("add_heading", { text: "Hi" }, ctx);
      expect(result.ok).toBe(true);
    });
  });

  describe("narration cue events (PR feat/ai-narrates-tool-actions)", () => {
    it("emits a tool_result event after a successful sync tool so the AI hears the outcome and narrates the next step", async () => {
      const id = "int-narrate-result";
      resetSession(id);
      const { ctx } = makeCtx(id);

      await dispatchTool("add_heading", { text: "Intro" }, ctx, {
        callId: "narrate-1",
      });

      // The hardening mock shares a single mockEventsAdd for the entire
      // events subcollection. Look for the tool_result entry — we don't
      // care what other kinds were also written.
      const resultEvent = allEvents().find((e) => e.kind === "tool_result");
      expect(resultEvent).toBeDefined();
      expect(resultEvent!.payload).toMatchObject({
        toolName: "add_heading",
        callId: "narrate-1",
        ok: true,
      });
    });

    it("emits a tool_result event with errorKind when a sync tool fails so the AI can acknowledge it", async () => {
      const id = "int-narrate-result-fail";
      resetSession(id);
      const { ctx } = makeCtx(id);

      const headingMod = await import("./add-heading");
      const original = headingMod.default;
      const originalHandler = original.handler;
      try {
        Object.assign(original, {
          handler: () => ({
            ok: false,
            category: "permanent",
            message: "boom",
          }),
        });
        await dispatchTool("add_heading", { text: "X" }, ctx, {
          callId: "narrate-2",
        });
      } finally {
        Object.assign(original, { handler: originalHandler });
      }

      const resultEvent = allEvents().find((e) => e.kind === "tool_result");
      expect(resultEvent).toBeDefined();
      expect(resultEvent!.payload).toMatchObject({
        toolName: "add_heading",
        ok: false,
        errorKind: "permanent",
      });
    });
  });
});
