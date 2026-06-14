import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { WriterWorker, type WriterDiff } from "./writer-worker";
import type Anthropic from "@anthropic-ai/sdk";

// Mock the logger to avoid polluting stdout, but spy so we can assert on
// structured observability lines added for ops debugging.
const { mockLogInfo, mockLogError, mockLogWarn } = vi.hoisted(() => ({
  mockLogInfo: vi.fn(),
  mockLogError: vi.fn(),
  mockLogWarn: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: mockLogInfo,
    warn: mockLogWarn,
    error: mockLogError,
  }),
  // Bypass the start/end log timing wrapper in tests — the spies above
  // only need to observe direct log calls. Re-throwing keeps the
  // surrounding error-handling semantics identical to the real helper.
  withStructuredLog: async (
    _log: unknown,
    _operation: string,
    _context: Record<string, unknown>,
    fn: () => Promise<unknown>,
  ) => fn(),
}));

// Mock the cross-instance D1 bridge so unit tests can assert
// every WriterDiff emit ALSO writes to the interview_events table. Tests
// that don't care about the bridge simply ignore `mockAppendEvents`; the
// promise resolves with undefined so the success-path log fires.
const { mockAppendEvents } = vi.hoisted(() => ({
  mockAppendEvents: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./events-repository", () => ({
  appendEvents: mockAppendEvents,
}));
// getDb is called by appendEvents — provide a stub so the import resolves.
vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({})),
}));

describe("WriterWorker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockLogInfo.mockClear();
    mockLogError.mockClear();
    mockLogWarn.mockClear();
    mockAppendEvents.mockClear();
    mockAppendEvents.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("Constructor throws without apiKey or client", () => {
    expect(() => new WriterWorker({ interviewId: "int-1" })).toThrow(
      /apiKey/,
    );
  });

  test("appendTranscript('') is a no-op", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "[]" }],
    });
    const mockClient = {
      messages: {
        create: mockCreate,
      },
    } as unknown as Anthropic;

    const worker = new WriterWorker({
      interviewId: "int-1",
      client: mockClient,
    });

    worker.appendTranscript("");
    worker.appendTranscript("   ");

    // Fast-forward any potential timers/background runs
    await vi.runAllTimersAsync();

    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("applyToolCall('add_heading', { text: 'Intro' }) creates section + emits section_added diff", () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
    const diffEvents: WriterDiff[] = [];
    worker.on("diff", (diff) => diffEvents.push(diff));

    worker.applyToolCall("add_heading", { text: "Intro" });

    const canvas = worker.getCanvas();
    expect(canvas.sections).toHaveLength(1);
    expect(canvas.sections[0]).toEqual({
      id: "section-1",
      heading: "Intro",
      bullets: [],
      paragraphs: [],
      quotes: [],
      finalized: false,
    });

    expect(diffEvents).toHaveLength(1);
    expect(diffEvents[0]).toEqual({
      type: "section_added",
      payload: {
        id: "section-1",
        heading: "Intro",
        bullets: [],
        paragraphs: [],
        quotes: [],
        finalized: false,
      },
    });
  });

  // W20.D regression — the realtime model occasionally re-issues
  // `add_heading` for content it has already laid down (SSE reconnect,
  // hallucinated retry). Without idempotency the canvas grew duplicate
  // sections — the user screenshot showed "Definition and Origin"
  // repeated three times. The worker now treats a same-heading second
  // call as an in-place update on the existing section.
  test("applyToolCall('add_heading', { text: 'Definition and Origin' }) called twice with the same heading is idempotent — canvas keeps exactly one section", () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
    const diffEvents: WriterDiff[] = [];
    worker.on("diff", (diff) => diffEvents.push(diff));

    worker.applyToolCall("add_heading", { text: "Definition and Origin" });
    worker.applyToolCall("add_heading", { text: "Definition and Origin" });

    const canvas = worker.getCanvas();
    expect(canvas.sections).toHaveLength(1);
    expect(canvas.sections[0].id).toBe("section-1");
    expect(canvas.sections[0].heading).toBe("Definition and Origin");

    // First call creates the section; second call surfaces an in-place
    // update against the same id so SSE clients reconciling after a
    // reconnect still converge on the worker's snapshot.
    expect(diffEvents).toEqual([
      {
        type: "section_added",
        payload: {
          id: "section-1",
          heading: "Definition and Origin",
          bullets: [],
          paragraphs: [],
          quotes: [],
          finalized: false,
        },
      },
      {
        type: "section_updated",
        payload: { id: "section-1", heading: "Definition and Origin" },
      },
    ]);
  });

  test("applyToolCall('insert_section', ...) with a heading that already exists no-ops to section_updated instead of appending a duplicate", () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
    worker.applyToolCall("add_heading", { text: "Definition and Origin" });

    const diffEvents: WriterDiff[] = [];
    worker.on("diff", (diff) => diffEvents.push(diff));

    worker.applyToolCall("insert_section", {
      heading: "Definition and Origin",
      level: 2,
    });

    const canvas = worker.getCanvas();
    expect(canvas.sections).toHaveLength(1);
    expect(diffEvents).toEqual([
      {
        type: "section_updated",
        payload: { id: "section-1", heading: "Definition and Origin", level: 2 },
      },
    ]);
  });

  test("applyToolCall('add_bullet', { text: 'X' }) adds bullet to current section", () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    worker.applyToolCall("add_bullet", { text: "Bullet point 1" });

    const canvas = worker.getCanvas();
    expect(canvas.sections[0].bullets).toEqual(["Bullet point 1"]);
  });

  test("applyToolCall('add_bullet', { text: 'X' }) emits section_updated diff so SSE clients see the bullet", () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
    worker.applyToolCall("add_heading", { text: "Intro" });

    const diffEvents: WriterDiff[] = [];
    worker.on("diff", (diff) => diffEvents.push(diff));

    worker.applyToolCall("add_bullet", { text: "First bullet" });
    worker.applyToolCall("add_bullet", { text: "Second bullet" });

    expect(diffEvents).toHaveLength(2);
    expect(diffEvents[0]).toEqual({
      type: "section_updated",
      payload: { id: "section-1", bullets: ["First bullet"] },
    });
    expect(diffEvents[1]).toEqual({
      type: "section_updated",
      payload: { id: "section-1", bullets: ["First bullet", "Second bullet"] },
    });
  });

  test("applyToolCall('add_quote', ...) adds quote with attribution", () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    worker.applyToolCall("add_quote", { text: "I love coding", attributedTo: "Developer" });

    const canvas = worker.getCanvas();
    expect(canvas.sections[0].quotes).toEqual([
      { text: "I love coding", attributedTo: "Developer" },
    ]);
  });

  test("applyToolCall('add_quote', ...) emits section_updated diff so SSE clients see the quote", () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
    worker.applyToolCall("add_heading", { text: "Intro" });

    const diffEvents: WriterDiff[] = [];
    worker.on("diff", (diff) => diffEvents.push(diff));

    worker.applyToolCall("add_quote", { text: "Ship it", attributedTo: "PM" });

    expect(diffEvents).toHaveLength(1);
    expect(diffEvents[0]).toEqual({
      type: "section_updated",
      payload: {
        id: "section-1",
        quotes: [{ text: "Ship it", attributedTo: "PM" }],
      },
    });
  });

  test("applyToolCall('finalize_section', { sectionId }) marks section finalized + emits diff", () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
    worker.applyToolCall("add_heading", { text: "Intro" });

    const diffEvents: WriterDiff[] = [];
    worker.on("diff", (diff) => diffEvents.push(diff));

    worker.applyToolCall("finalize_section", { sectionId: "section-1" });

    const canvas = worker.getCanvas();
    expect(canvas.sections[0].finalized).toBe(true);

    // One event for heading, then one for finalize
    expect(diffEvents).toHaveLength(1);
    expect(diffEvents[0]).toEqual({
      type: "section_finalized",
      payload: { sectionId: "section-1" },
    });
  });

  test("Worker calls Anthropic on appendTranscript with prompt caching", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "[]" }],
    });
    const mockClient = {
      messages: {
        create: mockCreate,
      },
    } as unknown as Anthropic;

    const worker = new WriterWorker({
      interviewId: "int-1",
      topic: "Tech",
      goal: "Learn",
      language: "es",
      client: mockClient,
    });

    worker.appendTranscript("Hello world");
    await vi.runAllTimersAsync();

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-sonnet-4-6");
    expect(callArgs.max_tokens).toBe(2000);
    expect(callArgs.system).toEqual([
      { type: "text", text: expect.any(String), cache_control: { type: "ephemeral" } },
      { type: "text", text: "Topic: Tech\nGoal: Learn\nLanguage: Spanish\nCurrent canvas: {\"title\":null,\"subtitle\":null,\"slug\":null,\"metaTitle\":null,\"metaDescription\":null,\"sections\":[],\"meta\":{\"description\":null,\"tags\":[],\"suggestedCategory\":null}}", cache_control: { type: "ephemeral" } },
    ]);
    expect(callArgs.messages).toEqual([
      { role: "user", content: "New transcript chunk: Hello world\n\nEmit WriterDiff array. Empty array if no changes." },
    ]);
  });

  test("Parses well-formed diff JSON; tolerates malformed (returns empty)", async () => {
    const mockCreate = vi.fn()
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "Some markdown text ```json\n[\n  {\n    \"type\": \"title_updated\",\n    \"payload\": { \"title\": \"Better Title\" }\n  }\n]\n``` and other text" }],
      })
      .mockResolvedValueOnce({
        content: [{ type: "text", text: "No json here, just general talking" }],
      });

    const mockClient = {
      messages: {
        create: mockCreate,
      },
    } as unknown as Anthropic;

    const worker = new WriterWorker({
      interviewId: "int-1",
      client: mockClient,
    });

    // Pass 1: well-formed JSON embedded in text
    worker.appendTranscript("Hello first time");
    await vi.runAllTimersAsync();
    expect(worker.getCanvas().title).toBe("Better Title");

    // Pass 2: no JSON in text
    worker.appendTranscript("Hello second time");
    await vi.runAllTimersAsync();
    expect(worker.getCanvas().title).toBe("Better Title"); // stays unchanged
  });

  test("Applies title_updated, section_updated, and meta_updated diffs correctly", async () => {
    const diffsPayload = [
      {
        type: "title_updated",
        payload: { title: "New Title" },
      },
      {
        type: "section_updated",
        payload: {
          id: "section-1",
          heading: "Refined Intro",
          bullets: ["Point A", "Point B"],
          paragraphs: ["Paragraph 1"],
        },
      },
      {
        type: "meta_updated",
        payload: {
          meta: {
            description: "SEO description",
            tags: ["tech", "coding"],
            suggestedCategory: "Engineering",
          },
        },
      },
    ];

    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(diffsPayload) }],
    });

    const mockClient = {
      messages: {
        create: mockCreate,
      },
    } as unknown as Anthropic;

    const worker = new WriterWorker({
      interviewId: "int-1",
      client: mockClient,
    });

    // Create section 1 first
    worker.applyToolCall("add_heading", { text: "Old Intro" });

    const diffEvents: WriterDiff[] = [];
    worker.on("diff", (diff) => diffEvents.push(diff));

    worker.appendTranscript("refining...");
    await vi.runAllTimersAsync();

    const canvas = worker.getCanvas();
    expect(canvas.title).toBe("New Title");
    expect(canvas.sections[0]).toEqual({
      id: "section-1",
      heading: "Refined Intro",
      bullets: ["Point A", "Point B"],
      paragraphs: ["Paragraph 1"],
      quotes: [],
      finalized: false,
    });
    expect(canvas.meta).toEqual({
      description: "SEO description",
      tags: ["tech", "coding"],
      suggestedCategory: "Engineering",
    });

    // Verifies events are passed through
    expect(diffEvents).toContainEqual(diffsPayload[0]);
    expect(diffEvents).toContainEqual(diffsPayload[1]);
    expect(diffEvents).toContainEqual(diffsPayload[2]);
  });

  test("applyDiffs forwards `upsert_paragraph` LLM diffs (W22.A) so the client can refine paragraphs in place", async () => {
    const upsertPayload = {
      sectionId: "section-1",
      paragraphId: "section-1-p-0",
      text: "Polished body sentence.",
    };
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify([{ type: "upsert_paragraph", payload: upsertPayload }]),
        },
      ],
    });
    const mockClient = {
      messages: { create: mockCreate },
    } as unknown as Anthropic;
    const worker = new WriterWorker({
      interviewId: "int-1",
      client: mockClient,
    });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const diffEvents: WriterDiff[] = [];
    worker.on("diff", (diff) => diffEvents.push(diff));

    worker.appendTranscript("refining...");
    await vi.runAllTimersAsync();

    expect(diffEvents).toContainEqual({
      type: "upsert_paragraph",
      payload: upsertPayload,
    });
  });

  test("applyDiffs DROPS unknown LLM diff kinds with a structured warning instead of forwarding them blindly", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify([
            { type: "completely_made_up_kind", payload: { hello: "world" } },
          ]),
        },
      ],
    });
    const mockClient = {
      messages: { create: mockCreate },
    } as unknown as Anthropic;
    const worker = new WriterWorker({
      interviewId: "int-1",
      client: mockClient,
    });
    const diffEvents: WriterDiff[] = [];
    worker.on("diff", (diff) => diffEvents.push(diff));

    worker.appendTranscript("hallucinate...");
    await vi.runAllTimersAsync();

    // The unknown kind never reaches subscribers.
    expect(
      diffEvents.find((d) => d.type === ("completely_made_up_kind" as WriterDiff["type"])),
    ).toBeUndefined();
    // And we log it at WARN so ops can spot a regression server-side.
    const warnCalls = mockLogWarn.mock.calls.filter(
      (c) => c[0] === "writer_worker_dropped_unknown_diff_kind",
    );
    expect(warnCalls.length).toBeGreaterThanOrEqual(1);
    expect(warnCalls[warnCalls.length - 1][1]).toMatchObject({
      interviewId: "int-1",
      diffType: "completely_made_up_kind",
    });
  });

  test("getCanvas() returns defensive copy (mutations don't affect internal state)", () => {
    const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
    worker.applyToolCall("add_heading", { text: "Heading" });

    const canvas1 = worker.getCanvas();
    canvas1.sections[0].heading = "Mutated Heading";

    const canvas2 = worker.getCanvas();
    expect(canvas2.sections[0].heading).toBe("Heading");
  });

  describe("human canvas editing (V2.5)", () => {
    test("applyCanvasEdit updates section heading", () => {
      const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
      worker.applyToolCall("add_heading", { text: "Original Heading" });

      worker.applyCanvasEdit({
        sectionId: "section-1",
        field: "heading",
        value: "Human Edited Heading",
      });

      const canvas = worker.getCanvas();
      expect(canvas.sections[0].heading).toBe("Human Edited Heading");
    });

    test("applyCanvasEdit updates paragraph and bullets, and skips subsequent refinement diffs", async () => {
      const firstDiffs: WriterDiff[] = [
        {
          type: "section_updated",
          payload: {
            id: "section-1",
            heading: "Refined Intro",
            bullets: ["Bullet 0", "Bullet 1"],
            paragraphs: ["Paragraph 0", "Paragraph 1"],
          },
        },
      ];

      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(firstDiffs) }],
      });

      const mockClient = {
        messages: {
          create: mockCreate,
        },
      } as unknown as Anthropic;

      const worker = new WriterWorker({
        interviewId: "int-1",
        client: mockClient,
      });

      worker.applyToolCall("add_heading", { text: "Old Intro" });

      // Run refinement first to populate paragraphs/bullets
      worker.appendTranscript("refine please");
      await vi.runAllTimersAsync();

      // Ensure they got populated
      let canvas = worker.getCanvas();
      expect(canvas.sections[0].paragraphs).toEqual(["Paragraph 0", "Paragraph 1"]);
      expect(canvas.sections[0].bullets).toEqual(["Bullet 0", "Bullet 1"]);

      // Human edits paragraph 1 and bullet 0
      worker.applyCanvasEdit({
        sectionId: "section-1",
        field: "paragraph_text",
        index: 1,
        value: "Human Edit Para 1",
      });
      worker.applyCanvasEdit({
        sectionId: "section-1",
        field: "bullet_text",
        index: 0,
        value: "Human Edit Bullet 0",
      });

      canvas = worker.getCanvas();
      expect(canvas.sections[0].paragraphs[1]).toBe("Human Edit Para 1");
      expect(canvas.sections[0].bullets[0]).toBe("Human Edit Bullet 0");

      // Now run another refinement with updated info from AI.
      // Since section-1 is marked as human edited, subsequent refinement diffs for section-1 should be SKIPPED!
      const secondDiffs: WriterDiff[] = [
        {
          type: "section_updated",
          payload: {
            id: "section-1",
            heading: "AI Overwrite Heading",
            bullets: ["AI Overwrite Bullet 0", "AI Overwrite Bullet 1"],
            paragraphs: ["AI Overwrite Para 0", "AI Overwrite Para 1"],
          },
        },
      ];

      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(secondDiffs) }],
      });

      worker.appendTranscript("more talk...");
      await vi.runAllTimersAsync();

      // Heading, bullets, and paragraphs should NOT be overwritten because human edit took precedence!
      canvas = worker.getCanvas();
      expect(canvas.sections[0].heading).toBe("Refined Intro"); // kept original refinement
      expect(canvas.sections[0].paragraphs[1]).toBe("Human Edit Para 1"); // kept human edit
      expect(canvas.sections[0].bullets[0]).toBe("Human Edit Bullet 0"); // kept human edit
    });

    test("splices the AI's new paragraph value into a human-extended paragraph when the AI's prior text is still present", async () => {
      const firstDiffs: WriterDiff[] = [
        {
          type: "section_updated",
          payload: {
            id: "section-1",
            paragraphs: ["The interviewee said something."],
          },
        },
      ];
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(firstDiffs) }],
      });
      const mockClient = {
        messages: { create: mockCreate },
      } as unknown as Anthropic;
      const worker = new WriterWorker({ interviewId: "int-1", client: mockClient });

      worker.applyToolCall("add_heading", { text: "Intro" });
      worker.appendTranscript("first chunk");
      await vi.runAllTimersAsync();

      // Human extends the paragraph but keeps the AI's wording verbatim
      // somewhere in the middle so the merge can use it as a splice anchor.
      worker.applyCanvasEdit({
        sectionId: "section-1",
        field: "paragraph_text",
        index: 0,
        value: "Quick note: The interviewee said something. — added by editor.",
      });

      // AI now wants to refine the inner sentence.
      const secondDiffs: WriterDiff[] = [
        {
          type: "section_updated",
          payload: {
            id: "section-1",
            paragraphs: ["The interviewee made a clear statement."],
          },
        },
      ];
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(secondDiffs) }],
      });
      worker.appendTranscript("second chunk");
      await vi.runAllTimersAsync();

      const canvas = worker.getCanvas();
      // The human's prefix and suffix survive; the AI's new sentence is spliced in.
      expect(canvas.sections[0].paragraphs[0]).toBe(
        "Quick note: The interviewee made a clear statement. — added by editor.",
      );
    });

    test("stashes a pending proposal when the AI wants to rewrite a paragraph the human rewrote from scratch", async () => {
      const firstDiffs: WriterDiff[] = [
        {
          type: "section_updated",
          payload: {
            id: "section-1",
            paragraphs: ["AI's original paragraph wording."],
          },
        },
      ];
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(firstDiffs) }],
      });
      const mockClient = {
        messages: { create: mockCreate },
      } as unknown as Anthropic;
      const worker = new WriterWorker({ interviewId: "int-1", client: mockClient });

      worker.applyToolCall("add_heading", { text: "Intro" });
      worker.appendTranscript("first chunk");
      await vi.runAllTimersAsync();

      worker.applyCanvasEdit({
        sectionId: "section-1",
        field: "paragraph_text",
        index: 0,
        value: "Completely rewritten by the human, no overlap.",
      });

      const proposals: unknown[] = [];
      worker.on("proposal", (p) => proposals.push(p));

      const secondDiffs: WriterDiff[] = [
        {
          type: "section_updated",
          payload: {
            id: "section-1",
            paragraphs: ["AI's polished revision of the original."],
          },
        },
      ];
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: JSON.stringify(secondDiffs) }],
      });
      worker.appendTranscript("second chunk");
      await vi.runAllTimersAsync();

      const canvas = worker.getCanvas();
      // Human's text survives intact.
      expect(canvas.sections[0].paragraphs[0]).toBe(
        "Completely rewritten by the human, no overlap.",
      );
      // A pending proposal is recorded.
      const pending = worker.getPendingProposals();
      expect(pending).toEqual([
        {
          sectionId: "section-1",
          index: 0,
          humanValue: "Completely rewritten by the human, no overlap.",
          aiValue: "AI's polished revision of the original.",
        },
      ]);
      // And was emitted on the `proposal` channel.
      expect(proposals).toHaveLength(1);
    });

    test("getRecentHumanEdits returns the buffered edits in arrival order, capped to the cap", () => {
      const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
      worker.applyToolCall("add_heading", { text: "Intro" });

      worker.applyCanvasEdit({
        sectionId: "section-1",
        field: "heading",
        value: "First Heading",
      });
      worker.applyCanvasEdit({
        sectionId: "section-1",
        field: "heading",
        value: "Second Heading",
      });

      const edits = worker.getRecentHumanEdits();
      expect(edits).toHaveLength(2);
      expect(edits[0].value).toBe("First Heading");
      expect(edits[1].value).toBe("Second Heading");
      expect(edits[1].previousValue).toBe("First Heading");
    });

    test("the writer-worker injects recent human edits into the system prompt", async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "[]" }],
      });
      const mockClient = {
        messages: { create: mockCreate },
      } as unknown as Anthropic;
      const worker = new WriterWorker({ interviewId: "int-1", client: mockClient });

      worker.applyToolCall("add_heading", { text: "Intro" });
      worker.applyCanvasEdit({
        sectionId: "section-1",
        field: "heading",
        value: "Human-Picked Heading",
      });

      worker.appendTranscript("a chunk");
      await vi.runAllTimersAsync();

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const call = mockCreate.mock.calls[0][0] as {
        system: Array<{ text: string }>;
      };
      const contextText = call.system[1].text;
      expect(contextText).toContain("Recent human edits");
      expect(contextText).toContain("§section-1 heading");
      expect(contextText).toContain("Human-Picked Heading");
    });
  });

  describe("subscribe / unsubscribe (W9.1 listener-leak regression)", () => {
    test("subscribe(cb) returns an unsubscribe fn that delivers diffs while active and stops after teardown", () => {
      const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
      const received: WriterDiff[] = [];
      const unsubscribe = worker.subscribe((diff) => received.push(diff));

      worker.applyToolCall("add_heading", { text: "First" });
      expect(received).toHaveLength(1);

      unsubscribe();

      worker.applyToolCall("add_heading", { text: "Second" });
      // No new diff should reach the listener after unsubscribe.
      expect(received).toHaveLength(1);
    });

    test("the returned unsubscribe fn is idempotent — double-invocation does not throw or remove unrelated listeners", () => {
      const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
      const otherReceived: WriterDiff[] = [];
      worker.subscribe((diff) => otherReceived.push(diff));
      const unsubscribe = worker.subscribe(() => {});

      expect(worker.getDiffListenerCount()).toBe(2);
      unsubscribe();
      expect(worker.getDiffListenerCount()).toBe(1);
      // Second invocation must NOT decrement again — that would tear down
      // the unrelated `otherReceived` listener and silently drop events.
      expect(() => unsubscribe()).not.toThrow();
      expect(worker.getDiffListenerCount()).toBe(1);

      worker.applyToolCall("add_heading", { text: "Sanity check" });
      expect(otherReceived).toHaveLength(1);
    });

    test("15 simultaneous subscribers stay under the listener cap and do not emit a MaxListenersExceededWarning", () => {
      const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
      // `MaxListenersExceededWarning` is fired on the process. Capture
      // any such warnings while we register subscribers; the assertion
      // is "zero warnings" — the previous default of 10 would have
      // tripped at subscriber #11 (exactly what the W8.4 walkthrough
      // surfaced).
      const warnings: Error[] = [];
      const onWarning = (w: Error) => {
        if (w.name === "MaxListenersExceededWarning") warnings.push(w);
      };
      process.on("warning", onWarning);
      try {
        const unsubs: Array<() => void> = [];
        for (let i = 0; i < 15; i++) {
          unsubs.push(worker.subscribe(() => {}));
        }
        expect(worker.getDiffListenerCount()).toBe(15);
        expect(warnings).toHaveLength(0);

        // Close 10 — count drops to 5.
        for (let i = 0; i < 10; i++) unsubs[i]();
        expect(worker.getDiffListenerCount()).toBe(5);

        // Close the remaining 5 — count drops to 0.
        for (let i = 10; i < 15; i++) unsubs[i]();
        expect(worker.getDiffListenerCount()).toBe(0);
      } finally {
        process.off("warning", onWarning);
      }
    });

    test("setMaxListeners is bounded to 50 — defensive cap above any realistic steady-state subscriber count", () => {
      // The constructor must raise the per-emitter cap above Node's
      // default of 10 so transient over-registration during SSE
      // reconnects does not crash. Raising the cap alone would mask
      // a leak; we raise it AND fix the leak (see `subscribe()`).
      const worker = new WriterWorker({ interviewId: "int-1", apiKey: "test-key" });
      expect(worker.getMaxListeners()).toBe(50);
    });
  });

  describe("observability logs", () => {
    test("emits idle->processing, first-chunk, and processing->completed log lines on a successful job", async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "[]" }],
      });
      const mockClient = {
        messages: { create: mockCreate },
      } as unknown as Anthropic;

      const worker = new WriterWorker({
        interviewId: "int-obs-1",
        client: mockClient,
      });

      worker.appendTranscript("Hello world");
      await vi.runAllTimersAsync();

      const transitions = mockLogInfo.mock.calls.filter(
        (c) => c[0] === "Writer job state transition",
      );
      // idle->processing then processing->completed
      expect(transitions.length).toBeGreaterThanOrEqual(2);
      expect(transitions[0][1]).toMatchObject({
        from: "idle",
        to: "processing",
        interviewId: "int-obs-1",
      });
      expect(transitions[transitions.length - 1][1]).toMatchObject({
        from: "processing",
        to: "completed",
        interviewId: "int-obs-1",
        responseSize: expect.any(Number),
        diffCount: expect.any(Number),
      });

      const firstChunkLogs = mockLogInfo.mock.calls.filter(
        (c) => c[0] === "Writer received first response chunk",
      );
      expect(firstChunkLogs).toHaveLength(1);
      expect(firstChunkLogs[0][1]).toMatchObject({
        interviewId: "int-obs-1",
        firstChunkMs: expect.any(Number),
      });
    });

    test("emits processing->failed log line on Anthropic error", async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error("boom"));
      const mockClient = {
        messages: { create: mockCreate },
      } as unknown as Anthropic;

      const worker = new WriterWorker({
        interviewId: "int-obs-2",
        client: mockClient,
      });
      // Capture the emitted error so the EventEmitter doesn't blow up the test
      worker.on("error", () => {});

      worker.appendTranscript("Hello world");
      await vi.runAllTimersAsync();

      const transitions = mockLogInfo.mock.calls.filter(
        (c) => c[0] === "Writer job state transition",
      );
      const failed = transitions.find((c) => c[1]?.to === "failed");
      expect(failed).toBeDefined();
      expect(failed?.[1]).toMatchObject({
        from: "processing",
        to: "failed",
        interviewId: "int-obs-2",
        error: "boom",
      });
    });
  });

  describe("insertParagraph cross-instance recovery (W14 P0)", () => {
    test("section_inserted then insert_paragraph against the returned id succeeds in-process", () => {
      const worker = new WriterWorker({ interviewId: "int-race-1", apiKey: "k" });
      worker.applyToolCall("insert_section", { heading: "Topic", level: 2 });
      const sections = worker.getCanvas().sections;
      expect(sections).toHaveLength(1);
      const sectionId = sections[0].id;

      const result = worker.insertParagraph({
        sectionId,
        text: "Paragraph addressing the freshly minted id.",
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.implicitSectionId).toBeUndefined();
      }
      expect(worker.getCanvas().sections[0].paragraphs).toEqual([
        "Paragraph addressing the freshly minted id.",
      ]);
    });

    test("unknown sectionId is recovered via implicit section (no content dropped) and logs the miss", () => {
      const worker = new WriterWorker({ interviewId: "int-race-2", apiKey: "k" });
      // Worker has never seen "section-1" — simulates the realtime model's
      // second tool call landing on a cold serverless instance.
      const result = worker.insertParagraph({
        sectionId: "section-1",
        text: "Paragraph that must not be silently dropped.",
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.implicitSectionId).toBeDefined();

      const sections = worker.getCanvas().sections;
      expect(sections).toHaveLength(1);
      expect(sections[0].id).toBe(result.implicitSectionId);
      expect(sections[0].heading).toBe("Untitled section");
      expect(sections[0].paragraphs).toEqual([
        "Paragraph that must not be silently dropped.",
      ]);

      const miss = mockLogWarn.mock.calls.find(
        (c) => c[0] === "paragraph_section_not_found",
      );
      expect(miss).toBeDefined();
      expect(miss?.[1]).toMatchObject({
        interviewId: "int-race-2",
        sectionId: "section-1",
        knownSectionIds: [],
      });
    });

    test("emits section_added diff for the implicit section so the client canvas stays in sync", () => {
      const worker = new WriterWorker({ interviewId: "int-race-3", apiKey: "k" });
      const diffs: unknown[] = [];
      worker.on("diff", (d) => diffs.push(d));

      worker.insertParagraph({
        sectionId: "section-7",
        text: "Recovered.",
      });

      const sectionAdded = diffs.find(
        (d): d is { type: string; payload: { id: string } } =>
          typeof d === "object" &&
          d !== null &&
          (d as { type?: string }).type === "section_added",
      );
      expect(sectionAdded).toBeDefined();
      expect(sectionAdded?.payload.id).toBe(
        worker.getCanvas().sections[0].id,
      );
    });

    test("regression: 5 rapid mint+insert pairs (no awaits between) all land in distinct sections", () => {
      const worker = new WriterWorker({ interviewId: "int-race-rapid", apiKey: "k" });

      for (let i = 0; i < 5; i++) {
        worker.applyToolCall("insert_section", { heading: `H${i + 1}`, level: 2 });
        const minted = worker.getCanvas().sections.at(-1)!.id;
        const r = worker.insertParagraph({
          sectionId: minted,
          text: `Para ${i + 1}.`,
        });
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.implicitSectionId).toBeUndefined();
      }

      const sections = worker.getCanvas().sections;
      expect(sections).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        expect(sections[i].paragraphs).toEqual([`Para ${i + 1}.`]);
      }
    });
  });

  describe("cross-instance Firestore bridge (W18.1)", () => {
    // Regression guard for the prod symptom captured in interview
    // tfYtDj0d7ZcAmRecmjAl: tool_result narration cues fire (those go via
    // WebRTC) but the canvas never updates because the writer-worker's
    // in-process EventEmitter sits on a different serverless instance
    // than the SSE route. Mirroring every diff into the shared
    // `interviews/{id}/events` subcollection bridges the gap.

    test("every emit('diff') ALSO writes a writer_diff row to D1 interview_events via appendEvents", () => {
      const worker = new WriterWorker({ interviewId: "int-bridge-1", apiKey: "k" });

      worker.applyToolCall("set_title", { title: "Bridged title" });

      // appendEvents is called synchronously inside emit() (the promise body is
      // async but the call itself fires before emit returns).
      expect(mockAppendEvents).toHaveBeenCalledTimes(1);
      // appendEvents(blogId, interviewId, events[], db?)
      const [blogId, interviewId, events] = mockAppendEvents.mock.calls[0] as [string, string, { kind: string; ts: string; payload: WriterDiff }[]];
      expect(blogId).toBe("default");
      expect(interviewId).toBe("int-bridge-1");
      expect(events).toHaveLength(1);
      expect(events[0].kind).toBe("writer_diff");
      expect(events[0].payload).toEqual({
        type: "title_updated",
        payload: { title: "Bridged title" },
      });
      expect(typeof events[0].ts).toBe("string");
    });

    test("in-process subscribers still receive every diff (the bridge is additive, not a replacement)", () => {
      const worker = new WriterWorker({ interviewId: "int-bridge-2", apiKey: "k" });
      const seen: WriterDiff[] = [];
      worker.on("diff", (d) => seen.push(d));

      worker.applyToolCall("add_heading", { text: "Intro" });
      worker.applyToolCall("add_bullet", { text: "B1" });

      expect(seen).toHaveLength(2);
      // Bridge also fired for both diffs.
      expect(mockAppendEvents).toHaveBeenCalledTimes(2);
    });

    test("emit_diff log fires for every diff with the diffType payload", () => {
      const worker = new WriterWorker({ interviewId: "int-bridge-3", apiKey: "k" });

      worker.applyToolCall("set_title", { title: "T" });

      const emitLog = mockLogInfo.mock.calls.find((c) => c[0] === "emit_diff");
      expect(emitLog).toBeDefined();
      expect(emitLog?.[1]).toMatchObject({
        interviewId: "int-bridge-3",
        diffType: "title_updated",
        willPersist: true,
      });
    });

    test("diff_persisted_to_events log fires after D1 write resolves", async () => {
      // appendEvents resolves with undefined — the success log doesn't need an id
      mockAppendEvents.mockResolvedValueOnce(undefined);
      const worker = new WriterWorker({ interviewId: "int-bridge-4", apiKey: "k" });

      worker.applyToolCall("set_title", { title: "T" });

      // Let the async appendEvents() promise resolve.
      await vi.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();

      const persistedLog = mockLogInfo.mock.calls.find(
        (c) => c[0] === "diff_persisted_to_events",
      );
      expect(persistedLog).toBeDefined();
      expect(persistedLog?.[1]).toMatchObject({
        interviewId: "int-bridge-4",
        diffType: "title_updated",
      });
    });

    test("D1 write failure logs diff_persist_failed and does NOT block in-process subscribers", async () => {
      mockAppendEvents.mockRejectedValueOnce(new Error("d1 offline"));
      const worker = new WriterWorker({ interviewId: "int-bridge-5", apiKey: "k" });
      const seen: WriterDiff[] = [];
      worker.on("diff", (d) => seen.push(d));

      // applyToolCall must not throw even when the D1 mirror
      // rejects — the bridge is best-effort.
      expect(() =>
        worker.applyToolCall("set_title", { title: "T" }),
      ).not.toThrow();
      expect(seen).toHaveLength(1);

      // Let the rejected promise settle.
      await vi.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();

      const failLog = mockLogWarn.mock.calls.find(
        (c) => c[0] === "diff_persist_failed",
      );
      expect(failLog).toBeDefined();
      expect(failLog?.[1]).toMatchObject({
        interviewId: "int-bridge-5",
        diffType: "title_updated",
        errorMessage: "d1 offline",
      });
    });
  });
});
