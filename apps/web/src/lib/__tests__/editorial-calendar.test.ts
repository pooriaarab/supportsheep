import { describe, expect, it } from "vitest";
import {
  BLOG_EDITORIAL_BATCH,
  buildEditorialSchedule,
} from "@/lib/editorial-calendar";

describe("BLOG_EDITORIAL_BATCH", () => {
  it("defines 30 posts with unique slugs", () => {
    expect(BLOG_EDITORIAL_BATCH).toHaveLength(30);

    const slugs = BLOG_EDITORIAL_BATCH.map((post) => post.slug);
    expect(new Set(slugs).size).toBe(30);
  });
});

describe("buildEditorialSchedule", () => {
  it("spreads 30 posts across a 14-day publishing window", () => {
    const slots = Array.from({ length: 30 }, (_, index) =>
      buildEditorialSchedule("2026-04-24", index),
    );
    const countsByDay = slots.reduce<Record<string, number>>((acc, slot) => {
      const day = slot.slice(0, 10);
      acc[day] = (acc[day] ?? 0) + 1;
      return acc;
    }, {});

    expect(Object.keys(countsByDay)).toHaveLength(14);
    expect(Object.values(countsByDay)).toEqual([
      3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
    ]);
  });
});
