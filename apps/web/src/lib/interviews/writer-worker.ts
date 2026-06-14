import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { EventEmitter } from "node:events";
import { createAnthropicClient } from "@/lib/ai/anthropic-client";
import { getDb } from "@/db";
import { appendEvents } from "./events-repository";
import { createLogger, withStructuredLog } from "@/lib/logger";
import { type InterviewLanguage, LANGUAGE_NAMES } from "./share-link-schema";
import {
  ensureParagraphMetadata,
  findParagraph,
  mintParagraphId,
} from "./tools/_paragraph-ids";
import {
  formatHumanEditsForPrompt,
  mergeParagraphEdit,
  type HumanEditEntry,
} from "./human-edit-merge";

const log = createLogger("interviews:writer-worker");

export type ParagraphAlignment = "left" | "center" | "right" | "justify";

/**
 * Discriminated union of block-level canvas content beyond the
 * standard bullets/paragraphs/quotes — added by Phase 4 tools
 * (blockquotes, code blocks, callouts, dividers, tables) and the
 * generic embed kinds (YouTube/Tweet/Iframe/CodePen/Gist/Loom).
 *
 * The renderer uses the `type` (and `kind` for embeds) to pick the
 * right TipTap node when transferring the canvas to the editor.
 * Each block has a stable `id` so subsequent edit/delete tools can
 * target it without ambiguity.
 */
export type CanvasBlock =
  | { id: string; type: "blockquote"; text: string; attribution?: string }
  | { id: string; type: "code_block"; language: string; code: string }
  | {
      id: string;
      type: "callout";
      kind: "info" | "warning" | "success" | "danger";
      title?: string;
      body: string;
    }
  | { id: string; type: "divider" }
  | {
      id: string;
      type: "table";
      rows: number;
      cols: number;
      headers?: string[];
    }
  | {
      id: string;
      type: "embed";
      /** Discriminator across the six supported embed providers. */
      kind: "youtube" | "tweet" | "iframe" | "codepen" | "gist" | "loom";
      /** Canonical URL/iframe src — the renderer wraps this in a sandboxed iframe. */
      src: string;
      /** Provider-specific attributes (videoId, startSeconds, defaultTab, file, …). */
      attrs?: Record<string, unknown>;
    };

/**
 * Pre-id input shape for `WriterWorker.insertBlock(...)`. Each branch
 * mirrors a `CanvasBlock` variant but without the `id` field — the
 * worker mints stable ids itself. Spelled out as an explicit union
 * (instead of `Omit<CanvasBlock, "id">`) because `Omit` distributing
 * through a discriminated union strips the variant discriminator from
 * each branch, defeating exhaustive checks at the call site.
 */
export type CanvasBlockInput =
  | { type: "blockquote"; text: string; attribution?: string }
  | { type: "code_block"; language: string; code: string }
  | {
      type: "callout";
      kind: "info" | "warning" | "success" | "danger";
      title?: string;
      body: string;
    }
  | { type: "divider" }
  | {
      type: "table";
      rows: number;
      cols: number;
      headers?: string[];
    }
  | {
      type: "embed";
      kind: "youtube" | "tweet" | "iframe" | "codepen" | "gist" | "loom";
      src: string;
      attrs?: Record<string, unknown>;
    };

/**
 * An image attached to the canvas — either the featured/hero image or
 * an inline image inside a section. Surfaced to the editor when the
 * Phase 5 image tools (`request_featured_image`, `insert_inline_image`,
 * etc.) complete their background generation jobs.
 */
export interface CanvasImageAttribution {
  /** Image source (Unsplash today; Pexels/etc. in future). */
  source: "unsplash";
  /** Photographer / contributor name to credit. */
  name: string;
  /** Link to the photographer's profile. */
  url: string;
  /** Link to the photo on the source platform. */
  photoUrl: string;
}

export interface CanvasImage {
  /** Stable id minted by the worker. */
  id: string;
  /** Public URL of the generated or supplied image. */
  url: string;
  /** Accessibility alt text. Defaults to the prompt for AI-generated images. */
  alt: string;
  /** Original prompt — preserved for dedupe + regenerate flows. */
  prompt?: string;
  /** Image source: `ai` for generated, `unsplash` for stock. */
  source?: "ai" | "unsplash";
  /** Attribution metadata for stock photos. Required by Unsplash ToS. */
  attribution?: CanvasImageAttribution;
  /**
   * Where the image lives on the canvas. `featured` is the hero image;
   * `inline` is anchored to a section + optional paragraph index.
   */
  placement:
    | { kind: "featured" }
    | { kind: "inline"; sectionId: string; afterParagraphIndex?: number };
}

export interface CanvasSection {
  id: string;            // stable id (e.g., "section-1")
  heading: string | null;
  /**
   * Optional heading level (2|3|4). Default 2 when unset — preserves the
   * pre-Phase-2 behaviour where every scaffold heading rendered as an H2.
   * Set by the `set_heading_level` tool and read by the renderer.
   */
  level?: 2 | 3 | 4;
  bullets: string[];     // placeholders from realtime, refined by writer
  paragraphs: string[];  // refined prose from writer
  quotes: Array<{ text: string; attributedTo: string }>;
  /**
   * Optional rich blocks added by Phase 4 tools (callouts, code blocks,
   * tables, embeds, …). Kept optional so existing persisted canvases
   * round-trip without a migration; treat `undefined` as `[]`.
   */
  blocks?: CanvasBlock[];
  /** Inline images attached to this section (Phase 5). */
  inlineImages?: CanvasImage[];
  /**
   * Internal links applied via `add_internal_link` — kept as a
   * lightweight side-table so we can re-render them without scanning
   * paragraph text for anchors.
   */
  internalLinks?: Array<{
    paragraphId: string;
    range: { start: number; end: number };
    targetSlug: string;
  }>;
  finalized: boolean;
  /**
   * Stable per-paragraph identifiers used by the realtime tool catalog
   * (`insert_paragraph`, `delete_paragraph`, `move_paragraph`, etc).
   * Parallel array to `paragraphs` — `paragraphIds[i]` addresses
   * `paragraphs[i]`. Lazy: only populated once a paragraph tool first
   * touches the section. UI / writer-worker JSON refinement do not
   * depend on these; legacy `string[]` semantics are unchanged.
   */
  paragraphIds?: string[];
  /**
   * Optional per-paragraph alignment (set by the realtime `set_alignment`
   * tool). Parallel array to `paragraphs`. `undefined` slots fall back to
   * the editor default ("left").
   */
  paragraphAlignments?: (ParagraphAlignment | undefined)[];
  /**
   * Optional list blocks inside the section. Phase 3 introduces this
   * field so the realtime model can group paragraphs into bullet /
   * numbered / checklist blocks. Absent on legacy sections; only
   * populated when a `convert_to_*_list` tool runs.
   */
  lists?: CanvasList[];
}

/**
 * A list block embedded in a section. `kind` mirrors TipTap's
 * BulletList / OrderedList / TaskList extensions.
 */
export interface CanvasList {
  id: string;          // stable id e.g. "list-1"
  kind: "bullet" | "numbered" | "checklist";
  items: CanvasListItem[];
}

export interface CanvasListItem {
  id: string;          // stable id e.g. "list-1-item-1"
  text: string;        // may contain inline markdown marks (see Phase 3 marks)
  /** Only meaningful when the parent list `kind === "checklist"`. */
  checked?: boolean;
  /** Nesting depth, 0-indexed. 0 = top-level item. */
  level: number;
}

/** Output of an SEO score request — surfaced to the editor sidebar. */
export interface CanvasSeoScore {
  score: number;
  issues: string[];
  suggestions: string[];
  /** ISO timestamp the score was generated at. */
  scoredAt: string;
}

/** Internal-link suggestion from `suggest_internal_links`. */
export interface CanvasInternalLinkSuggestion {
  phrase: string;
  targetSlug: string;
  reason: string;
}

export interface CanvasState {
  title: string | null;
  /**
   * Optional fields driven by Phase 2 title-meta tools. They are nullable
   * so the existing canvas snapshots (no subtitle/slug/SEO meta) keep
   * deserializing as-is — the writer-worker never strips these even if
   * the tool was never called in a session.
   */
  subtitle?: string | null;
  slug?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  sections: CanvasSection[];
  meta: { description: string | null; tags: string[]; suggestedCategory: string | null };
  /** Hero image (Phase 5). Undefined until requested; null when removed. */
  featuredImage?: CanvasImage | null;
  /** SEO keyword list — set by `set_keywords`. */
  keywords?: string[];
  /** Category ids — set by `set_categories`. Validated against Firestore. */
  categories?: string[];
  /** Tag names — set by `set_tags`. */
  tags?: string[];
  /** Most recent SEO score from `request_seo_score`. */
  seoScore?: CanvasSeoScore | null;
  /** Most recent internal-link suggestions from `suggest_internal_links`. */
  internalLinkSuggestions?: CanvasInternalLinkSuggestion[];
}

export interface WriterDiff {
  type:
    | "section_added"
    | "section_updated"
    | "section_removed"
    | "sections_reordered"
    | "section_merged"
    | "section_block_added"
    | "title_updated"
    | "subtitle_updated"
    | "slug_updated"
    | "seo_meta_updated"
    | "meta_updated"
    | "section_finalized"
    | "list_added"
    | "list_updated"
    | "featured_image_updated"
    | "inline_image_added"
    | "image_alt_updated"
    | "seo_score_updated"
    | "internal_link_suggestions_updated"
    | "internal_link_added"
    | "keywords_updated"
    | "categories_updated"
    | "tags_updated"
    | "upsert_paragraph";
  payload:
    | Partial<CanvasSection>
    | {
        title?: string;
        subtitle?: string | null;
        slug?: string | null;
        metaTitle?: string | null;
        metaDescription?: string | null;
        meta?: CanvasState["meta"];
      }
    | { sectionId: string }
    | { sectionId: string; block: CanvasBlock }
    | { sectionIds: string[] }
    | { fromSectionId: string; intoSectionId: string }
    | { sectionId: string; list: CanvasList }
    | { sectionId: string; listId: string; list?: CanvasList }
    | { image: CanvasImage | null; reason?: string }
    | { sectionId: string; image: CanvasImage }
    | { imageId: string; alt: string }
    | { score: CanvasSeoScore }
    | { suggestions: CanvasInternalLinkSuggestion[] }
    | {
        sectionId: string;
        paragraphId: string;
        range: { start: number; end: number };
        targetSlug: string;
      }
    | { keywords: string[] }
    | { categories: string[] }
    | { tags: string[] }
    | { sectionId?: string; paragraphId: string; text: string };
}

/** Maximum number of recent human edits retained for prompt injection.
 *  Keeps the system prompt bounded for long interviews while still
 *  giving the model enough context to avoid undoing the human's
 *  last few rewrites. */
const MAX_RECENT_HUMAN_EDITS = 20;

const WRITER_SYSTEM_PROMPT = `
You are a quality writer who refines coarse, realtime-generated article scaffolding into polished prose.
The coarse model emits tool calls like add_heading, add_bullet, start_paragraph, add_quote, finalize_section.
Your job: read the transcript chunks + the current canvas state, and emit precise diffs to:
- refine bullets into smooth, factual prose (preserve verbatim quotes from the speaker)
- compose paragraphs from the speaker's actual words, translating or phrasing them in the target Language when requested
- write all headings, paragraphs, titles, and SEO meta exclusively in the specified target Language
- update the title when material warrants
- maintain SEO meta (description, tags, suggested category)
- mark sections as finalized when they read as publish-ready

Output strictly as a JSON array of WriterDiff objects. Empty array if no changes warranted.
Do NOT fabricate quotes. Do NOT invent facts. Only refine what the speaker said.

Allowed diff "type" values (any other value is dropped by the runtime):
section_added, section_updated, section_removed, sections_reordered,
section_merged, section_block_added, section_finalized, title_updated,
subtitle_updated, slug_updated, seo_meta_updated, meta_updated, list_added,
list_updated, featured_image_updated, inline_image_added, image_alt_updated,
seo_score_updated, internal_link_suggestions_updated, internal_link_added,
keywords_updated, categories_updated, tags_updated, upsert_paragraph.

To rewrite a single paragraph, prefer { type: "upsert_paragraph", payload: { sectionId, paragraphId, text } }
over a full section_updated, so the client can update in place without replacing untouched paragraphs.
`.trim();

export interface WriterWorkerOptions {
  interviewId: string;
  topic?: string;
  goal?: string;
  language?: InterviewLanguage;
  /**
   * Claude API key. Resolve via `getProviderApiKey("claude")` before
   * constructing — the worker stays sync to keep the in-memory registry simple.
   * Optional only if `client` is provided (e.g. in tests).
   */
  apiKey?: string;
  client?: Anthropic; // for tests
}

/** Callback shape for diff subscribers — see `WriterWorker.subscribe`. */
export type DiffListener = (diff: WriterDiff) => void;

/** Returned by `WriterWorker.subscribe` — call to remove the listener. */
export type UnsubscribeFn = () => void;

/**
 * Upper bound on concurrent diff subscribers per worker before Node's
 * EventEmitter prints a `MaxListenersExceededWarning`. The previous
 * default (10) was too tight: a single interview session can transiently
 * register more than 10 listeners during SSE reconnects (W9.1) — the
 * outgoing connection's abort fires after the new one has already
 * subscribed. Raising the cap alone would have masked the underlying
 * leak; we ALSO fix the leak by routing every subscribe through an
 * explicit `subscribe()` API whose returned unsubscribe is wired to the
 * SSE controller's abort signal. The cap exists as a defence-in-depth
 * guard against transient over-registration; tests assert the steady
 * state stays well below it.
 */
const MAX_DIFF_LISTENERS = 50;

export class WriterWorker extends EventEmitter {
  private state: CanvasState = {
    title: null,
    subtitle: null,
    slug: null,
    metaTitle: null,
    metaDescription: null,
    sections: [],
    meta: { description: null, tags: [], suggestedCategory: null },
  };
  private nextSectionSeq = 1;
  private pendingTranscript: string[] = [];
  private isProcessing = false;
  private client: Anthropic;
  private interviewId: string;
  private topic: string;
  private goal: string;
  private language: InterviewLanguage;
  private humanEditedSections = new Set<string>();
  /**
   * Rolling buffer of recent human canvas edits. Capped at
   * `MAX_RECENT_HUMAN_EDITS` so a long session does not bloat the
   * Anthropic system prompt indefinitely. The writer-worker injects
   * a compact summary into the next `messages.create` call so the
   * model can see what the human just rewrote and avoid undoing it.
   */
  private recentHumanEdits: HumanEditEntry[] = [];
  /** Pending AI-proposed paragraph diffs that conflict with a human
   *  edit (no substring anchor found). Surfaced via the `proposal`
   *  event so the UI can render an accept/reject pill. Keyed by
   *  `${sectionId}::p${index}` to dedupe back-to-back proposals
   *  for the same slot. */
  private pendingProposals = new Map<string, { humanValue: string; aiValue: string }>();

  constructor(opts: WriterWorkerOptions) {
    super();
    // When LLM_PROVIDER=mock the factory builds an in-process mock and
    // ignores apiKey, so the apiKey requirement only applies when a real
    // Anthropic client must be constructed.
    this.client = opts.client ?? createAnthropicClient({ apiKey: opts.apiKey });
    this.interviewId = opts.interviewId;
    this.topic = opts.topic ?? "";
    this.goal = opts.goal ?? "";
    this.language = opts.language ?? "en";
    // Defence in depth — see MAX_DIFF_LISTENERS docstring above.
    this.setMaxListeners(MAX_DIFF_LISTENERS);
  }

  /**
   * Override EventEmitter.emit so every in-process `diff` event is ALSO
   * mirrored into the interview's D1 `interview_events` table as a
   * `writer_diff` event. This bridges the cross-instance gap: in a
   * serverless deploy the SSE route, the realtime tool dispatcher, and
   * this worker can land on different function instances. In-memory
   * EventEmitter subscribers only see emissions on the same instance,
   * so a diff produced by the tool-dispatch instance never reaches the
   * client connected to a different SSE instance — exactly the prod
   * symptom where tool_result narration cues fire (those go via WebRTC,
   * independent of SSE) but the canvas never updates. The D1
   * `interview_events` table is the shared bus the SSE stream polls.
   *
   * The write is fire-and-forget: a persistence failure must never block
   * in-process subscribers and must never crash the worker. Errors are
   * logged at warn so ops can spot a persistent write outage without
   * breaking the user's session.
   */
  override emit(event: string | symbol, ...args: unknown[]): boolean {
    if (event === "diff") {
      const diff = args[0] as WriterDiff | undefined;
      if (diff && typeof diff === "object" && typeof diff.type === "string") {
        // Best-effort cross-instance bridge — only the diff payload is
        // shipped; the client's existing applyDiff handler is keyed by
        // `diff.type` and consumes the WriterDiff shape directly.
        this.persistDiffToEvents(diff);
      }
    }
    return super.emit(event, ...args);
  }

  /**
   * Fire-and-forget write of a WriterDiff into D1 `interview_events` so the
   * SSE route's poll loop picks it up and forwards it as a `writer_diff` SSE
   * frame to whichever client is connected on whichever serverless instance.
   *
   * This is the cross-instance bridge that replaced the Firestore onSnapshot
   * subscription (0B migration). D1 has no realtime push — the SSE route
   * polls `listEventsSince` instead. The bridge semantics are identical:
   * every diff written here is visible to all instances on the next poll
   * cycle (≤ POLL_INTERVAL_MS latency, typically 600–1000 ms).
   *
   * Logs `emit_diff` before the write attempt and
   * `diff_persisted_to_events` (or `diff_persist_failed`) after, so
   * the next debug session can grep the chain end-to-end.
   *
   * blogId is "default" for single-tenant installs; the events-repository
   * enforces D1 tenant isolation via this field.
   */
  private persistDiffToEvents(diff: WriterDiff): void {
    log.info("emit_diff", {
      interviewId: this.interviewId,
      diffType: diff.type,
      willPersist: true,
    });
    void (async () => {
      try {
        await appendEvents(
          "default",
          this.interviewId,
          [{ kind: "writer_diff", ts: new Date().toISOString(), payload: diff }],
          getDb(),
        );
        log.info("diff_persisted_to_events", {
          interviewId: this.interviewId,
          diffType: diff.type,
        });
      } catch (err: unknown) {
        log.warn("diff_persist_failed", {
          interviewId: this.interviewId,
          diffType: diff.type,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }

  /**
   * Subscribe to writer diffs. Returns an explicit unsubscribe function
   * the caller MUST invoke when the consumer goes away (e.g. SSE
   * controller abort). Preferred over `worker.on("diff", …)` because
   * the inverse operation is impossible to express ergonomically with
   * the EventEmitter API — `off("diff", listener)` requires the caller
   * to keep the exact callback reference around, which is easy to lose
   * across closures and abort handlers. This is the single source of
   * the W9.1 listener leak that produced the
   * `MaxListenersExceededWarning: 11 diff listeners` from the W8.4
   * walkthrough: the SSE route's `worker.off("diff", onDiff)` cleanup
   * never ran when the controller aborted before the cleanup hook had
   * been wired in.
   *
   * Internally still backed by EventEmitter so existing tests and
   * tool-registry consumers (which call `worker.on("diff", …)`
   * directly) keep working unchanged.
   */
  subscribe(listener: DiffListener): UnsubscribeFn {
    this.on("diff", listener);
    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      this.off("diff", listener);
    };
  }

  /** Current number of `diff` subscribers — exposed for diagnostics + tests. */
  getDiffListenerCount(): number {
    return this.listenerCount("diff");
  }

  getCanvas(): CanvasState {
    return JSON.parse(JSON.stringify(this.state)); // defensive copy
  }

  /**
   * Replace this worker's in-memory `state` with a previously persisted
   * canvas snapshot. Used by routes that materialise a worker on a cold
   * lambda (no prior local state) so the worker starts in sync with the
   * cross-instance source of truth (`interviews/{id}.canvasSnapshot`
   * written by the events route after every tool batch).
   *
   * Without rehydration each lambda's worker starts empty: a tool batch
   * landing on a fresh instance sees `state.sections = []`, drops
   * `insert_paragraph(section-1, …)` into an implicit "Untitled section",
   * and the resulting `canvasSnapshot` overwrite wipes the legitimate
   * sections that earlier batches built up on other lambdas — the bug
   * the user reported as "title shows but body is empty" on /review.
   *
   * Section-id sequence is preserved by extracting the max numeric
   * suffix from the snapshot's section ids; legacy snapshots with
   * non-`section-N` ids keep the worker's default counter so newly
   * minted ids stay monotonic relative to whatever was already there.
   */
  hydrateFromCanvas(canvas: CanvasState): void {
    this.state = JSON.parse(JSON.stringify(canvas)) as CanvasState;
    let maxSeq = 0;
    for (const section of this.state.sections) {
      const match = /^section-(\d+)$/.exec(section.id);
      if (match) {
        const n = Number(match[1]);
        if (Number.isInteger(n) && n > maxSeq) maxSeq = n;
      }
    }
    this.nextSectionSeq = maxSeq + 1;
  }

  appendTranscript(chunk: string): void {
    if (!chunk?.trim()) return;
    this.pendingTranscript.push(chunk);
    void this.maybeProcess();
  }

  applyCanvasEdit(payload: {
    sectionId: string;
    field: "heading" | "paragraph_text" | "bullet_text";
    index?: number;
    value: string;
  }): void {
    const { sectionId, field, index, value } = payload;
    const target = this.state.sections.find((s) => s.id === sectionId);
    if (!target) return;

    this.humanEditedSections.add(sectionId);

    let previousValue: string | undefined;
    if (field === "heading") {
      previousValue = target.heading ?? "";
      target.heading = value;
    } else if (field === "paragraph_text") {
      if (index !== undefined && index >= 0 && index < target.paragraphs.length) {
        previousValue = target.paragraphs[index];
        target.paragraphs[index] = value;
      }
    } else if (field === "bullet_text") {
      if (index !== undefined && index >= 0 && index < target.bullets.length) {
        previousValue = target.bullets[index];
        target.bullets[index] = value;
      }
    }

    // Buffer the edit so the next prompt build can include it. Cap the
    // buffer so a long session can't bloat the prompt indefinitely.
    this.recentHumanEdits.push({ sectionId, field, index, value, previousValue });
    if (this.recentHumanEdits.length > MAX_RECENT_HUMAN_EDITS) {
      this.recentHumanEdits.splice(0, this.recentHumanEdits.length - MAX_RECENT_HUMAN_EDITS);
    }

    // Clearing the pending proposal (if any) for this exact slot — the
    // human just expressed an opinion either way, so an outstanding
    // "AI proposes …" pill is no longer relevant.
    if (field === "paragraph_text" && index !== undefined) {
      this.pendingProposals.delete(`${sectionId}::p${index}`);
    }
  }

  /**
   * Snapshot the most recent human edits the writer-worker has
   * observed. Exposed for tests and for the SSE route, which can
   * forward the same list to other connected clients on reconnect.
   * Returns a defensive copy so callers can't mutate internal state.
   */
  getRecentHumanEdits(): HumanEditEntry[] {
    return this.recentHumanEdits.map((e) => ({ ...e }));
  }

  /**
   * Drop the human-edit lock for a section. Used by the UI when the
   * user explicitly accepts an AI proposal — the section becomes
   * AI-writable again until the next human edit. Idempotent.
   */
  clearHumanEditLock(sectionId: string): void {
    this.humanEditedSections.delete(sectionId);
  }

  /**
   * Locate the most recent buffered human edit for a given slot.
   * Used by `applyDiffs` so merge resolution has the human's
   * "prior AI text" anchor without having to recompute it from
   * upstream diff history.
   */
  private findLastEditFor(
    sectionId: string,
    field: HumanEditEntry["field"],
    index?: number,
  ): HumanEditEntry | undefined {
    for (let i = this.recentHumanEdits.length - 1; i >= 0; i--) {
      const e = this.recentHumanEdits[i];
      if (e.sectionId !== sectionId || e.field !== field) continue;
      if (field !== "heading" && e.index !== index) continue;
      return e;
    }
    return undefined;
  }

  /**
   * Outstanding AI proposals where the AI wanted to rewrite a
   * paragraph the human had already rewritten from scratch. The UI
   * surfaces these as accept/reject pills.
   */
  getPendingProposals(): Array<{
    sectionId: string;
    index: number;
    humanValue: string;
    aiValue: string;
  }> {
    const out: Array<{
      sectionId: string;
      index: number;
      humanValue: string;
      aiValue: string;
    }> = [];
    for (const [key, value] of this.pendingProposals.entries()) {
      const match = key.match(/^(.+)::p(\d+)$/);
      if (!match) continue;
      out.push({
        sectionId: match[1],
        index: Number(match[2]),
        humanValue: value.humanValue,
        aiValue: value.aiValue,
      });
    }
    return out;
  }

  /**
   * Replace a paragraph's text in place AND emit a `section_updated`
   * diff so the connected client re-renders. Used by the marks tools
   * (apply_bold / apply_italic / apply_highlight / …) to write the
   * wrapped markdown back to canvas state.
   *
   * Paragraph lookup goes through `resolveParagraphIndex`, which tries
   * id-array lookup first (works for `section-1-p0` ids minted by
   * `mintParagraphId`) and falls back to the legacy `-p-<n>` regex
   * (still used by Phase 3 fixtures + tests). Returns true on success,
   * false when the section or paragraph is unknown so the caller can
   * surface a structured `not-found` error.
   *
   * Before W25.H this method mutated state silently — the realtime
   * model would ack `apply_bold` etc. as success while the user's
   * canvas stayed visually unchanged. Emitting `section_updated`
   * (with the new paragraphs array) is what bridges the server
   * mutation back to the client renderer.
   */
  setParagraphText(sectionId: string, paragraphId: string, value: string): boolean {
    const target = this.state.sections.find((s) => s.id === sectionId);
    if (!target) return false;
    const idx = resolveParagraphIndex(target, paragraphId);
    if (idx === null) return false;
    target.paragraphs[idx] = value;
    this.emitParagraphDiff(target);
    return true;
  }

  /**
   * Read a paragraph's current text without mutating state. Returns
   * null when the section or paragraph cannot be found so mark tools
   * can short-circuit before computing a range transform.
   */
  getParagraphText(sectionId: string, paragraphId: string): string | null {
    const target = this.state.sections.find((s) => s.id === sectionId);
    if (!target) return null;
    const idx = resolveParagraphIndex(target, paragraphId);
    if (idx === null) return null;
    return target.paragraphs[idx];
  }

  /**
   * Convert a set of standalone paragraphs into a list block. Removes
   * the paragraphs from `section.paragraphs` and appends a new
   * `CanvasList` to `section.lists`. Emits a `list_added` diff. Returns
   * the new list's id (or null when the section / paragraph ids could
   * not be resolved).
   */
  convertParagraphsToList(
    sectionId: string,
    paragraphIds: string[],
    kind: CanvasList["kind"],
  ): string | null {
    const target = this.state.sections.find((s) => s.id === sectionId);
    if (!target) return null;
    const indices = paragraphIds
      .map(parseParagraphIndex)
      .filter((i): i is number => i !== null && i >= 0 && i < target.paragraphs.length);
    if (indices.length === 0) return null;
    const sorted = [...new Set(indices)].sort((a, b) => a - b);
    const listId = nextListId(target);
    const items: CanvasListItem[] = sorted.map((i, n) => ({
      id: `${listId}-item-${n + 1}`,
      text: target.paragraphs[i],
      level: 0,
      ...(kind === "checklist" ? { checked: false } : {}),
    }));
    const list: CanvasList = { id: listId, kind, items };
    // Remove paragraphs (descending so indices stay valid).
    for (const i of [...sorted].reverse()) {
      target.paragraphs.splice(i, 1);
    }
    target.lists = [...(target.lists ?? []), list];
    this.emit("diff", {
      type: "list_added",
      payload: { sectionId: target.id, list },
    } as WriterDiff);
    return listId;
  }

  /**
   * Insert a new item into an existing list. `position === undefined`
   * appends; otherwise inserts before the given zero-based index
   * (clamped into [0, items.length]). Emits a `list_updated` diff.
   * Returns the new item id, or null when the list cannot be found.
   */
  addListItem(
    listId: string,
    text: string,
    opts: { position?: number; checked?: boolean } = {},
  ): string | null {
    const located = this.findList(listId);
    if (!located) return null;
    const { section, list } = located;
    const insertAt =
      opts.position === undefined
        ? list.items.length
        : Math.max(0, Math.min(opts.position, list.items.length));
    const itemId = `${list.id}-item-${list.items.length + 1}`;
    const item: CanvasListItem = {
      id: itemId,
      text,
      level: 0,
      ...(list.kind === "checklist" ? { checked: opts.checked ?? false } : {}),
    };
    list.items.splice(insertAt, 0, item);
    this.emit("diff", {
      type: "list_updated",
      payload: { sectionId: section.id, listId: list.id, list },
    } as WriterDiff);
    return itemId;
  }

  /**
   * Indent (`"in"`) or outdent (`"out"`) a list item. Mirrors
   * TipTap's `sinkListItem` / `liftListItem`. Returns true on success,
   * false when the list or item is unknown / bounds are exceeded.
   */
  nestListItem(listId: string, itemId: string, direction: "in" | "out"): boolean {
    const located = this.findList(listId);
    if (!located) return false;
    const { section, list } = located;
    const item = list.items.find((i) => i.id === itemId);
    if (!item) return false;
    if (direction === "in") {
      if (item.level >= 6) return false;
      item.level += 1;
    } else {
      if (item.level <= 0) return false;
      item.level -= 1;
    }
    this.emit("diff", {
      type: "list_updated",
      payload: { sectionId: section.id, listId: list.id, list },
    } as WriterDiff);
    return true;
  }

  /**
   * Toggle a checklist item's completion. Returns true on success,
   * false when the list is not a checklist, or the item is unknown.
   */
  completeListItem(listId: string, itemId: string, checked: boolean): boolean {
    const located = this.findList(listId);
    if (!located) return false;
    const { section, list } = located;
    if (list.kind !== "checklist") return false;
    const item = list.items.find((i) => i.id === itemId);
    if (!item) return false;
    item.checked = checked;
    this.emit("diff", {
      type: "list_updated",
      payload: { sectionId: section.id, listId: list.id, list },
    } as WriterDiff);
    return true;
  }

  private findList(
    listId: string,
  ): { section: CanvasSection; list: CanvasList } | null {
    for (const section of this.state.sections) {
      const list = section.lists?.find((l) => l.id === listId);
      if (list) return { section, list };
    }
    return null;
  }

  applyToolCall(name: string, args: unknown): void {
    // Apply coarse tool calls (from realtime) as placeholders.
    // Writer worker will refine these on next pass.
    switch (name) {
      case "add_heading":
        this.upsertSectionByHeading(
          (args as { text: string; level?: number }).text,
        );
        break;
      case "add_bullet": {
        const arg = args as { text: string };
        const current = this.state.sections[this.state.sections.length - 1];
        if (current) {
          current.bullets.push(arg.text);
          // Without this diff the SSE pipeline silently drops the
          // mutation and the body canvas stays on the old snapshot —
          // exactly the W12.7 "tools fire APPLIED but body stays empty"
          // pattern. Match the section_updated payload shape the
          // client's applyDiff already knows how to merge.
          this.emit("diff", {
            type: "section_updated",
            payload: { id: current.id, bullets: [...current.bullets] },
          } as WriterDiff);
        }
        break;
      }
      case "start_paragraph":
        // marker only — writer worker fills paragraphs on next pass
        break;
      case "add_quote": {
        const arg = args as { text: string; attributedTo?: string };
        const current = this.state.sections[this.state.sections.length - 1];
        if (current) {
          current.quotes.push({ text: arg.text, attributedTo: arg.attributedTo ?? "" });
          // Match add_bullet — without this diff the client never sees
          // the verbatim quote land on the canvas.
          this.emit("diff", {
            type: "section_updated",
            payload: { id: current.id, quotes: [...current.quotes] },
          } as WriterDiff);
        }
        break;
      }
      case "finalize_section": {
        const arg = args as { sectionId: string };
        const target = this.state.sections.find((s) => s.id === arg.sectionId);
        if (target) {
          target.finalized = true;
          this.emit("diff", { type: "section_finalized", payload: { sectionId: arg.sectionId } } as WriterDiff);
        }
        break;
      }
      // Phase 2 — title/meta tools
      case "set_title": {
        const arg = args as { title: string };
        this.state.title = arg.title;
        this.emit("diff", { type: "title_updated", payload: { title: arg.title } } as WriterDiff);
        break;
      }
      case "set_subtitle": {
        const arg = args as { subtitle: string };
        this.state.subtitle = arg.subtitle;
        this.emit("diff", { type: "subtitle_updated", payload: { subtitle: arg.subtitle } } as WriterDiff);
        break;
      }
      case "set_slug": {
        const arg = args as { slug: string };
        this.state.slug = arg.slug;
        this.emit("diff", { type: "slug_updated", payload: { slug: arg.slug } } as WriterDiff);
        break;
      }
      case "set_seo_meta": {
        const arg = args as { metaTitle?: string; metaDescription?: string };
        if (arg.metaTitle !== undefined) this.state.metaTitle = arg.metaTitle;
        if (arg.metaDescription !== undefined) this.state.metaDescription = arg.metaDescription;
        this.emit("diff", {
          type: "seo_meta_updated",
          payload: {
            metaTitle: this.state.metaTitle ?? null,
            metaDescription: this.state.metaDescription ?? null,
          },
        } as WriterDiff);
        break;
      }
      // Phase 2 — section tools
      case "insert_section": {
        const arg = args as { afterSectionId?: string; heading: string; level?: 2 | 3 | 4 };
        // Idempotency guard — if the AI re-issues an insert with the
        // same heading (a common hallucination after an SSE reconnect),
        // surface it as an in-place update on the existing section
        // rather than appending a duplicate. See W20.D bug: "Definition
        // and Origin" was being appended three times because the model
        // kept calling insert_section on every replay.
        const existing = this.state.sections.find(
          (s) => normaliseHeading(s.heading) === normaliseHeading(arg.heading),
        );
        if (existing) {
          if (arg.level !== undefined) existing.level = arg.level;
          this.emit("diff", {
            type: "section_updated",
            payload: {
              id: existing.id,
              heading: existing.heading,
              ...(arg.level !== undefined ? { level: arg.level } : {}),
            },
          } as WriterDiff);
          break;
        }
        const id = this.mintSectionId();
        const section: CanvasSection = {
          id,
          heading: arg.heading,
          level: arg.level,
          bullets: [],
          paragraphs: [],
          quotes: [],
          finalized: false,
        };
        if (arg.afterSectionId) {
          const idx = this.state.sections.findIndex((s) => s.id === arg.afterSectionId);
          if (idx === -1) {
            this.state.sections.push(section);
          } else {
            this.state.sections.splice(idx + 1, 0, section);
          }
        } else {
          this.state.sections.push(section);
        }
        this.emit("diff", { type: "section_added", payload: section } as WriterDiff);
        break;
      }
      case "delete_section": {
        const arg = args as { sectionId: string };
        const idx = this.state.sections.findIndex((s) => s.id === arg.sectionId);
        if (idx === -1) return;
        this.state.sections.splice(idx, 1);
        this.humanEditedSections.delete(arg.sectionId);
        this.emit("diff", { type: "section_removed", payload: { sectionId: arg.sectionId } } as WriterDiff);
        break;
      }
      case "move_section": {
        const arg = args as { sectionId: string; toIndex: number };
        const idx = this.state.sections.findIndex((s) => s.id === arg.sectionId);
        if (idx === -1) return;
        const [section] = this.state.sections.splice(idx, 1);
        // Clamp toIndex into the post-splice range.
        const clamped = Math.max(0, Math.min(arg.toIndex, this.state.sections.length));
        this.state.sections.splice(clamped, 0, section);
        this.emit("diff", {
          type: "sections_reordered",
          payload: { sectionIds: this.state.sections.map((s) => s.id) },
        } as WriterDiff);
        break;
      }
      case "merge_sections": {
        const arg = args as { fromSectionId: string; intoSectionId: string };
        const fromIdx = this.state.sections.findIndex((s) => s.id === arg.fromSectionId);
        const intoIdx = this.state.sections.findIndex((s) => s.id === arg.intoSectionId);
        if (fromIdx === -1 || intoIdx === -1 || fromIdx === intoIdx) return;
        const from = this.state.sections[fromIdx];
        const into = this.state.sections[intoIdx];
        into.bullets = [...into.bullets, ...from.bullets];
        into.paragraphs = [...into.paragraphs, ...from.paragraphs];
        into.quotes = [...into.quotes, ...from.quotes];
        this.state.sections.splice(fromIdx, 1);
        this.humanEditedSections.delete(from.id);
        this.emit("diff", {
          type: "section_merged",
          payload: { fromSectionId: from.id, intoSectionId: into.id },
        } as WriterDiff);
        this.emit("diff", { type: "section_updated", payload: { ...into } } as WriterDiff);
        break;
      }
      case "rename_section": {
        const arg = args as { sectionId: string; heading: string };
        const target = this.state.sections.find((s) => s.id === arg.sectionId);
        if (!target) return;
        target.heading = arg.heading;
        this.emit("diff", {
          type: "section_updated",
          payload: { id: target.id, heading: target.heading },
        } as WriterDiff);
        break;
      }
      case "set_heading_level": {
        const arg = args as { sectionId: string; level: 2 | 3 | 4 };
        const target = this.state.sections.find((s) => s.id === arg.sectionId);
        if (!target) return;
        target.level = arg.level;
        this.emit("diff", {
          type: "section_updated",
          payload: { id: target.id, level: target.level },
        } as WriterDiff);
        break;
      }
      default:
        log.warn("Unknown tool call", { name, interviewId: this.interviewId });
    }
  }

  /**
   * Direct canvas state access for the tool registry. Tools that mutate
   * paragraphs need to validate addressing (paragraph id lookup, offset
   * bounds, adjacency) before applying — surfacing structured errors
   * back to the realtime model rather than silently no-op'ing the way
   * `applyToolCall` does. They mutate the live `state` via the helpers
   * below; we centralise diff emission so finalized-section + human-edit
   * bookkeeping stays consistent.
   */
  getMutableSection(sectionId: string): CanvasSection | null {
    return this.state.sections.find((s) => s.id === sectionId) ?? null;
  }

  /**
   * Emit a synthetic `section_updated` diff for paragraph mutations.
   *
   * Carries the section's `paragraphIds` alongside the text so the
   * client can keep its parallel id array in lockstep — without this,
   * a subsequent `upsert_paragraph` refinement diff (which looks the
   * paragraph up by id) would treat the realtime-inserted paragraph
   * as a fresh insertion and append a duplicate.
   *
   * Logs `paragraph_diff_emitted` so the W23.D end-to-end trace can
   * pair the server emit with the client `applied_writer_diff` log.
   */
  emitParagraphDiff(section: CanvasSection): void {
    const paragraphs = [...section.paragraphs];
    const paragraphIds = section.paragraphIds ? [...section.paragraphIds] : undefined;
    log.info("paragraph_diff_emitted", {
      interviewId: this.interviewId,
      sectionId: section.id,
      paragraphCount: paragraphs.length,
      lastParagraphLength: paragraphs.length > 0 ? paragraphs[paragraphs.length - 1].length : 0,
      hasParagraphIds: paragraphIds !== undefined,
    });
    this.emit("diff", {
      type: "section_updated",
      payload: paragraphIds
        ? { id: section.id, paragraphs, paragraphIds }
        : { id: section.id, paragraphs },
    } as WriterDiff);
  }

  /**
   * Insert a paragraph into a section.
   *
   * Returns `{ ok: true, paragraphId }` on success. When the section
   * lookup misses — which happens in production when the realtime
   * model dispatches `insert_section` and `insert_paragraph` in
   * rapid succession across separate POST batches that hit different
   * serverless instances (so the second instance's worker hasn't
   * seen the freshly-minted section) — we DO NOT drop the paragraph
   * content. Instead we log the miss with the full list of known
   * section ids for debuggability, mint an implicit "Untitled
   * section" to host the orphaned paragraph, and surface the new
   * `implicitSectionId` to the caller so the model can address
   * follow-up edits against the recovered section rather than
   * keep re-issuing calls against the stale id.
   *
   * `afterParagraphId` misses still return `{ ok: false }` — that's
   * an addressing bug inside an existing section the model can fix
   * by re-reading state, not a cross-instance race we should paper
   * over.
   */
  insertParagraph(opts: {
    sectionId: string;
    afterParagraphId?: string;
    text: string;
  }):
    | { ok: true; paragraphId: string; implicitSectionId?: string }
    | { ok: false; reason: string } {
    let section = this.getMutableSection(opts.sectionId);
    let implicitSectionId: string | undefined;
    if (!section) {
      log.warn("paragraph_section_not_found", {
        interviewId: this.interviewId,
        sectionId: opts.sectionId,
        knownSectionIds: this.state.sections.map((s) => s.id),
        textLength: opts.text.length,
      });
      // Refuse to honour `afterParagraphId` on the fallback path —
      // there are no paragraphs in a freshly minted section, so the
      // hint is meaningless. Surface that as a structured failure so
      // the model can retry without it rather than silently misplace
      // the paragraph at index 0.
      if (opts.afterParagraphId) {
        return {
          ok: false,
          reason: `Section "${opts.sectionId}" not found; cannot honour afterParagraphId "${opts.afterParagraphId}" on an implicit section.`,
        };
      }
      const id = this.mintSectionId();
      const created: CanvasSection = {
        id,
        heading: "Untitled section",
        bullets: [],
        paragraphs: [],
        quotes: [],
        finalized: false,
      };
      this.state.sections.push(created);
      this.emit("diff", { type: "section_added", payload: created } as WriterDiff);
      section = created;
      implicitSectionId = id;
    }
    ensureParagraphMetadata(section);
    let insertAt = section.paragraphs.length;
    if (opts.afterParagraphId) {
      const ids = section.paragraphIds!;
      const idx = ids.indexOf(opts.afterParagraphId);
      if (idx === -1) {
        return {
          ok: false,
          reason: `Paragraph "${opts.afterParagraphId}" not found in section "${opts.sectionId}".`,
        };
      }
      insertAt = idx + 1;
    }
    const id = mintParagraphId(section);
    section.paragraphs.splice(insertAt, 0, opts.text);
    section.paragraphIds!.splice(insertAt, 0, id);
    section.paragraphAlignments!.splice(insertAt, 0, undefined);
    this.emitParagraphDiff(section);
    return implicitSectionId
      ? { ok: true, paragraphId: id, implicitSectionId }
      : { ok: true, paragraphId: id };
  }

  deleteParagraph(opts: { sectionId: string; paragraphId: string }):
    | { ok: true }
    | { ok: false; reason: string } {
    const section = this.getMutableSection(opts.sectionId);
    if (!section) {
      return { ok: false, reason: `Section "${opts.sectionId}" not found.` };
    }
    ensureParagraphMetadata(section);
    const idx = section.paragraphIds!.indexOf(opts.paragraphId);
    if (idx === -1) {
      return {
        ok: false,
        reason: `Paragraph "${opts.paragraphId}" not found in section "${opts.sectionId}".`,
      };
    }
    section.paragraphs.splice(idx, 1);
    section.paragraphIds!.splice(idx, 1);
    section.paragraphAlignments!.splice(idx, 1);
    this.emitParagraphDiff(section);
    return { ok: true };
  }

  /**
   * Cross-section paragraph move. `toIndex` is the destination slot in
   * `toSectionId.paragraphs` *after* removal from the source section
   * (so identical to a typical splice insertion point). Negative or
   * out-of-range values clamp to the array bounds.
   */
  moveParagraph(opts: {
    paragraphId: string;
    fromSectionId: string;
    toSectionId: string;
    toIndex: number;
  }): { ok: true } | { ok: false; reason: string } {
    const fromSection = this.getMutableSection(opts.fromSectionId);
    if (!fromSection) {
      return { ok: false, reason: `Source section "${opts.fromSectionId}" not found.` };
    }
    const toSection = this.getMutableSection(opts.toSectionId);
    if (!toSection) {
      return { ok: false, reason: `Destination section "${opts.toSectionId}" not found.` };
    }
    ensureParagraphMetadata(fromSection);
    ensureParagraphMetadata(toSection);
    const srcIdx = fromSection.paragraphIds!.indexOf(opts.paragraphId);
    if (srcIdx === -1) {
      return {
        ok: false,
        reason: `Paragraph "${opts.paragraphId}" not found in section "${opts.fromSectionId}".`,
      };
    }
    const [text] = fromSection.paragraphs.splice(srcIdx, 1);
    const [id] = fromSection.paragraphIds!.splice(srcIdx, 1);
    const [align] = fromSection.paragraphAlignments!.splice(srcIdx, 1);
    const dstLen = toSection.paragraphs.length;
    const dstIdx = Math.max(0, Math.min(opts.toIndex, dstLen));
    toSection.paragraphs.splice(dstIdx, 0, text);
    toSection.paragraphIds!.splice(dstIdx, 0, id);
    toSection.paragraphAlignments!.splice(dstIdx, 0, align);
    this.emitParagraphDiff(fromSection);
    if (fromSection.id !== toSection.id) this.emitParagraphDiff(toSection);
    return { ok: true };
  }

  replaceParagraphText(opts: {
    sectionId: string;
    paragraphId: string;
    oldText: string;
    newText: string;
  }): { ok: true } | { ok: false; reason: "section_not_found" | "paragraph_not_found" | "text_not_found"; message: string } {
    const section = this.getMutableSection(opts.sectionId);
    if (!section) {
      return {
        ok: false,
        reason: "section_not_found",
        message: `Section "${opts.sectionId}" not found.`,
      };
    }
    ensureParagraphMetadata(section);
    const idx = section.paragraphIds!.indexOf(opts.paragraphId);
    if (idx === -1) {
      return {
        ok: false,
        reason: "paragraph_not_found",
        message: `Paragraph "${opts.paragraphId}" not found in section "${opts.sectionId}".`,
      };
    }
    const current = section.paragraphs[idx];
    if (!current.includes(opts.oldText)) {
      return {
        ok: false,
        reason: "text_not_found",
        message: `Old text not found in paragraph "${opts.paragraphId}".`,
      };
    }
    section.paragraphs[idx] = current.replace(opts.oldText, opts.newText);
    this.emitParagraphDiff(section);
    return { ok: true };
  }

  splitParagraph(opts: { paragraphId: string; atOffset: number }):
    | { ok: true; newParagraphId: string }
    | { ok: false; reason: string } {
    const located = findParagraph(this.state, opts.paragraphId);
    if (!located) {
      return { ok: false, reason: `Paragraph "${opts.paragraphId}" not found.` };
    }
    const { section, index } = located;
    const text = section.paragraphs[index];
    if (opts.atOffset <= 0 || opts.atOffset >= text.length) {
      return {
        ok: false,
        reason: `Offset ${opts.atOffset} is outside paragraph bounds (1..${text.length - 1}).`,
      };
    }
    const head = text.slice(0, opts.atOffset);
    const tail = text.slice(opts.atOffset);
    const newId = mintParagraphId(section);
    section.paragraphs[index] = head;
    section.paragraphs.splice(index + 1, 0, tail);
    section.paragraphIds!.splice(index + 1, 0, newId);
    section.paragraphAlignments!.splice(
      index + 1,
      0,
      section.paragraphAlignments![index],
    );
    this.emitParagraphDiff(section);
    return { ok: true, newParagraphId: newId };
  }

  /**
   * Promote a paragraph into a new section heading at the requested
   * level (2/3/4 — H1 is reserved for the article title via
   * `set_title`). The source section is split at the paragraph:
   * everything BEFORE the paragraph stays in the source section,
   * the paragraph's text becomes the new section's heading at the
   * given level, and everything AFTER the paragraph moves into the
   * new section as its paragraphs.
   *
   * This is the canvas mutation that backs `apply_heading_level` —
   * the verbal user request "make this an h2" maps directly onto a
   * paragraph-to-heading promotion.
   *
   * Emits `section_updated` for the source section (now shorter) and
   * `section_added` for the new section so the client can reorder
   * sections without a full canvas refetch.
   */
  promoteParagraphToHeading(opts: {
    paragraphId: string;
    level: 2 | 3 | 4;
  }):
    | { ok: true; newSectionId: string }
    | { ok: false; reason: string } {
    const located = findParagraph(this.state, opts.paragraphId);
    if (!located) {
      return { ok: false, reason: `Paragraph "${opts.paragraphId}" not found.` };
    }
    const { section: source, index } = located;
    ensureParagraphMetadata(source);
    const heading = source.paragraphs[index].trim();
    if (!heading) {
      return {
        ok: false,
        reason: `Paragraph "${opts.paragraphId}" is empty; nothing to promote.`,
      };
    }
    const tailTexts = source.paragraphs.slice(index + 1);
    const tailIds = source.paragraphIds!.slice(index + 1);
    const tailAligns = source.paragraphAlignments!.slice(index + 1);
    source.paragraphs.length = index;
    source.paragraphIds!.length = index;
    source.paragraphAlignments!.length = index;
    const sourceIdx = this.state.sections.findIndex((s) => s.id === source.id);
    const newId = this.mintSectionId();
    const created: CanvasSection = {
      id: newId,
      heading,
      level: opts.level,
      bullets: [],
      paragraphs: tailTexts,
      paragraphIds: tailIds,
      paragraphAlignments: tailAligns,
      quotes: [],
      finalized: false,
    };
    this.state.sections.splice(sourceIdx + 1, 0, created);
    this.emitParagraphDiff(source);
    this.emit("diff", { type: "section_added", payload: created } as WriterDiff);
    return { ok: true, newSectionId: newId };
  }

  /**
   * Concatenate `secondId` onto `firstId` with a `" "` separator.
   * `secondId` must be the immediate successor of `firstId` in the
   * same section — non-adjacent or cross-section pairs are rejected
   * so the tool's contract stays predictable.
   */
  joinParagraphs(opts: { firstId: string; secondId: string }):
    | { ok: true }
    | { ok: false; reason: string } {
    const first = findParagraph(this.state, opts.firstId);
    if (!first) {
      return { ok: false, reason: `Paragraph "${opts.firstId}" not found.` };
    }
    const second = findParagraph(this.state, opts.secondId);
    if (!second) {
      return { ok: false, reason: `Paragraph "${opts.secondId}" not found.` };
    }
    if (first.section.id !== second.section.id) {
      return {
        ok: false,
        reason: `Paragraphs are in different sections — join only works within a single section.`,
      };
    }
    if (second.index !== first.index + 1) {
      return {
        ok: false,
        reason: `Paragraphs are not adjacent (firstId index=${first.index}, secondId index=${second.index}).`,
      };
    }
    const section = first.section;
    section.paragraphs[first.index] = `${section.paragraphs[first.index]} ${section.paragraphs[second.index]}`;
    section.paragraphs.splice(second.index, 1);
    section.paragraphIds!.splice(second.index, 1);
    section.paragraphAlignments!.splice(second.index, 1);
    this.emitParagraphDiff(section);
    return { ok: true };
  }

  setParagraphAlignment(opts: {
    paragraphId: string;
    alignment: ParagraphAlignment;
  }): { ok: true } | { ok: false; reason: string } {
    const located = findParagraph(this.state, opts.paragraphId);
    if (!located) {
      return { ok: false, reason: `Paragraph "${opts.paragraphId}" not found.` };
    }
    const { section, index } = located;
    ensureParagraphMetadata(section);
    section.paragraphAlignments![index] = opts.alignment;
    this.emit("diff", {
      type: "section_updated",
      payload: {
        id: section.id,
        paragraphAlignments: [...section.paragraphAlignments!],
      },
    } as WriterDiff);
    return { ok: true };
  }

  /**
   * Append a section, OR — when a section with the same heading already
   * exists — surface the call as an in-place update on that section.
   *
   * The realtime AI occasionally re-issues `add_heading` for content it
   * has already laid down (W20.D: "Definition and Origin" was being
   * appended three times because the model kept calling `add_heading`
   * after an SSE reconnect). Treating duplicates as upserts keeps the
   * canvas idempotent on the semantic key the model is actually
   * addressing — the heading text — without inventing a contract where
   * the AI passes an explicit `sectionId` it never minted.
   *
   * Emits `section_added` on the create path and `section_updated` on
   * the no-op path so SSE clients keep their canvas snapshot consistent
   * with the worker's view either way.
   */
  private upsertSectionByHeading(heading: string): void {
    const existing = this.state.sections.find(
      (s) => normaliseHeading(s.heading) === normaliseHeading(heading),
    );
    if (existing) {
      // No-op update — heading is already the requested value. We still
      // emit `section_updated` so any client that missed an earlier
      // `section_added` (SSE reconnect, lossy bus) reconciles to the
      // same canvas the worker is holding.
      this.emit("diff", {
        type: "section_updated",
        payload: { id: existing.id, heading: existing.heading },
      } as WriterDiff);
      return;
    }
    const id = this.mintSectionId();
    this.state.sections.push({
      id,
      heading,
      bullets: [],
      paragraphs: [],
      quotes: [],
      finalized: false,
    });
    this.emit("diff", {
      type: "section_added",
      payload: { id, heading, bullets: [], paragraphs: [], quotes: [], finalized: false },
    } as WriterDiff);
  }

  private mintSectionId(): string {
    // Monotonic counter — never reuses ids after a delete/merge so the
    // diff stream and undo history stay unambiguous.
    const id = `section-${this.nextSectionSeq}`;
    this.nextSectionSeq += 1;
    return id;
  }

  /**
   * Append a rich block (blockquote, code block, callout, divider, table,
   * or embed) to a section. Used by the Phase 4 `insert_*` and `embed_*`
   * tools. Returns the generated block id (or `null` if the target section
   * is unknown) so handlers can echo the id back to the model.
   *
   * The block id is `<sectionId>-block-<n>`, scoped to the section, so
   * subsequent edit/delete tools can target it without colliding with
   * block ids in other sections.
   *
   * The block argument is `CanvasBlockInput` rather than
   * `Omit<CanvasBlock, "id">` because `Omit` distributes through a
   * discriminated union in a way that erases the discriminator from
   * each branch — making structural checks at the call site reject
   * legitimate inputs.
   */
  insertBlock(sectionId: string, block: CanvasBlockInput): string | null {
    const target = this.state.sections.find((s) => s.id === sectionId);
    if (!target) return null;
    if (!target.blocks) target.blocks = [];
    const id = `${sectionId}-block-${target.blocks.length + 1}`;
    const stored = { ...block, id } as CanvasBlock;
    target.blocks.push(stored);
    this.emit("diff", {
      type: "section_block_added",
      payload: { sectionId, block: stored },
    } as WriterDiff);
    return id;
  }

  /**
   * Phase 5 — Image management. Set or replace the canvas featured
   * image. Mints a stable `image-<n>` id so SSE consumers can
   * round-trip via `set_alt_text`. The previous featured image is
   * dropped from state but the asset remains in Firebase Storage so
   * a future "undo" can restore it.
   */
  setFeaturedImage(opts: {
    url: string;
    alt: string;
    prompt?: string;
    reason?: string;
    source?: "ai" | "unsplash";
    attribution?: CanvasImageAttribution;
  }): CanvasImage {
    const image: CanvasImage = {
      id: this.mintImageId(),
      url: opts.url,
      alt: opts.alt,
      prompt: opts.prompt,
      source: opts.source,
      attribution: opts.attribution,
      placement: { kind: "featured" },
    };
    this.state.featuredImage = image;
    this.emit("diff", {
      type: "featured_image_updated",
      payload: { image, reason: opts.reason },
    } as WriterDiff);
    return image;
  }

  /**
   * Append an inline image to a section. Returns the image or `null`
   * if the section id is unknown — the caller surfaces a `not-found`
   * tool result so the model can re-orient.
   */
  insertInlineImage(opts: {
    sectionId: string;
    url: string;
    alt: string;
    prompt?: string;
    afterParagraphIndex?: number;
    source?: "ai" | "unsplash";
    attribution?: CanvasImageAttribution;
  }): CanvasImage | null {
    const target = this.state.sections.find((s) => s.id === opts.sectionId);
    if (!target) return null;
    if (!target.inlineImages) target.inlineImages = [];
    const image: CanvasImage = {
      id: this.mintImageId(),
      url: opts.url,
      alt: opts.alt,
      prompt: opts.prompt,
      source: opts.source,
      attribution: opts.attribution,
      placement: {
        kind: "inline",
        sectionId: opts.sectionId,
        afterParagraphIndex: opts.afterParagraphIndex,
      },
    };
    target.inlineImages.push(image);
    this.emit("diff", {
      type: "inline_image_added",
      payload: { sectionId: opts.sectionId, image },
    } as WriterDiff);
    return image;
  }

  /**
   * Replace the URL/alt/prompt of an existing image (featured or
   * inline). Used by `regenerate_featured_image` + `replace_inline_image`
   * so callers can keep the same image id while swapping the asset.
   */
  replaceImage(opts: {
    imageId: string;
    url: string;
    alt?: string;
    prompt?: string;
    source?: "ai" | "unsplash";
    attribution?: CanvasImageAttribution;
  }): CanvasImage | null {
    const image = this.findImage(opts.imageId);
    if (!image) return null;
    image.url = opts.url;
    if (opts.alt !== undefined) image.alt = opts.alt;
    if (opts.prompt !== undefined) image.prompt = opts.prompt;
    if (opts.source !== undefined) image.source = opts.source;
    if (opts.attribution !== undefined) image.attribution = opts.attribution;
    if (image.placement.kind === "featured") {
      this.emit("diff", {
        type: "featured_image_updated",
        payload: { image },
      } as WriterDiff);
    } else {
      this.emit("diff", {
        type: "inline_image_added",
        payload: { sectionId: image.placement.sectionId, image },
      } as WriterDiff);
    }
    return image;
  }

  /** Set the alt text on any existing image (featured or inline). */
  setImageAlt(imageId: string, alt: string): CanvasImage | null {
    const image = this.findImage(imageId);
    if (!image) return null;
    image.alt = alt;
    this.emit("diff", {
      type: "image_alt_updated",
      payload: { imageId, alt },
    } as WriterDiff);
    return image;
  }

  /** Surface an SEO score result to the canvas. */
  setSeoScore(score: CanvasSeoScore): void {
    this.state.seoScore = score;
    this.emit("diff", {
      type: "seo_score_updated",
      payload: { score },
    } as WriterDiff);
  }

  /** Surface an internal-link suggestion list. */
  setInternalLinkSuggestions(
    suggestions: CanvasInternalLinkSuggestion[],
  ): void {
    this.state.internalLinkSuggestions = suggestions;
    this.emit("diff", {
      type: "internal_link_suggestions_updated",
      payload: { suggestions },
    } as WriterDiff);
  }

  /** Apply an internal link to a paragraph range. */
  addInternalLink(opts: {
    sectionId: string;
    paragraphId: string;
    range: { start: number; end: number };
    targetSlug: string;
  }): boolean {
    const target = this.state.sections.find((s) => s.id === opts.sectionId);
    if (!target) return false;
    if (!target.internalLinks) target.internalLinks = [];
    target.internalLinks.push({
      paragraphId: opts.paragraphId,
      range: opts.range,
      targetSlug: opts.targetSlug,
    });
    this.emit("diff", {
      type: "internal_link_added",
      payload: {
        sectionId: opts.sectionId,
        paragraphId: opts.paragraphId,
        range: opts.range,
        targetSlug: opts.targetSlug,
      },
    } as WriterDiff);
    return true;
  }

  setKeywords(keywords: string[]): void {
    this.state.keywords = keywords;
    this.emit("diff", {
      type: "keywords_updated",
      payload: { keywords },
    } as WriterDiff);
  }

  setCategories(categories: string[]): void {
    this.state.categories = categories;
    this.emit("diff", {
      type: "categories_updated",
      payload: { categories },
    } as WriterDiff);
  }

  setTags(tags: string[]): void {
    this.state.tags = tags;
    this.emit("diff", {
      type: "tags_updated",
      payload: { tags },
    } as WriterDiff);
  }

  /** Find an image by id across featured + every section's inline list. */
  private findImage(imageId: string): CanvasImage | null {
    if (this.state.featuredImage?.id === imageId) {
      return this.state.featuredImage;
    }
    for (const section of this.state.sections) {
      const found = section.inlineImages?.find((img) => img.id === imageId);
      if (found) return found;
    }
    return null;
  }

  /** Monotonic image id across the whole canvas. */
  private imageIdCounter = 0;
  private mintImageId(): string {
    this.imageIdCounter += 1;
    return `image-${this.imageIdCounter}`;
  }

  /**
   * Debounced background refiner. Calls Anthropic at most ~once per 3 seconds.
   * Sends current canvas + pending transcript; applies returned diffs.
   */
  private async maybeProcess(): Promise<void> {
    if (this.isProcessing) return;
    if (this.pendingTranscript.length === 0) return;
    this.isProcessing = true;
    const startedAt = Date.now();
    log.info("Writer job state transition", {
      from: "idle",
      to: "processing",
      interviewId: this.interviewId,
      pendingChunks: this.pendingTranscript.length,
      timestamp: new Date().toISOString(),
    });
    try {
      const transcript = this.pendingTranscript.join(" ");
      this.pendingTranscript = [];

      // 30s hard cap. The writer is a background refiner — if Anthropic
      // doesn't respond promptly the interview should keep accepting new
      // transcript rather than blocking the whole event loop on a stuck
      // call.
      const WRITER_TIMEOUT_MS = 30_000;
      const humanEditsBlock = formatHumanEditsForPrompt(this.recentHumanEdits);
      const contextText = humanEditsBlock
        ? `Topic: ${this.topic}\nGoal: ${this.goal}\nLanguage: ${LANGUAGE_NAMES[this.language]}\nCurrent canvas: ${JSON.stringify(this.state)}\n\n${humanEditsBlock}`
        : `Topic: ${this.topic}\nGoal: ${this.goal}\nLanguage: ${LANGUAGE_NAMES[this.language]}\nCurrent canvas: ${JSON.stringify(this.state)}`;
      const requestPromise = withStructuredLog(
        log,
        "anthropic.messages.create",
        {
          provider: "anthropic",
          interviewId: this.interviewId,
          model: "claude-sonnet-4-6",
          maxTokens: 2000,
          transcriptChars: transcript.length,
        },
        () =>
          this.client.messages.create({
            model: "claude-sonnet-4-6",
            max_tokens: 2000,
            system: [
              { type: "text", text: WRITER_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
              { type: "text", text: contextText, cache_control: { type: "ephemeral" } },
            ],
            messages: [
              { role: "user", content: `New transcript chunk: ${transcript}\n\nEmit WriterDiff array. Empty array if no changes.` },
            ],
          }),
      );
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error("writer-worker request timed out")),
          WRITER_TIMEOUT_MS,
        );
      });
      let res;
      try {
        res = await Promise.race([requestPromise, timeoutPromise]);
      } finally {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      }

      // First chunk arrival timing helps diagnose slow OpenAI/Anthropic
      // responses without exposing the actual content (which may contain
      // PII from the transcript).
      const firstChunkMs = Date.now() - startedAt;
      const firstChunkType = res.content[0]?.type ?? "none";
      log.info("Writer received first response chunk", {
        interviewId: this.interviewId,
        firstChunkMs,
        firstChunkType,
        timestamp: new Date().toISOString(),
      });

      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const diffs = this.parseDiffs(text);
      this.applyDiffs(diffs);

      log.info("Writer job state transition", {
        from: "processing",
        to: "completed",
        interviewId: this.interviewId,
        durationMs: Date.now() - startedAt,
        responseSize: text.length,
        diffCount: diffs.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      log.error("Writer worker process error", { interviewId: this.interviewId, error: err instanceof Error ? err.message : String(err) });
      log.info("Writer job state transition", {
        from: "processing",
        to: "failed",
        interviewId: this.interviewId,
        durationMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      });
      this.emit("error", err);
    } finally {
      this.isProcessing = false;
      // If new transcript chunks arrived during processing, schedule another pass
      if (this.pendingTranscript.length > 0) {
        setTimeout(() => void this.maybeProcess(), 100);
      }
    }
  }

  private parseDiffs(text: string): WriterDiff[] {
    try {
      // Tolerant parse: model may wrap in ```json ... ``` or include prose
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const parsed = JSON.parse(match[0]) as WriterDiff[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: unknown) {
      log.warn("Failed to parse writer diffs", { error: err instanceof Error ? err.message : String(err), text: text.slice(0, 200) });
      return [];
    }
  }

  private applyDiffs(diffs: WriterDiff[]): void {
    for (const diff of diffs) {
      switch (diff.type) {
        case "title_updated": {
          const p = diff.payload as { title?: string };
          if (p.title) {
            this.state.title = p.title;
            this.emit("diff", diff);
          }
          break;
        }
        case "section_updated": {
          const p = diff.payload as Partial<CanvasSection> & { id?: string };
          if (!p.id) continue;
          const target = this.state.sections.find((s) => s.id === p.id);
          if (!target) continue;
          const isHumanEdited = this.humanEditedSections.has(p.id);
          if (!isHumanEdited) {
            // Fast path: section has not been touched by the human, so apply
            // the AI's update verbatim and emit the diff for downstream
            // subscribers (SSE → canvas state).
            if (p.heading !== undefined) target.heading = p.heading;
            if (p.bullets !== undefined) target.bullets = p.bullets;
            if (p.paragraphs !== undefined) target.paragraphs = p.paragraphs;
            this.emit("diff", diff);
            break;
          }

          // Human-edited path: try to splice the AI's new value into the
          // human's text using the prior AI value as an anchor. If that
          // fails, stash the AI's update as a pending proposal so the UI
          // can render an accept/reject pill.
          const sectionId = p.id;
          const mergedSection: Partial<CanvasSection> & { id: string } = { id: sectionId };
          let didMerge = false;
          if (p.heading !== undefined && p.heading !== null) {
            const newHeading: string = p.heading;
            const headingEdit = this.findLastEditFor(sectionId, "heading");
            const outcome = mergeParagraphEdit(
              target.heading ?? "",
              headingEdit?.previousValue ?? "",
              newHeading,
            );
            if (outcome.kind === "accept" || outcome.kind === "splice") {
              target.heading = outcome.value;
              mergedSection.heading = outcome.value;
              didMerge = true;
            }
          }
          if (p.paragraphs !== undefined) {
            const incomingParagraphs = p.paragraphs;
            const mergedParagraphs = target.paragraphs.map((current, idx) => {
              const incoming = incomingParagraphs[idx];
              if (incoming === undefined) return current;
              const edit = this.findLastEditFor(sectionId, "paragraph_text", idx);
              const aiOld = edit?.previousValue ?? current;
              const outcome = mergeParagraphEdit(current, aiOld, incoming);
              if (outcome.kind === "accept" || outcome.kind === "splice") {
                didMerge = true;
                return outcome.value;
              }
              // proposed — keep human value, stash the proposal
              this.pendingProposals.set(`${sectionId}::p${idx}`, {
                humanValue: outcome.humanValue,
                aiValue: outcome.aiValue,
              });
              this.emit("proposal", {
                sectionId,
                index: idx,
                humanValue: outcome.humanValue,
                aiValue: outcome.aiValue,
              });
              return current;
            });
            target.paragraphs = mergedParagraphs;
            mergedSection.paragraphs = mergedParagraphs;
          }
          // Bullets aren't substring-spliced — they're terse lines, so the
          // safest default is "human wins" when the section is locked.
          if (didMerge) {
            this.emit("diff", { type: "section_updated", payload: mergedSection });
          }
          break;
        }
        case "section_finalized": {
          const p = diff.payload as { sectionId?: string };
          if (p?.sectionId && this.humanEditedSections.has(p.sectionId)) {
            continue;
          }
          this.emit("diff", diff);
          break;
        }
        case "meta_updated": {
          const p = diff.payload as { meta?: CanvasState["meta"] };
          if (p.meta) {
            this.state.meta = { ...this.state.meta, ...p.meta };
            this.emit("diff", diff);
          }
          break;
        }
        default:
          // The LLM occasionally hallucinates diff kinds that don't exist
          // in the WriterDiff union (e.g. `upsert_paragraph` — see W22.A).
          // Forwarding them unfiltered means the client logs
          // "Dropping unknown SSE diff kind" and the user's canvas stays
          // stale. Allow-list the kinds that have a registered client
          // handler so any new server-side type forces an explicit
          // round-trip through the client switch before going live.
          if (KNOWN_DIFF_KINDS.has(diff.type as string)) {
            this.emit("diff", diff);
          } else {
            log.warn("writer_worker_dropped_unknown_diff_kind", {
              interviewId: this.interviewId,
              diffType: diff.type,
            });
          }
      }
    }
  }
}

/**
 * Allow-list of diff kinds the client's `applyDiff` switch handles.
 * Keep this in sync with `apps/web/src/hooks/use-interview-session.ts`
 * — any new entry here MUST have a matching `case` in the client switch
 * (and ideally a unit test) before it ships.
 */
const KNOWN_DIFF_KINDS: ReadonlySet<string> = new Set([
  "section_added",
  "section_updated",
  "section_removed",
  "sections_reordered",
  "section_merged",
  "section_block_added",
  "section_finalized",
  "title_updated",
  "subtitle_updated",
  "slug_updated",
  "seo_meta_updated",
  "meta_updated",
  "list_added",
  "list_updated",
  "featured_image_updated",
  "inline_image_added",
  "image_alt_updated",
  "seo_score_updated",
  "internal_link_suggestions_updated",
  "internal_link_added",
  "keywords_updated",
  "categories_updated",
  "tags_updated",
  "human_edit_applied",
  "upsert_paragraph",
]);

/**
 * Paragraph identifiers in Phase 3 are addressed by their string id
 * `<sectionId>-p-<index>` (e.g. `section-1-p-0`). Helper extracts the
 * numeric index from that shape so mark tools can locate the
 * paragraph in `section.paragraphs[]`. Returns null when the id does
 * not match the expected shape.
 */
function parseParagraphIndex(paragraphId: string): number | null {
  const m = paragraphId.match(/-p-(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/**
 * Resolve a paragraph id to its `paragraphs[]` index inside a known
 * section. Tries the canonical id-array lookup first (the format
 * `mintParagraphId` produces for paragraphs inserted via the Phase 2
 * `insert_paragraph` tool: `section-1-p0`, `section-1-p1`, …), then
 * falls back to the legacy `-p-<n>` regex used by the Phase 3 test
 * fixtures and any pre-existing canvases that addressed paragraphs
 * by positional index.
 *
 * Returning a valid index for either format is what lets the mark
 * tools work against both fixture-seeded canvases (where the test
 * fixture mints `section-1-p-0`) and production canvases (where
 * `mintParagraphId` produces `section-1-p0`) without forcing either
 * to change.
 */
function resolveParagraphIndex(
  section: CanvasSection,
  paragraphId: string,
): number | null {
  if (section.paragraphIds) {
    const idx = section.paragraphIds.indexOf(paragraphId);
    if (idx !== -1) return idx;
  }
  const parsed = parseParagraphIndex(paragraphId);
  if (parsed === null) return null;
  if (parsed < 0 || parsed >= section.paragraphs.length) return null;
  return parsed;
}

function nextListId(section: CanvasSection): string {
  return `${section.id}-list-${(section.lists?.length ?? 0) + 1}`;
}

/**
 * Case- and whitespace-insensitive heading comparison key used by the
 * `add_heading` / `insert_section` idempotency guard. The realtime
 * model occasionally re-issues the same section with capitalisation or
 * trailing-space drift ("Definition and Origin" vs "definition and
 * origin "); collapsing both via lowercase + trimmed whitespace keeps
 * those calls converging on the same section.
 */
function normaliseHeading(heading: string | null | undefined): string {
  if (!heading) return "";
  return heading.trim().toLowerCase().replace(/\s+/g, " ");
}
