import { describe, expect, it } from "vitest";
import addHeading from "./add-heading";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("add_heading tool", () => {
  it("appends a new section and emits section_added diff", async () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-1", worker });
    const diffs: unknown[] = [];
    worker.on("diff", (d) => diffs.push(d));

    const result = await addHeading.handler({ text: "Intro" }, ctx);
    expect(result.ok).toBe(true);
    const canvas = worker.getCanvas();
    expect(canvas.sections).toHaveLength(1);
    expect(canvas.sections[0].heading).toBe("Intro");
    expect(diffs).toHaveLength(1);
  });

  it("rejects empty text via the Zod schema", () => {
    const parsed = addHeading.argsSchema.safeParse({ text: "" });
    expect(parsed.success).toBe(false);
  });
});
