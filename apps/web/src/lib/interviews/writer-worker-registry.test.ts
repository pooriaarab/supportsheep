import { describe, test, expect, vi, afterEach } from "vitest";
import { getOrCreateWorker, getWorker, disposeWorker } from "./writer-worker-registry";

// Mock logger
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
  withStructuredLog: async (
    _log: unknown,
    _operation: string,
    _context: Record<string, unknown>,
    fn: () => Promise<unknown>,
  ) => fn(),
  // Stubbed so `@/lib/correlation`'s module-level `registerCorrelationIdGetter`
  // call (now reachable via the tools dispatcher import graph from `clearSessionState`)
  // doesn't throw when the logger mock above replaces the real export.
  registerCorrelationIdGetter: () => {},
}));

describe("WriterWorkerRegistry", () => {
  afterEach(() => {
    // Clean up registry state by disposing workers
    disposeWorker("int-1");
    disposeWorker("int-2");
  });

  test("getOrCreateWorker is single-instance and retrieves correctly", () => {
    const worker1 = getOrCreateWorker({ interviewId: "int-1", apiKey: "test-key" });
    const worker2 = getOrCreateWorker({ interviewId: "int-1", apiKey: "test-key" });

    expect(worker1).toBe(worker2);

    const retrieved = getWorker("int-1");
    expect(retrieved).toBe(worker1);
  });

  test("getWorker returns null if not created", () => {
    expect(getWorker("int-2")).toBeNull();
  });

  test("disposeWorker removes the worker and listeners", () => {
    const worker = getOrCreateWorker({ interviewId: "int-1", apiKey: "test-key" });
    let count = 0;
    worker.on("diff", () => {
      count++;
    });

    worker.emit("diff", { type: "title_updated", payload: { title: "Title" } });
    expect(count).toBe(1);

    disposeWorker("int-1");

    expect(getWorker("int-1")).toBeNull();

    // Emitting on the old worker should not trigger registry effects, and its listeners are cleared
    worker.emit("diff", { type: "title_updated", payload: { title: "Title" } });
    expect(count).toBe(1); // listener was removed
  });

  test("disposeWorker is idempotent", () => {
    expect(() => disposeWorker("non-existent")).not.toThrow();
  });

  test("W20b: getOrCreateWorker seeds a fresh worker from hydrateFrom snapshot", () => {
    // Cross-instance recovery: when a tool batch lands on a cold lambda
    // the freshly-minted worker must start in sync with the persisted
    // canvas snapshot so `insert_paragraph(section-1, …)` finds the
    // section rather than dropping into an implicit "Untitled section".
    const snapshot = {
      title: "Hydrated Title",
      sections: [
        {
          id: "section-3",
          heading: "Pre-existing",
          bullets: [],
          paragraphs: ["Existing paragraph."],
          quotes: [],
          finalized: false,
        },
      ],
      meta: { description: null, tags: [], suggestedCategory: null },
    };
    const worker = getOrCreateWorker({
      interviewId: "int-1",
      apiKey: "test-key",
      hydrateFrom: snapshot,
    });
    const canvas = worker.getCanvas();
    expect(canvas.title).toBe("Hydrated Title");
    expect(canvas.sections).toHaveLength(1);
    expect(canvas.sections[0].id).toBe("section-3");

    // Newly minted section ids must be monotonic relative to the hydrated
    // state — without bumping nextSectionSeq, the next `insert_section`
    // would mint `section-1` and collide with the snapshot's ids on a
    // future batch.
    const newSectionId = worker["mintSectionId"]() as string;
    expect(newSectionId).toBe("section-4");
  });

  test("W20b: getOrCreateWorker ignores hydrateFrom on a returning worker", () => {
    // If a lambda already has an in-memory worker for this interview,
    // re-hydrating from a possibly-stale snapshot would clobber
    // freshly-mutated local state. The registry must short-circuit on
    // existing workers regardless of `hydrateFrom`.
    const first = getOrCreateWorker({ interviewId: "int-1", apiKey: "test-key" });
    first.applyToolCall("set_title", { title: "Local Title" });

    const staleSnapshot = {
      title: "Stale Snapshot Title",
      sections: [],
      meta: { description: null, tags: [], suggestedCategory: null },
    };
    const second = getOrCreateWorker({
      interviewId: "int-1",
      apiKey: "test-key",
      hydrateFrom: staleSnapshot,
    });
    expect(second).toBe(first);
    expect(second.getCanvas().title).toBe("Local Title");
  });
});
