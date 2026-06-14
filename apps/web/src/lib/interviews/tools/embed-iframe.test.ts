import { describe, expect, it } from "vitest";
import embedIframe from "./embed-iframe";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

function makeCtx() {
  const worker = new WriterWorker({ interviewId: "int-embed-if", apiKey: "k" });
  worker.applyToolCall("add_heading", { text: "Intro" });
  return { worker, ctx: buildToolContext({ interviewId: "int-embed-if", worker }) };
}

describe("embed_iframe tool", () => {
  it("inserts an iframe embed for an allowed https:// URL", async () => {
    const { worker, ctx } = makeCtx();
    const result = await embedIframe.handler(
      { sectionId: "section-1", src: "https://www.figma.com/file/abc/" },
      ctx,
    );
    expect(result.ok).toBe(true);
    const section = worker.getCanvas().sections[0];
    expect(section.blocks?.[0]).toMatchObject({
      type: "embed",
      kind: "iframe",
      src: "https://www.figma.com/file/abc/",
    });
  });

  it("rejects disallowed sources at the Zod validation layer", () => {
    const disallowed = [
      "http://example.com",                         // http (not https)
      "data:text/html,<script>alert(1)</script>",   // data: URL
      "javascript:alert(1)",                        // javascript: URL
      "file:///etc/passwd",                         // file: URL
      "https://localhost/admin",                    // loopback
      "https://127.0.0.1/admin",                    // loopback
      "https://0.0.0.0/admin",                      // loopback
      "https://169.254.169.254/latest/meta-data/",  // AWS metadata
      "https://10.0.0.1/internal",                  // RFC1918
      "https://192.168.1.1/router",                 // RFC1918
      "https://172.16.0.1/internal",                // RFC1918
    ];
    for (const src of disallowed) {
      const parsed = embedIframe.argsSchema.safeParse({
        sectionId: "section-1",
        src,
      });
      expect(parsed.success, `should reject: ${src}`).toBe(false);
    }
  });

  it("accepts a known public host", () => {
    const parsed = embedIframe.argsSchema.safeParse({
      sectionId: "section-1",
      src: "https://www.notion.so/some-page",
    });
    expect(parsed.success).toBe(true);
  });
});
