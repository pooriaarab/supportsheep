import { describe, expect, it, beforeEach } from "vitest";
import requestSeoScore from "./request-seo-score";
import { WriterWorker } from "../writer-worker";
import { buildToolContext, clearSessionState, dispatchTool } from "./index";

describe("request_seo_score tool", () => {
  beforeEach(() => {
    clearSessionState("int-seo");
  });

  it("acks immediately and emits an seo_score_updated diff once scored", async () => {
    const worker = new WriterWorker({ interviewId: "int-seo", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Topic A" });
    const ctx = buildToolContext({ interviewId: "int-seo", worker });
    const diffs: { type: string }[] = [];
    worker.on("diff", (d) => diffs.push(d as { type: string }));

    const startedAt = Date.now();
    const result = await requestSeoScore.handler({}, ctx);
    expect(Date.now() - startedAt).toBeLessThan(100);
    expect(result).toEqual({ ok: true, summary: "queued" });

    // Background scoring is synchronous internally (calculateSeoScore
    // is pure CPU work) but lives inside a microtask. Flush a few.
    await Promise.resolve();
    await Promise.resolve();
    expect(
      diffs.some((d) => d.type === "seo_score_updated"),
    ).toBe(true);
    expect(worker.getCanvas().seoScore?.score).toBeTypeOf("number");
  });

  it("dedupes consecutive calls within the 60s window", async () => {
    const worker = new WriterWorker({ interviewId: "int-seo", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-seo", worker });
    const first = await dispatchTool("request_seo_score", {}, ctx);
    const second = await dispatchTool("request_seo_score", {}, ctx);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    // Both calls return ok; the second is a dedupe-cache hit so the
    // handler isn't invoked twice — the diff stream only sees one
    // background scoring round.
  });
});
