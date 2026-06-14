import { describe, expect, it } from "vitest";
import insertCodeBlock from "./insert-code-block";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

function makeCtx() {
  const worker = new WriterWorker({ interviewId: "int-1", apiKey: "k" });
  worker.applyToolCall("add_heading", { text: "Setup" });
  return { worker, ctx: buildToolContext({ interviewId: "int-1", worker }) };
}

describe("insert_code_block tool", () => {
  it("inserts a syntax-highlighted code block", async () => {
    const { worker, ctx } = makeCtx();
    const result = await insertCodeBlock.handler(
      { sectionId: "section-1", language: "ts", code: "const x = 1;" },
      ctx,
    );
    expect(result.ok).toBe(true);
    const section = worker.getCanvas().sections[0];
    expect(section.blocks?.[0]).toMatchObject({
      type: "code_block",
      language: "ts",
      code: "const x = 1;",
    });
  });

  it("rejects an unsupported language via the Zod enum", () => {
    const parsed = insertCodeBlock.argsSchema.safeParse({
      sectionId: "section-1",
      language: "rust",
      code: "fn main() {}",
    });
    expect(parsed.success).toBe(false);
  });
});
