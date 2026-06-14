/**
 * Scripted timelines for the OpenAI Realtime mock used by the dev interview
 * harness (`apps/web/scripts/dev-interview-harness.ts`).
 *
 * Why a script and not a real WebRTC peer? Faking a real `RTCPeerConnection`
 * end-to-end is more code than the harness needs — and OpenAI Realtime spend
 * is the only thing the developer is trying to avoid on local QA runs. A
 * scripted timeline lets us flip the orb through every conversation state,
 * fire each canvas tool group, and exercise the SSE/diff pipeline without
 * ever opening a peer connection or touching `api.openai.com`.
 *
 * Two timeline shapes:
 *
 * - `basic` (~30s, 4 tool calls) — fast smoke test for the live-call orb +
 *   the small set of tools the writer-worker hands the canvas first.
 * - `comprehensive` (~60s, 12 tool calls) — exercises one tool from every
 *   category the realtime session exposes (title, sections, paragraphs,
 *   formatting marks, embeds, SEO meta), so a single harness run covers
 *   the full canvas-mutation surface.
 *
 * Both timelines end with `state: "idle"` so the harness can detect "the
 * mock interview wound down" without a separate end-of-call signal. The
 * client adapter (`MockScriptedRealtimeClient`) replays these events at
 * the listed `delayMs` offsets to give the orb a human-paced demo.
 */

export type MockTimelineMode = "basic" | "comprehensive";

/**
 * One event in a scripted timeline. Each event is dispatched `delayMs`
 * after the SSE connection opens (NOT cumulative — the server emits the
 * full list with absolute offsets and the client schedules each one).
 *
 * Shapes mirror the on-wire OpenAI realtime data-channel messages that
 * `RealtimeClient.onDataChannelMessage` switches on, so a downstream
 * consumer can keep the same parse/dispatch logic for real and mock
 * transports.
 */
export type MockTimelineEvent =
  | {
      delayMs: number;
      kind: "conversation_state";
      /** One of the data-channel message types `RealtimeClient` recognises. */
      type:
        | "input_audio_buffer.speech_started"
        | "input_audio_buffer.committed"
        | "response.created"
        | "response.audio.delta"
        | "response.done";
    }
  | {
      delayMs: number;
      kind: "transcript";
      role: "user" | "ai";
      text: string;
    }
  | {
      delayMs: number;
      kind: "tool_call";
      name: string;
      callId: string;
      arguments: Record<string, unknown>;
    }
  | {
      delayMs: number;
      kind: "usage";
      input_tokens: number;
      output_tokens: number;
    }
  | {
      delayMs: number;
      kind: "idle";
    };

/**
 * The basic timeline. ~30s wall-clock, four tool calls covering title +
 * section creation + paragraph insertion. Lines up with the smallest
 * canvas mutations the writer-worker performs on a fresh interview.
 */
const BASIC_TIMELINE: MockTimelineEvent[] = [
  { delayMs: 0, kind: "conversation_state", type: "input_audio_buffer.speech_started" },
  { delayMs: 1_500, kind: "transcript", role: "user", text: "I'd like to write a post about local-first dev tools." },
  { delayMs: 2_000, kind: "conversation_state", type: "input_audio_buffer.committed" },
  { delayMs: 2_200, kind: "conversation_state", type: "response.created" },
  { delayMs: 3_500, kind: "tool_call", name: "set_title", callId: "mock-basic-1", arguments: { title: "Local-First Dev Tools" } },
  { delayMs: 4_500, kind: "conversation_state", type: "response.audio.delta" },
  { delayMs: 5_500, kind: "transcript", role: "ai", text: "Great — let's draft a section on why local-first matters." },
  { delayMs: 7_000, kind: "tool_call", name: "insert_section", callId: "mock-basic-2", arguments: { heading: "Why local-first matters" } },
  { delayMs: 9_500, kind: "conversation_state", type: "response.done" },
  { delayMs: 9_600, kind: "usage", input_tokens: 80, output_tokens: 120 },
  { delayMs: 11_000, kind: "conversation_state", type: "input_audio_buffer.speech_started" },
  { delayMs: 14_000, kind: "conversation_state", type: "input_audio_buffer.committed" },
  { delayMs: 14_200, kind: "conversation_state", type: "response.created" },
  { delayMs: 16_000, kind: "tool_call", name: "insert_paragraph", callId: "mock-basic-3", arguments: { sectionId: "section-1", text: "Local-first apps keep data on-device, so editing stays fast even when the network is gone." } },
  { delayMs: 20_000, kind: "tool_call", name: "insert_paragraph", callId: "mock-basic-4", arguments: { sectionId: "section-1", text: "They sync in the background once the network is back, so collaboration still works." } },
  { delayMs: 24_000, kind: "conversation_state", type: "response.done" },
  { delayMs: 24_100, kind: "usage", input_tokens: 120, output_tokens: 220 },
  { delayMs: 28_000, kind: "idle" },
];

/**
 * The comprehensive timeline. ~60s wall-clock, twelve tool calls touching
 * every category the realtime session exposes. Use this to validate the
 * full canvas-mutation surface in a single harness run.
 */
const COMPREHENSIVE_TIMELINE: MockTimelineEvent[] = [
  { delayMs: 0, kind: "conversation_state", type: "input_audio_buffer.speech_started" },
  { delayMs: 1_500, kind: "transcript", role: "user", text: "Let's write a deep-dive on streaming UIs." },
  { delayMs: 2_000, kind: "conversation_state", type: "input_audio_buffer.committed" },
  { delayMs: 2_200, kind: "conversation_state", type: "response.created" },
  // Title + subtitle + slug — canvas metadata.
  { delayMs: 3_000, kind: "tool_call", name: "set_title", callId: "mock-comp-1", arguments: { title: "Streaming UIs in Practice" } },
  { delayMs: 4_500, kind: "tool_call", name: "set_subtitle", callId: "mock-comp-2", arguments: { subtitle: "What we learned shipping React Server Components." } },
  { delayMs: 6_000, kind: "tool_call", name: "set_slug", callId: "mock-comp-3", arguments: { slug: "streaming-uis-in-practice" } },
  // Section + content.
  { delayMs: 7_500, kind: "conversation_state", type: "response.audio.delta" },
  { delayMs: 8_000, kind: "tool_call", name: "insert_section", callId: "mock-comp-4", arguments: { heading: "Why streaming wins" } },
  { delayMs: 10_500, kind: "tool_call", name: "insert_paragraph", callId: "mock-comp-5", arguments: { sectionId: "section-1", text: "Streaming UIs deliver the first paint as soon as the layout shell is ready." } },
  { delayMs: 13_000, kind: "tool_call", name: "add_bullet", callId: "mock-comp-6", arguments: { sectionId: "section-1", text: "Faster time-to-first-byte for content-heavy routes." } },
  { delayMs: 15_500, kind: "conversation_state", type: "response.done" },
  { delayMs: 15_600, kind: "usage", input_tokens: 220, output_tokens: 340 },
  { delayMs: 18_000, kind: "conversation_state", type: "input_audio_buffer.speech_started" },
  { delayMs: 21_000, kind: "conversation_state", type: "input_audio_buffer.committed" },
  { delayMs: 21_200, kind: "conversation_state", type: "response.created" },
  // Formatting marks.
  { delayMs: 23_000, kind: "tool_call", name: "apply_bold", callId: "mock-comp-7", arguments: { sectionId: "section-1", paragraphId: "p-1", from: 0, to: 13 } },
  { delayMs: 25_500, kind: "tool_call", name: "apply_link", callId: "mock-comp-8", arguments: { sectionId: "section-1", paragraphId: "p-1", from: 0, to: 13, href: "https://nextjs.org/docs" } },
  // Embeds.
  { delayMs: 28_000, kind: "tool_call", name: "embed_youtube", callId: "mock-comp-9", arguments: { sectionId: "section-1", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } },
  // SEO meta + categories.
  { delayMs: 31_000, kind: "tool_call", name: "set_seo_meta", callId: "mock-comp-10", arguments: { description: "How we use streaming UIs to ship a fast, content-heavy blog." } },
  { delayMs: 33_500, kind: "tool_call", name: "set_keywords", callId: "mock-comp-11", arguments: { keywords: ["streaming", "react", "ssr"] } },
  // Finalise the section so the writer-worker can publish-ready it.
  { delayMs: 36_000, kind: "tool_call", name: "finalize_section", callId: "mock-comp-12", arguments: { sectionId: "section-1" } },
  { delayMs: 40_000, kind: "conversation_state", type: "response.done" },
  { delayMs: 40_100, kind: "usage", input_tokens: 380, output_tokens: 540 },
  { delayMs: 55_000, kind: "idle" },
];

/**
 * Look up a timeline by mode. Returns a shallow copy so callers can sort
 * or filter without disturbing the canonical script (the unit tests rely
 * on monotonic `delayMs`).
 */
export function getMockRealtimeTimeline(mode: MockTimelineMode): MockTimelineEvent[] {
  const source = mode === "comprehensive" ? COMPREHENSIVE_TIMELINE : BASIC_TIMELINE;
  return source.slice();
}

/**
 * Total wall-clock the timeline takes to fully play out. Useful to size
 * SSE keep-alive intervals and harness wait-for-idle helpers without
 * hard-coding the same numbers in two places.
 */
export function getMockRealtimeTimelineDurationMs(mode: MockTimelineMode): number {
  const events = getMockRealtimeTimeline(mode);
  let max = 0;
  for (const event of events) {
    if (event.delayMs > max) max = event.delayMs;
  }
  return max;
}
