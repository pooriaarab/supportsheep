import { describe, expect, it } from "vitest";
import embedCodepen from "./embed-codepen";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

function makeCtx() {
  const worker = new WriterWorker({ interviewId: "int-embed-cp", apiKey: "k" });
  worker.applyToolCall("add_heading", { text: "Intro" });
  return { worker, ctx: buildToolContext({ interviewId: "int-embed-cp", worker }) };
}

describe("embed_codepen tool", () => {
  it("inserts a CodePen embed with the default tab selected", async () => {
    const { worker, ctx } = makeCtx();
    const result = await embedCodepen.handler(
      { sectionId: "section-1", penId: "abcDEF12", defaultTab: "js" },
      ctx,
    );
    expect(result.ok).toBe(true);
    const section = worker.getCanvas().sections[0];
    const block = section.blocks?.[0];
    expect(block).toMatchObject({ type: "embed", kind: "codepen" });
    expect((block as { src: string }).src).toContain("default-tab=js");
  });

  it("rejects an unknown defaultTab", () => {
    const parsed = embedCodepen.argsSchema.safeParse({
      sectionId: "section-1",
      penId: "abcDEF12",
      defaultTab: "everything",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a malformed pen id", () => {
    const parsed = embedCodepen.argsSchema.safeParse({
      sectionId: "section-1",
      penId: "###bad###",
    });
    expect(parsed.success).toBe(false);
  });
});
