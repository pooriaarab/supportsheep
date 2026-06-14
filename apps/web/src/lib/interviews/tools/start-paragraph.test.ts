import { describe, expect, it } from "vitest";
import startParagraph from "./start-paragraph";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("start_paragraph tool", () => {
  it("is a marker-only no-op on the canvas (writer worker fills paragraphs later)", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });
    const before = JSON.stringify(worker.getCanvas());

    const result = await startParagraph.handler({ hint: "context" }, ctx);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(worker.getCanvas())).toBe(before);
  });

  it("accepts missing hint (optional field)", () => {
    expect(startParagraph.argsSchema.safeParse({}).success).toBe(true);
    expect(startParagraph.argsSchema.safeParse({ hint: "X" }).success).toBe(true);
  });
});
