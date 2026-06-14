import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetArticleBySlug = vi.hoisted(() => vi.fn());

vi.mock("@/lib/articles/repository", () => ({
  getArticleBySlug: (...args: unknown[]) => mockGetArticleBySlug(...args),
}));

import addInternalLink from "./add-internal-link";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("add_internal_link tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds an internal link to a section once the slug is validated", async () => {
    mockGetArticleBySlug.mockResolvedValue({ slug: "existing", status: "published" });
    const worker = new WriterWorker({ interviewId: "int-link", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-link", worker });

    const result = await addInternalLink.handler(
      {
        sectionId: "section-1",
        paragraphId: "p-1",
        range: { start: 0, end: 5 },
        targetSlug: "existing",
      },
      ctx,
    );
    expect(result.ok).toBe(true);
    const links = worker.getCanvas().sections[0].internalLinks ?? [];
    expect(links).toHaveLength(1);
    expect(links[0].targetSlug).toBe("existing");
  });

  it("returns a validation error when the slug is unknown", async () => {
    mockGetArticleBySlug.mockResolvedValue(null);
    const worker = new WriterWorker({ interviewId: "int-link", apiKey: "k" });
    worker.applyToolCall("add_heading", { text: "Intro" });
    const ctx = buildToolContext({ interviewId: "int-link", worker });

    const result = await addInternalLink.handler(
      {
        sectionId: "section-1",
        paragraphId: "p-1",
        range: { start: 0, end: 5 },
        targetSlug: "missing",
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("validation");
  });

  it("rejects an inverted range as validation error", async () => {
    mockGetArticleBySlug.mockResolvedValue({ slug: "existing", status: "published" });
    const worker = new WriterWorker({ interviewId: "int-link", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-link", worker });
    const result = await addInternalLink.handler(
      {
        sectionId: "section-1",
        paragraphId: "p-1",
        range: { start: 5, end: 5 },
        targetSlug: "any",
      },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.category).toBe("validation");
  });
});
