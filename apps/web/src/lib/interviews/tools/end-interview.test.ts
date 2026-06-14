import { describe, expect, it } from "vitest";
import endInterview from "./end-interview";
import { buildToolContext, dispatchTool, clearSessionState } from "./index";
import { WriterWorker } from "../writer-worker";

function makeCtx(interviewId = "int-end") {
  const worker = new WriterWorker({ interviewId, apiKey: "test-key" });
  return { worker, ctx: buildToolContext({ interviewId, worker }) };
}

describe("end_interview tool", () => {
  it("declares the lifecycle category and sync execution mode", () => {
    expect(endInterview.name).toBe("end_interview");
    expect(endInterview.category).toBe("lifecycle");
    expect(endInterview.executionMode).toBe("sync");
    expect(endInterview.perSessionCap).toBe(2);
  });

  it("acks successfully with no args", async () => {
    clearSessionState("int-end-1");
    const { ctx } = makeCtx("int-end-1");
    const result = await dispatchTool("end_interview", {}, ctx);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toContain("end_requested");
    }
  });

  it("forwards a short reason into the summary for telemetry", async () => {
    clearSessionState("int-end-2");
    const { ctx } = makeCtx("int-end-2");
    const result = await dispatchTool(
      "end_interview",
      { reason: "user said wrap up" },
      ctx,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toContain("user said wrap up");
    }
  });

  it("rejects an over-long reason via Zod validation", async () => {
    clearSessionState("int-end-3");
    const { ctx } = makeCtx("int-end-3");
    const result = await dispatchTool(
      "end_interview",
      { reason: "x".repeat(500) },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.category).toBe("validation");
    }
  });

  it("enforces the 2-call perSessionCap", async () => {
    clearSessionState("int-end-cap");
    const { ctx } = makeCtx("int-end-cap");
    await dispatchTool("end_interview", {}, ctx);
    await dispatchTool("end_interview", {}, ctx);
    const third = await dispatchTool("end_interview", {}, ctx);
    expect(third.ok).toBe(false);
    if (!third.ok) {
      expect(third.category).toBe("budget");
    }
  });

  it("does not mutate the canvas — handler is a pure ack", async () => {
    clearSessionState("int-end-canvas");
    const { worker, ctx } = makeCtx("int-end-canvas");
    const before = JSON.stringify(worker.getCanvas());
    await dispatchTool("end_interview", { reason: "done" }, ctx);
    const after = JSON.stringify(worker.getCanvas());
    expect(after).toBe(before);
  });
});
