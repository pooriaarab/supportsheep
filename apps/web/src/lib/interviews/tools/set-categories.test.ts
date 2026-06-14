import { describe, expect, it, vi, beforeEach } from "vitest";

const mockListCategories = vi.hoisted(() => vi.fn());

vi.mock("@/lib/categories/repository", () => ({
  listCategories: mockListCategories,
}));

import setCategories from "./set-categories";
import { WriterWorker } from "../writer-worker";
import { buildToolContext } from "./index";

describe("set_categories tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies the categories when every id exists", async () => {
    mockListCategories.mockResolvedValue([
      { slug: "cat-1" },
      { slug: "cat-2" },
    ]);
    const worker = new WriterWorker({ interviewId: "int-cat", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-cat", worker });
    const result = await setCategories.handler(
      { categoryIds: ["cat-1", "cat-2"] },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(worker.getCanvas().categories).toEqual(["cat-1", "cat-2"]);
  });

  it("returns a validation error when a category id is unknown", async () => {
    mockListCategories.mockResolvedValue([{ slug: "cat-1" }]);
    const worker = new WriterWorker({ interviewId: "int-cat", apiKey: "k" });
    const ctx = buildToolContext({ interviewId: "int-cat", worker });
    const result = await setCategories.handler(
      { categoryIds: ["cat-1", "cat-missing"] },
      ctx,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.category).toBe("validation");
      expect(result.message).toContain("cat-missing");
    }
    expect(worker.getCanvas().categories).toBeUndefined();
  });

  it("rejects more than 3 categories via the Zod schema", () => {
    const parsed = setCategories.argsSchema.safeParse({
      categoryIds: ["a", "b", "c", "d"],
    });
    expect(parsed.success).toBe(false);
  });
});
