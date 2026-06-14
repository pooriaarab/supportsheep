import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./_types";

describe("Tool interface", () => {
  it("accepts a minimal sync tool with no perSessionCap or dedupe", () => {
    const schema = z.object({ text: z.string() });
    const tool: Tool<z.infer<typeof schema>> = {
      name: "noop",
      description: "noop",
      category: "section",
      argsSchema: schema,
      executionMode: "sync",
      handler: (args) => ({ ok: true, summary: args.text }),
    };
    expect(tool.name).toBe("noop");
  });

  it("accepts a tool with perSessionCap and dedupe configured", () => {
    const schema = z.object({});
    const tool: Tool<z.infer<typeof schema>> = {
      name: "capped",
      description: "capped tool",
      category: "images",
      argsSchema: schema,
      executionMode: "fire-and-forget",
      perSessionCap: 4,
      dedupe: {
        keyFromArgs: () => "static",
        windowMs: 30_000,
      },
      handler: async () => ({ ok: true }),
    };
    expect(tool.perSessionCap).toBe(4);
    expect(tool.dedupe?.windowMs).toBe(30_000);
  });

  it("ToolResult discriminates success vs error shapes", () => {
    const success: ToolResult = { ok: true, data: { foo: 1 }, summary: "ok" };
    const error: ToolResult = { ok: false, category: "not-found", message: "x" };
    expect(success.ok).toBe(true);
    expect(error.ok).toBe(false);
    if (!error.ok) expect(error.category).toBe("not-found");
  });

  it("ToolContext exposes interviewId, worker, logger, and getCurrentCanvas", () => {
    // Compile-time shape check; pulled out so the test suite fails if
    // the interface drifts (e.g. someone removes getCurrentCanvas).
    const ctx: ToolContext = {
      interviewId: "int-1",
      worker: { applyToolCall: () => {} } as unknown as ToolContext["worker"],
      logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      } as unknown as ToolContext["logger"],
      getCurrentCanvas: () => ({
        title: null,
        sections: [],
        meta: { description: null, tags: [], suggestedCategory: null },
      }),
    };
    expect(ctx.interviewId).toBe("int-1");
    expect(typeof ctx.getCurrentCanvas).toBe("function");
  });
});
