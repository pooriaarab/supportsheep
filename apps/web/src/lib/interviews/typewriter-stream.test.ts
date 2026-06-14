import { describe, expect, it, vi } from "vitest";
import {
  AI_TYPEWRITER_CHARS_PER_TICK_MAX,
  AI_TYPEWRITER_CHARS_PER_TICK_MIN,
  AI_TYPEWRITER_TICK_MS_MAX,
  computeTypewriterPlan,
  scheduleTypewriter,
  splitIntoTypewriterChunks,
} from "./typewriter-stream";

describe("computeTypewriterPlan", () => {
  it("returns snap when prev equals next", () => {
    const plan = computeTypewriterPlan(
      "<p>hello world</p>",
      "<p>hello world</p>",
    );
    expect(plan.kind).toBe("snap");
  });

  it("returns snap when prev is empty (hydration path)", () => {
    const plan = computeTypewriterPlan("", "<p>hello</p>");
    expect(plan.kind).toBe("snap");
  });

  it("returns snap when next does not strictly extend prev", () => {
    const plan = computeTypewriterPlan(
      "<p>hello</p><p>world</p>",
      "<p>hello</p>",
    );
    expect(plan.kind).toBe("snap");
  });

  it("returns snap when prev's existing paragraph was rewritten", () => {
    // Editing an in-flight paragraph (the AI grew it from 'hello' to
    // 'hello world') is NOT a strict-prefix extension because '</p>'
    // moved — the consumer should snap-apply instead.
    const plan = computeTypewriterPlan(
      "<p>hello</p>",
      "<p>hello world</p>",
    );
    expect(plan.kind).toBe("snap");
  });

  it("streams when a fresh paragraph is appended after the previous content", () => {
    const prev = "<p>intro</p>";
    const next = "<p>intro</p><p>The next sentence.</p>";
    const plan = computeTypewriterPlan(prev, next);
    expect(plan.kind).toBe("stream");
    if (plan.kind === "stream") {
      expect(plan.prefix).toBe(prev);
      expect(plan.paragraphOpen).toBe("<p>");
      expect(plan.paragraphClose).toBe("</p>");
      expect(plan.innerText).toBe("The next sentence.");
    }
  });

  it("snaps when the appended paragraph contains inline HTML (bold, link)", () => {
    const plan = computeTypewriterPlan(
      "<p>intro</p>",
      '<p>intro</p><p>See <a href="x">here</a>.</p>',
    );
    expect(plan.kind).toBe("snap");
  });

  it("snaps when the appended payload includes a code block", () => {
    const plan = computeTypewriterPlan(
      "<p>before</p>",
      "<p>before</p><pre><code>x</code></pre>",
    );
    expect(plan.kind).toBe("snap");
  });

  it("snaps when the appended payload includes an image figure", () => {
    const plan = computeTypewriterPlan(
      "<p>before</p>",
      '<p>before</p><figure><img src="x"/></figure>',
    );
    expect(plan.kind).toBe("snap");
  });

  it("snaps when the appended payload includes an iframe embed", () => {
    const plan = computeTypewriterPlan(
      "<p>before</p>",
      '<p>before</p><iframe src="https://x"></iframe>',
    );
    expect(plan.kind).toBe("snap");
  });

  it("snaps when the appended payload is a heading", () => {
    const plan = computeTypewriterPlan(
      "<p>before</p>",
      "<p>before</p><h2>A new section</h2>",
    );
    expect(plan.kind).toBe("snap");
  });
});

describe("splitIntoTypewriterChunks", () => {
  it("preserves the original text when joined back", () => {
    const text = "The quick brown fox jumps over the lazy dog.";
    const chunks = splitIntoTypewriterChunks(text);
    expect(chunks.join("")).toBe(text);
  });

  it("respects the chunk size range", () => {
    const text = "a".repeat(200);
    const chunks = splitIntoTypewriterChunks(text);
    for (const c of chunks) {
      expect(c.length).toBeGreaterThanOrEqual(1);
      expect(c.length).toBeLessThanOrEqual(AI_TYPEWRITER_CHARS_PER_TICK_MAX);
    }
    // All but the last chunk land inside the configured range.
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i].length).toBeGreaterThanOrEqual(
        AI_TYPEWRITER_CHARS_PER_TICK_MIN,
      );
    }
  });

  it("yields a deterministic schedule for a fixed RNG", () => {
    const seed = mulberrySeed(42);
    const chunks = splitIntoTypewriterChunks("abcdefghijklmnopqrstuvwxyz", {
      rand: seed,
    });
    expect(chunks.join("")).toBe("abcdefghijklmnopqrstuvwxyz");
    // 26 chars, chunked at 8-24 → between 2 and 4 chunks.
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.length).toBeLessThanOrEqual(4);
  });
});

describe("scheduleTypewriter", () => {
  it("streams a 100-char paragraph as 5-13 sequential setContent updates", () => {
    vi.useFakeTimers();
    try {
      const prefix = "<p>seed</p>";
      const innerText = "x".repeat(100);
      const updates: string[] = [];
      let done = false;
      const cancel = scheduleTypewriter(
        {
          kind: "stream",
          prefix,
          paragraphOpen: "<p>",
          paragraphClose: "</p>",
          innerText,
        },
        {
          onIntermediate: (html) => updates.push(html),
          onComplete: () => {
            done = true;
          },
        },
        {
          timer: {
            setTimeout: ((fn: () => void, ms: number) =>
              setTimeout(fn, ms)) as unknown as (
              fn: () => void,
              ms: number,
            ) => unknown,
            clearTimeout: (h: unknown) =>
              clearTimeout(h as ReturnType<typeof setTimeout>),
          },
        },
      );

      // Advance enough wall-time to flush the longest possible schedule
      // (35 ms tick × 100 chars ÷ 8 chunk min ≈ 0.5 s).
      vi.advanceTimersByTime(5_000);

      // Defensive: cancel after the schedule completes so the test never
      // leaks a pending timer.
      cancel();

      expect(done).toBe(true);
      // 100 chars, 8-24 per chunk → between 5 and 13 chunks.
      expect(updates.length).toBeGreaterThanOrEqual(4);
      expect(updates.length).toBeLessThanOrEqual(13);
      // Every intermediate starts with the prefix + open tag.
      for (const u of updates) {
        expect(u.startsWith(prefix + "<p>")).toBe(true);
        expect(u.endsWith("</p>")).toBe(true);
      }
      // Last intermediate equals the full target.
      expect(updates[updates.length - 1]).toBe(`${prefix}<p>${innerText}</p>`);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancel() halts further updates and never calls onComplete", () => {
    vi.useFakeTimers();
    try {
      const updates: string[] = [];
      let done = false;
      // Use a payload long enough that the post-cancel flush genuinely has
      // queued ticks left to drop. With the W24.B speed bump (8-24 chars
      // per tick, 15-35 ms per tick) a 26-char payload can finish entirely
      // within two ticks, leaving nothing for `cancel()` to suppress.
      const cancel = scheduleTypewriter(
        {
          kind: "stream",
          prefix: "<p>seed</p>",
          paragraphOpen: "<p>",
          paragraphClose: "</p>",
          innerText: "a".repeat(400),
        },
        {
          onIntermediate: (html) => updates.push(html),
          onComplete: () => {
            done = true;
          },
        },
        {
          timer: {
            setTimeout: ((fn: () => void, ms: number) =>
              setTimeout(fn, ms)) as unknown as (
              fn: () => void,
              ms: number,
            ) => unknown,
            clearTimeout: (h: unknown) =>
              clearTimeout(h as ReturnType<typeof setTimeout>),
          },
        },
      );

      // Let one or two ticks fire, then cancel.
      vi.advanceTimersByTime(AI_TYPEWRITER_TICK_MS_MAX * 2);
      const beforeCancel = updates.length;
      cancel();
      // Flush whatever was queued — none should land.
      vi.advanceTimersByTime(5_000);
      expect(updates.length).toBe(beforeCancel);
      expect(done).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * Minimal seedable PRNG (mulberry32) — keeps the schedule deterministic
 * across runs so the chunk-count assertions are stable.
 */
function mulberrySeed(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
