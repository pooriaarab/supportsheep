import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  buildRealtimeToolSchemas,
  buildToolContext,
  clearSessionState,
  dispatchTool,
  getTool,
  listTools,
} from "./index";
import { WriterWorker } from "../writer-worker";

function makeWorker(interviewId = "int-1") {
  return new WriterWorker({ interviewId, apiKey: "test-key" });
}

describe("tool registry", () => {
  beforeEach(() => {
    clearSessionState("int-1");
    clearSessionState("int-cap");
    clearSessionState("int-dedupe");
    clearSessionState("int-validation");
    clearSessionState("int-unknown");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers the full canvas tool catalog (scaffold + paragraph + Phase 4 block/embed + read + Phase 3 marks/lists + Phase 5 images/SEO/video + title/section + lifecycle)", () => {
    const names = listTools().map((t) => t.name).sort();
    expect(names).toEqual(
      [
        // Phase 1 scaffold
        "add_bullet",
        "add_heading",
        "add_quote",
        "finalize_section",
        "start_paragraph",
        // Phase 2 paragraphs
        "delete_paragraph",
        "insert_paragraph",
        "join_paragraphs",
        "move_paragraph",
        "replace_text",
        "set_alignment",
        "split_paragraph",
        // Phase 4 blocks + embeds
        "embed_codepen",
        "embed_gist",
        "embed_iframe",
        "embed_loom",
        "embed_tweet",
        "embed_youtube",
        "insert_blockquote",
        "insert_callout",
        "insert_code_block",
        "insert_divider",
        "insert_table",
        // Phase 6 read
        "get_current_state",
        "get_section",
        "get_word_count",
        // Phase 3 marks + lists
        "add_list_item",
        "apply_bold",
        "apply_code",
        "apply_heading_level",
        "apply_highlight",
        "apply_italic",
        "apply_link",
        "apply_strike",
        "apply_subscript",
        "apply_superscript",
        "apply_underline",
        "clear_formatting",
        "complete_list_item",
        "convert_to_bullet_list",
        "convert_to_checklist",
        "convert_to_numbered_list",
        "nest_list_item",
        // Phase 5 images + SEO
        "add_internal_link",
        "insert_inline_image",
        "insert_video",
        "regenerate_featured_image",
        "replace_inline_image",
        "request_featured_image",
        "request_seo_score",
        "set_alt_text",
        "set_categories",
        "set_keywords",
        "set_tags",
        "suggest_internal_links",
        // Phase 2 title/meta
        "set_seo_meta",
        "set_slug",
        "set_subtitle",
        "set_title",
        // Phase 2 sections
        "delete_section",
        "insert_section",
        "merge_sections",
        "move_section",
        "rename_section",
        "set_heading_level",
        // Lifecycle — guest-driven end signal.
        "end_interview",
      ].sort(),
    );
  });

  it("getTool returns the tool by name", () => {
    const tool = getTool("add_heading");
    expect(tool?.name).toBe("add_heading");
    expect(tool?.category).toBe("section");
  });

  it("getTool returns undefined for unknown names", () => {
    expect(getTool("does_not_exist")).toBeUndefined();
  });

  it("listTools filters by category", () => {
    const read = listTools({ category: "read" }).map((t) => t.name).sort();
    expect(read).toEqual(["get_current_state", "get_section", "get_word_count"]);
  });

  it("listTools filters by executionMode", () => {
    // Phase 5 added fire-and-forget tools for images + slow SEO work.
    expect(
      listTools({ executionMode: "fire-and-forget" }).length,
    ).toBeGreaterThanOrEqual(6);
    expect(listTools({ executionMode: "sync" }).length).toBeGreaterThanOrEqual(
      15,
    );
  });

  it("buildRealtimeToolSchemas emits OpenAI function shape", () => {
    const schemas = buildRealtimeToolSchemas();
    expect(schemas.length).toBeGreaterThanOrEqual(15);
    const heading = schemas.find((s) => s.name === "add_heading");
    expect(heading).toBeDefined();
    expect(heading?.type).toBe("function");
    expect(heading?.description).toContain("section heading");
    expect(heading?.parameters).toBeTypeOf("object");
    expect((heading?.parameters as Record<string, unknown>).$schema).toBeUndefined();
  });

  it("buildRealtimeToolSchemas exposes the full canvas tool catalog (>= 45)", () => {
    // The realtime session must advertise every canvas tool — sync and
    // fire-and-forget alike — so the model can pick the right one per
    // turn. Filtering the registry down to a subset would silently hide
    // capability from the model and recreate the original "AI only
    // talks, never edits" bug.
    const schemas = buildRealtimeToolSchemas();
    expect(schemas.length).toBeGreaterThanOrEqual(45);
  });

  describe("dispatchTool", () => {
    it("returns permanent error for unknown tool", async () => {
      const worker = makeWorker();
      const ctx = buildToolContext({ interviewId: "int-1", worker });
      const result = await dispatchTool("nope", {}, ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.category).toBe("permanent");
      }
    });

    it("returns validation error when args don't satisfy the schema", async () => {
      const worker = makeWorker("int-validation");
      const ctx = buildToolContext({ interviewId: "int-validation", worker });
      // add_heading requires text; passing an empty object should fail.
      const result = await dispatchTool("add_heading", {}, ctx);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.category).toBe("validation");
        expect(result.message).toContain("add_heading");
      }
    });

    it("invokes the handler and forwards canvas mutations to the worker", async () => {
      const worker = makeWorker();
      const ctx = buildToolContext({ interviewId: "int-1", worker });
      const result = await dispatchTool("add_heading", { text: "Intro" }, ctx);
      expect(result.ok).toBe(true);
      expect(worker.getCanvas().sections).toHaveLength(1);
      expect(worker.getCanvas().sections[0].heading).toBe("Intro");
    });

    it("enforces perSessionCap and returns a budget error past the cap", async () => {
      const worker = makeWorker("int-cap");
      const ctx = buildToolContext({ interviewId: "int-cap", worker });

      // We don't have a capped tool by default — exercise the dedupe
      // path indirectly via getTool() injection. Instead, dispatch a
      // tool many times and check the increment counter reaches the
      // cap once we override it. We do this via a custom Tool plugged
      // into the dispatcher path: easiest is to monkeypatch the
      // registry behaviour. Since the registry is module-scoped, we
      // simulate the cap by checking the budget category surfaces via
      // a tool we instrument with perSessionCap below.

      // Instrument the existing add_heading tool with a cap by
      // re-using its module reference (Vitest gives us a live binding).
      const headingMod = await import("./add-heading");
      const original = headingMod.default;
      try {
        Object.assign(original, { perSessionCap: 2 });

        const first = await dispatchTool("add_heading", { text: "A" }, ctx);
        const second = await dispatchTool("add_heading", { text: "B" }, ctx);
        const third = await dispatchTool("add_heading", { text: "C" }, ctx);

        expect(first.ok).toBe(true);
        expect(second.ok).toBe(true);
        expect(third.ok).toBe(false);
        if (!third.ok) {
          expect(third.category).toBe("budget");
          expect(third.message).toContain("add_heading");
        }
      } finally {
        // restore: delete the field we patched in
        delete (original as { perSessionCap?: number }).perSessionCap;
      }
    });

    it("dedupes calls within the window and returns the cached result", async () => {
      const worker = makeWorker("int-dedupe");
      const ctx = buildToolContext({ interviewId: "int-dedupe", worker });

      const headingMod = await import("./add-heading");
      const original = headingMod.default;
      try {
        Object.assign(original, {
          dedupe: {
            keyFromArgs: (args: { text: string }) => args.text,
            windowMs: 60_000,
          },
        });

        const first = await dispatchTool(
          "add_heading",
          { text: "Same" },
          ctx,
        );
        const second = await dispatchTool(
          "add_heading",
          { text: "Same" },
          ctx,
        );

        expect(first.ok).toBe(true);
        expect(second.ok).toBe(true);
        // Second call should NOT have added a second section — the
        // dedupe path bypasses the handler entirely.
        expect(worker.getCanvas().sections).toHaveLength(1);
      } finally {
        delete (original as { dedupe?: unknown }).dedupe;
      }
    });

    it("dispatches in-process via the WriterWorker", async () => {
      const worker = makeWorker("int-netlify");
      const ctx = buildToolContext({ interviewId: "int-netlify", worker });
      clearSessionState("int-netlify");
      const result = await dispatchTool("add_heading", { text: "Local" }, ctx);
      expect(result.ok).toBe(true);
      // In-process path mutates the worker.
      expect(worker.getCanvas().sections).toHaveLength(1);
    });

    it("surfaces handler exceptions as a permanent error result instead of throwing", async () => {
      const worker = makeWorker();
      const ctx = buildToolContext({ interviewId: "int-1", worker });

      const headingMod = await import("./add-heading");
      const original = headingMod.default;
      const originalHandler = original.handler;
      try {
        Object.assign(original, {
          handler: () => {
            throw new Error("synthetic failure");
          },
        });

        const result = await dispatchTool(
          "add_heading",
          { text: "X" },
          ctx,
        );
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.category).toBe("permanent");
          expect(result.message).toContain("synthetic failure");
        }
      } finally {
        Object.assign(original, { handler: originalHandler });
      }
    });
  });
});
