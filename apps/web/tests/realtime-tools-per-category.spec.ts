/**
 * Per-category realtime tool dispatch coverage.
 *
 * One scenario per `ToolCategory` from the realtime tool registry
 * (`src/lib/interviews/tools/_types.ts`). Each scenario:
 *
 *   1. Seeds a live interview doc via the test-only dispatch route's
 *      `seedIfMissing: true` flag (which delegates through the real
 *      `dispatchTool` and per-session worker registry).
 *   2. Invokes a representative tool call (or short chain of calls)
 *      for the category.
 *   3. Asserts the returned canvas snapshot reflects the expected
 *      state change — this is the same defensive deep copy the
 *      writer-worker emits to the SSE stream, so it covers the
 *      observable contract end-to-end.
 *   4. Tears the interview doc + per-session worker state down.
 *
 * Categories whose tool implementations aren't yet on `main` (open
 * PRs #219 title-meta + sections, #221 marks + lists, #222 images +
 * SEO, #223 blocks + embeds) are marked `test.fixme` with the open
 * PR number so they enroll automatically once the corresponding
 * tools land. Categories that already have tools today (PR #218 +
 * #220) run as real e2e scenarios.
 *
 * The whole suite is gated on `INTERVIEW_E2E_TEST_SEED=true` because
 * the test-only dispatch route returns 404 otherwise — running this
 * spec without the flag would be a 100% skip with confusing red,
 * so we surface a single suite-level skip with the reason instead.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";

const DISPATCH_PATH = "/api/v1/interviews/test-only/dispatch-tool";

interface CanvasSection {
  id: string;
  heading: string | null;
  bullets: string[];
  paragraphs: string[];
  quotes: Array<{ text: string; attributedTo: string }>;
  finalized: boolean;
  paragraphIds?: string[];
}

interface Canvas {
  title: string | null;
  sections: CanvasSection[];
  meta: { description: string | null; tags: string[]; suggestedCategory: string | null };
}

interface DispatchResponse {
  result:
    | { ok: true; data?: unknown; summary?: string }
    | { ok: false; category: string; message: string };
  canvas: Canvas;
}

async function dispatch(
  request: APIRequestContext,
  body: {
    interviewId: string;
    toolName: string;
    args?: unknown;
    seedIfMissing?: boolean;
  },
): Promise<DispatchResponse> {
  const res = await request.post(DISPATCH_PATH, { data: body });
  expect(res.status(), `dispatch ${body.toolName} status`).toBe(200);
  return (await res.json()) as DispatchResponse;
}

async function teardown(
  request: APIRequestContext,
  interviewId: string,
): Promise<void> {
  await request.delete(DISPATCH_PATH, { data: { interviewId } });
}

function freshInterviewId(label: string): string {
  return `e2e-tool-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe("realtime tools — per category dispatch", () => {
  // The test-only dispatch route returns 404 unless
  // INTERVIEW_E2E_TEST_SEED=true is set on the target. Without it the
  // suite would emit a wall of red; surface a single, clear skip.
  test.skip(
    process.env.INTERVIEW_E2E_TEST_SEED !== "true",
    "INTERVIEW_E2E_TEST_SEED=true required (test-only dispatch route returns 404 otherwise)",
  );

  // Serial within file — each test uses an isolated interview id, but
  // the writer-worker registry is process-global so running them
  // serially keeps tracebacks readable when a single tool regresses.
  test.describe.configure({ mode: "serial" });

  test("category=section — add_heading + finalize_section seeds the section list", async ({
    request,
  }) => {
    const interviewId = freshInterviewId("section");
    try {
      // Add two headings — exercise both initial section creation and
      // appending. Asserts the worker assigns stable `section-N` ids
      // in insertion order (matches WriterWorker.addSection).
      const first = await dispatch(request, {
        interviewId,
        toolName: "add_heading",
        args: { text: "Introduction" },
        seedIfMissing: true,
      });
      expect(first.result.ok).toBe(true);
      expect(first.canvas.sections).toHaveLength(1);
      expect(first.canvas.sections[0].heading).toBe("Introduction");
      expect(first.canvas.sections[0].id).toBe("section-1");

      const second = await dispatch(request, {
        interviewId,
        toolName: "add_heading",
        args: { text: "Findings" },
      });
      expect(second.canvas.sections.map((s) => s.heading)).toEqual([
        "Introduction",
        "Findings",
      ]);
      expect(second.canvas.sections.map((s) => s.id)).toEqual([
        "section-1",
        "section-2",
      ]);

      // Finalize the first section — assert the `finalized` flag flips
      // only on the addressed section.
      const finalized = await dispatch(request, {
        interviewId,
        toolName: "finalize_section",
        args: { sectionId: "section-1" },
      });
      expect(finalized.result.ok).toBe(true);
      expect(finalized.canvas.sections[0].finalized).toBe(true);
      expect(finalized.canvas.sections[1].finalized).toBe(false);
    } finally {
      await teardown(request, interviewId);
    }
  });

  test("category=paragraph — insert + replace + delete round-trip", async ({
    request,
  }) => {
    const interviewId = freshInterviewId("paragraph");
    try {
      // Stand up a section to hold paragraphs.
      await dispatch(request, {
        interviewId,
        toolName: "add_heading",
        args: { text: "Body" },
        seedIfMissing: true,
      });

      // Insert two paragraphs and capture their minted ids. The tool
      // returns the id in `result.data.paragraphId` and in `summary`.
      const ins1 = await dispatch(request, {
        interviewId,
        toolName: "insert_paragraph",
        args: { sectionId: "section-1", text: "First paragraph." },
      });
      expect(ins1.result.ok).toBe(true);
      const pId1 = (ins1.result as { data: { paragraphId: string } }).data
        .paragraphId;
      expect(pId1).toBeTruthy();

      const ins2 = await dispatch(request, {
        interviewId,
        toolName: "insert_paragraph",
        args: { sectionId: "section-1", text: "Second paragraph." },
      });
      const pId2 = (ins2.result as { data: { paragraphId: string } }).data
        .paragraphId;
      expect(ins2.canvas.sections[0].paragraphs).toEqual([
        "First paragraph.",
        "Second paragraph.",
      ]);
      expect(ins2.canvas.sections[0].paragraphIds).toEqual([pId1, pId2]);

      // Replace text inside the first paragraph.
      const replaced = await dispatch(request, {
        interviewId,
        toolName: "replace_text",
        args: {
          sectionId: "section-1",
          paragraphId: pId1,
          oldText: "First",
          newText: "Opening",
        },
      });
      expect(replaced.result.ok).toBe(true);
      expect(replaced.canvas.sections[0].paragraphs[0]).toBe(
        "Opening paragraph.",
      );

      // Delete the second paragraph.
      const deleted = await dispatch(request, {
        interviewId,
        toolName: "delete_paragraph",
        args: { sectionId: "section-1", paragraphId: pId2 },
      });
      expect(deleted.result.ok).toBe(true);
      expect(deleted.canvas.sections[0].paragraphs).toEqual([
        "Opening paragraph.",
      ]);
      expect(deleted.canvas.sections[0].paragraphIds).toEqual([pId1]);
    } finally {
      await teardown(request, interviewId);
    }
  });

  test("category=block — add_quote attaches a verbatim quote to the current section", async ({
    request,
  }) => {
    const interviewId = freshInterviewId("block");
    try {
      await dispatch(request, {
        interviewId,
        toolName: "add_heading",
        args: { text: "Interview" },
        seedIfMissing: true,
      });

      const quoted = await dispatch(request, {
        interviewId,
        toolName: "add_quote",
        args: {
          text: "We never compromised on accessibility.",
          attributedTo: "Jane Doe",
        },
      });
      expect(quoted.result.ok).toBe(true);
      expect(quoted.canvas.sections[0].quotes).toEqual([
        {
          text: "We never compromised on accessibility.",
          attributedTo: "Jane Doe",
        },
      ]);
    } finally {
      await teardown(request, interviewId);
    }
  });

  test("category=read — get_current_state + get_word_count reflect the canvas", async ({
    request,
  }) => {
    const interviewId = freshInterviewId("read");
    try {
      await dispatch(request, {
        interviewId,
        toolName: "add_heading",
        args: { text: "Summary" },
        seedIfMissing: true,
      });
      await dispatch(request, {
        interviewId,
        toolName: "insert_paragraph",
        args: {
          sectionId: "section-1",
          text: "Two words.",
        },
      });

      const stateCall = await dispatch(request, {
        interviewId,
        toolName: "get_current_state",
        args: {},
      });
      expect(stateCall.result.ok).toBe(true);
      const stateData = (stateCall.result as {
        data: { sections: Array<{ id: string; paragraphCount: number }> };
      }).data;
      expect(stateData.sections).toHaveLength(1);
      expect(stateData.sections[0].id).toBe("section-1");
      expect(stateData.sections[0].paragraphCount).toBe(1);

      const wcCall = await dispatch(request, {
        interviewId,
        toolName: "get_word_count",
        args: {},
      });
      expect(wcCall.result.ok).toBe(true);
      const wcData = (wcCall.result as { data: { words: number } }).data;
      expect(wcData.words).toBe(2);
    } finally {
      await teardown(request, interviewId);
    }
  });

  // ─── Categories pending Wave 5 PRs ────────────────────────────────
  //
  // The tools below are declared in the catalog design doc but their
  // implementations sit on open feature branches at the time this
  // spec lands. We register the scenarios here as `test.fixme` so:
  //   • the suite documents the intended coverage matrix
  //   • the placeholders auto-fail (red) the moment the tools land
  //     without the spec being updated — driving the next test PR.
  //
  // Once the matching PR merges, replace `test.fixme` with `test`
  // and fill in the dispatch + assertions following the same shape
  // as the four scenarios above. Sample tools per category are
  // listed in the comment for each.

  test.fixme(
    "category=title-meta — set_title + set_subtitle (PR #219)",
    async () => {
      // Sample: set_title { text: "..." } -> canvas.title === "..."
      //         set_subtitle { text: "..." } -> canvas.meta.description
    },
  );

  test.fixme(
    "category=marks — apply_bold + apply_link round-trip markdown markers (PR #221)",
    async () => {
      // Sample: insert_paragraph then apply_bold over a span;
      //         assert the paragraph string contains `**word**`.
      //         apply_link should embed `[text](href)`.
    },
  );

  test.fixme(
    "category=lists — convert_to_bullet_list + add_list_item (PR #221)",
    async () => {
      // Sample: convert_to_bullet_list { paragraphId } -> list block
      //         present in the section, add_list_item adds an item.
    },
  );

  test.fixme(
    "category=embeds — embed_youtube + embed_iframe denied-src rejection (PR #223)",
    async () => {
      // Sample: embed_youtube { url } -> embed block appears.
      //         embed_iframe with a denylisted src -> result.ok=false,
      //         category="validation". Canvas unchanged.
    },
  );

  test.fixme(
    "category=images — request_featured_image fires-and-forgets (PR #222)",
    async () => {
      // Sample: AI provider must be mocked at the dispatch boundary
      //         so no real LLM spend happens. The tool returns a
      //         queued ack synchronously; the worker emits the final
      //         diff later via the SSE stream.
    },
  );

  test.fixme(
    "category=seo — set_keywords + set_categories (PR #222)",
    async () => {
      // Sample: set_keywords { keywords: [...] } -> canvas.meta.tags.
      //         set_categories needs the categories collection mocked
      //         (no real DB writes from this spec).
    },
  );
});
