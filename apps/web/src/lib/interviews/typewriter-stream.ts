/**
 * Typewriter stream scheduler for the live AI canvas.
 *
 * The writer-worker streams content into the canvas as full HTML snapshots
 * via SSE `writer_diff` events. When a new snapshot lands the editor was
 * previously re-serialising the entire HTML in one `setContent` call, so a
 * fresh paragraph would pop in atomically. That reads as "the AI dumped a
 * wall of text" rather than as a teammate typing — the cursor never moves
 * between characters and the eye has nothing to follow.
 *
 * This module decomposes a target HTML snapshot whose only change vs the
 * previous snapshot is "a new paragraph appended to the end of the
 * document" into a sequence of intermediate HTML snapshots that
 * progressively reveal the new paragraph's inner text a few characters at
 * a time. The consumer (`useCanvasEditorSync`) feeds each intermediate
 * into the editor with `emitUpdate: false`, animating the new text in
 * like keystrokes.
 *
 * Pure module — no React, no DOM. The whole pipeline is driven through a
 * caller-provided timer so Vitest fake-timers can step through the
 * schedule deterministically.
 */

/**
 * Chunk size range (inclusive). Each tick reveals between
 * `AI_TYPEWRITER_CHARS_PER_TICK_MIN` and `AI_TYPEWRITER_CHARS_PER_TICK_MAX`
 * characters from the appended-text payload. Tuned for an early "wow"
 * effect on first-call walkthroughs — a ~16-char midpoint lands paragraphs
 * roughly twice as fast as a human typing burst while still reading as
 * typed-in rather than dumped.
 */
export const AI_TYPEWRITER_CHARS_PER_TICK_MIN = 8;
export const AI_TYPEWRITER_CHARS_PER_TICK_MAX = 24;

/**
 * Per-tick delay range in milliseconds. The variance between ticks is the
 * single biggest factor in the animation feeling "human" vs "robotic" —
 * uniform ticks read as a teleprompter; jittering 15-35 ms keeps the
 * organic feel while pushing the visible writing speed up so the canvas
 * fills in within the first 30-60 seconds of a call.
 */
export const AI_TYPEWRITER_TICK_MS_MIN = 15;
export const AI_TYPEWRITER_TICK_MS_MAX = 35;

/**
 * Substrings whose presence inside the appended payload disables the
 * typewriter and forces a snap-apply. Code blocks, embeds, images,
 * tables, and figures should always appear at once — character-by-
 * character reveal of a `<pre>` block produces a broken HTML half-state
 * on every tick and reads worse than an atomic insert.
 */
const STRUCTURAL_TAGS = [
  "<pre",
  "<code",
  "<img",
  "<iframe",
  "<figure",
  "<table",
  "<picture",
  "<video",
  "<audio",
  "<blockquote",
  "<ul",
  "<ol",
  "<hr",
  "<h1",
  "<h2",
  "<h3",
  "<h4",
] as const;

/**
 * Tags whose inner text can be safely animated character-by-character.
 * Currently just `<p>` — the dominant AI output. A future revision could
 * extend this to list items by streaming the trailing `<li>` of a list.
 */
const STREAMABLE_OPEN = "<p>";
const STREAMABLE_CLOSE = "</p>";

/**
 * Describes how a new canvas-HTML snapshot relates to the previously
 * rendered one. `stream` means the new snapshot adds exactly one trailing
 * paragraph that can be revealed character-by-character. `snap` means the
 * diff is structural (lists changed, code block landed, content removed,
 * existing paragraph rewritten) and the editor should apply the new HTML
 * in one shot.
 */
export type TypewriterPlan =
  | {
      kind: "stream";
      /**
       * The HTML that stays unchanged on the left of every intermediate
       * snapshot. Equals the previously rendered HTML.
       */
      prefix: string;
      /**
       * The opening tag of the newly appended paragraph (always `<p>`
       * today). Rendered as `prefix + paragraphOpen + revealed +
       * paragraphClose` for each intermediate so the editor never sees a
       * half-open tag.
       */
      paragraphOpen: string;
      /** The closing tag of the newly appended paragraph (`</p>`). */
      paragraphClose: string;
      /**
       * The inner text the typewriter must reveal one chunk at a time.
       * Does not include the surrounding `<p>`/`</p>` tags.
       */
      innerText: string;
    }
  | { kind: "snap" };

/**
 * Decide whether the transition from `prev` to `next` can be typewritered.
 * Returns `{ kind: "stream", … }` only when the only delta is a single
 * trailing `<p>…</p>` paragraph appended to `prev`, and the inner text of
 * that paragraph contains no structural tags. Otherwise returns `{ kind:
 * "snap" }` so the consumer falls back to a single atomic `setContent`.
 *
 * The "single trailing paragraph" rule is conservative on purpose. Any
 * structural rewrite (list reorder, paragraph removed, section merged,
 * image landed, heading updated) trips it and the consumer snaps. That
 * preserves correctness — the typewriter never tries to morph one
 * structure into another, only to grow a fresh paragraph's body.
 *
 * Pure and exported for unit testing.
 */
export function computeTypewriterPlan(
  prev: string,
  next: string,
): TypewriterPlan {
  if (prev === next) return { kind: "snap" };
  // First sync (hydration) — caller decides whether to skip; this module
  // defaults to "snap" so a refresh paints the existing canvas instantly.
  if (prev === "") return { kind: "snap" };
  if (!next.startsWith(prev)) return { kind: "snap" };
  const appended = next.slice(prev.length);
  if (appended.length === 0) return { kind: "snap" };
  if (!appended.startsWith(STREAMABLE_OPEN)) return { kind: "snap" };
  if (!appended.endsWith(STREAMABLE_CLOSE)) return { kind: "snap" };
  const innerText = appended.slice(
    STREAMABLE_OPEN.length,
    appended.length - STREAMABLE_CLOSE.length,
  );
  if (innerText.length === 0) return { kind: "snap" };
  // Reject if the inner text contains any tag at all — strong indicator
  // we'd otherwise reveal half of an `<a>` or `<strong>` and produce a
  // broken intermediate. Conservative: this drops a few legitimate cases
  // (paragraph with bold/inline links) which then snap-apply instead.
  if (innerText.includes("<")) return { kind: "snap" };
  for (const tag of STRUCTURAL_TAGS) {
    if (appended.includes(tag)) return { kind: "snap" };
  }
  return {
    kind: "stream",
    prefix: prev,
    paragraphOpen: STREAMABLE_OPEN,
    paragraphClose: STREAMABLE_CLOSE,
    innerText,
  };
}

/**
 * Random integer in `[min, max]` (inclusive). Uses the caller-supplied
 * `rand` so tests can pin the schedule deterministically.
 */
function randInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

/**
 * Split an appended-text payload into the sequence of chunks the
 * typewriter will reveal one per tick. Each chunk is `[chunkMin, chunkMax]`
 * characters long; the last chunk may be shorter if the payload doesn't
 * divide evenly. Pure and exported so tests can assert chunk sizing.
 */
export function splitIntoTypewriterChunks(
  appended: string,
  opts: {
    chunkMin?: number;
    chunkMax?: number;
    rand?: () => number;
  } = {},
): string[] {
  const chunkMin = opts.chunkMin ?? AI_TYPEWRITER_CHARS_PER_TICK_MIN;
  const chunkMax = opts.chunkMax ?? AI_TYPEWRITER_CHARS_PER_TICK_MAX;
  const rand = opts.rand ?? Math.random;
  const chunks: string[] = [];
  let i = 0;
  while (i < appended.length) {
    const size = randInt(rand, chunkMin, chunkMax);
    chunks.push(appended.slice(i, i + size));
    i += size;
  }
  return chunks;
}

/**
 * Caller-supplied timer so unit tests can drive the schedule with Vitest
 * fake-timers. The real renderer wires this to `window.setTimeout` /
 * `window.clearTimeout`.
 */
export interface TypewriterTimer {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

/**
 * Schedules a typewriter animation over `plan.innerText`, invoking
 * `onIntermediate(prefix + paragraphOpen + revealed + paragraphClose)`
 * for each intermediate snapshot and `onComplete()` once the full text
 * has been revealed.
 *
 * The scheduling is driven entirely through the supplied `timer` so unit
 * tests can step the clock without monkey-patching `setTimeout`. Pure
 * aside from the side-effectful callbacks the caller provides.
 *
 * Returns a `cancel` function the caller invokes when:
 *   - the human starts typing (cancel and snap-apply the latest target)
 *   - a brand-new target snapshot arrives mid-stream (cancel and restart)
 *   - the component unmounts
 *
 * `cancel()` does NOT auto-flush — the caller decides whether to snap to
 * the latest target or leave the editor at whatever intermediate the
 * stream had reached.
 */
export function scheduleTypewriter(
  plan: Extract<TypewriterPlan, { kind: "stream" }>,
  callbacks: {
    onIntermediate: (html: string) => void;
    onComplete: () => void;
  },
  opts: {
    timer: TypewriterTimer;
    chunkMin?: number;
    chunkMax?: number;
    tickMsMin?: number;
    tickMsMax?: number;
    rand?: () => number;
  },
): () => void {
  const tickMsMin = opts.tickMsMin ?? AI_TYPEWRITER_TICK_MS_MIN;
  const tickMsMax = opts.tickMsMax ?? AI_TYPEWRITER_TICK_MS_MAX;
  const rand = opts.rand ?? Math.random;
  const chunks = splitIntoTypewriterChunks(plan.innerText, {
    chunkMin: opts.chunkMin,
    chunkMax: opts.chunkMax,
    rand,
  });

  let cancelled = false;
  let revealed = "";
  let i = 0;
  let handle: unknown = null;

  const buildIntermediate = (text: string): string =>
    plan.prefix + plan.paragraphOpen + text + plan.paragraphClose;

  const tick = () => {
    if (cancelled) return;
    if (i >= chunks.length) {
      callbacks.onComplete();
      return;
    }
    revealed += chunks[i];
    i += 1;
    callbacks.onIntermediate(buildIntermediate(revealed));
    const delay = randInt(rand, tickMsMin, tickMsMax);
    handle = opts.timer.setTimeout(tick, delay);
  };

  // First tick fires asynchronously so the cancel handle is returned to
  // the caller before any side-effect runs — matches the canonical
  // setTimeout(fn, 0) idiom for "kick off on the next macrotask".
  handle = opts.timer.setTimeout(tick, randInt(rand, tickMsMin, tickMsMax));

  return () => {
    cancelled = true;
    if (handle !== null) {
      opts.timer.clearTimeout(handle);
      handle = null;
    }
  };
}
