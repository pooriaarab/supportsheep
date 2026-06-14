import { describe, expect, it } from "vitest";
import setTitle from "./set-title";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("set_title tool", () => {
  it("sets the canvas title and emits title_updated diff", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });
    const diffs: unknown[] = [];
    worker.on("diff", (d) => diffs.push(d));

    const result = await setTitle.handler({ title: "How I Built Supportsheep" }, ctx);
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().title).toBe("How I Built Supportsheep");
    expect(diffs).toEqual([
      { type: "title_updated", payload: { title: "How I Built Supportsheep" } },
    ]);
  });

  it("rejects empty and over-long titles via the Zod schema", () => {
    expect(setTitle.argsSchema.safeParse({ title: "" }).success).toBe(false);
    expect(
      setTitle.argsSchema.safeParse({ title: "x".repeat(201) }).success,
    ).toBe(false);
  });

  it("enforces a per-session cap of 5", () => {
    expect(setTitle.perSessionCap).toBe(5);
  });
});
