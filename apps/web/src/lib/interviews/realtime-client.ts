"use client";

import { createLogger } from "@/lib/logger";
import {
  MOCK_REALTIME_TOKEN_PREFIX,
  MockScriptedRealtimeClient,
} from "./mock-scripted-realtime-client";

const log = createLogger("interviews:realtime-client");

export type RealtimeClientState = "idle" | "connecting" | "live" | "reconnecting" | "ended" | "error";

/**
 * Conversational sub-states derived from the OpenAI Realtime data channel.
 * `RealtimeClientState` only models the connection lifecycle (idle → connecting
 * → live → …); the orb UI also needs to reflect whose turn it is on the wire.
 *
 *   - `user_speaking` — `input_audio_buffer.speech_started` fired; the mic is
 *     hearing the user. Orb pulses "listening" (info).
 *   - `ai_thinking` — user finished speaking or `response.created` fired
 *     before any audio delta arrived. Orb pulses "thinking" (warning).
 *   - `ai_speaking` — `response.audio.delta` / `response.output_audio.delta`
 *     started flowing. Orb pulses "speaking" (success).
 *   - `ai_done` — `response.done` / `response.completed` fired. Orb returns
 *     to ambient "listening" while we wait for the user's next turn.
 *
 * These do not collapse into `RealtimeClientState` because they fire many
 * times per session while the connection itself stays `live`.
 */
export type RealtimeConversationState =
  | "user_speaking"
  | "ai_thinking"
  | "ai_speaking"
  | "ai_done";

/**
 * A completed conversational turn surfaced for display in the guide-note
 * chat log. The realtime API only emits the final `transcript` once the
 * model finishes speaking, so this fires once per AI turn — not per audio
 * delta. User-side turns are appended directly by the hook when the author
 * sends a guide note, not by the realtime client.
 */
export interface AiChatTurn {
  /** Final, completed AI transcript text for the turn. */
  text: string;
  /** Epoch ms when `response.audio_transcript.done` was observed. */
  timestamp: number;
}

export interface RealtimeClientEvents {
  onTranscript: (chunk: { role: "user" | "ai"; text: string }) => void;
  onToolCall: (call: { name: string; arguments: unknown; callId?: string }) => void;
  onAudioLevel: (level: number) => void;
  onStateChange: (state: RealtimeClientState) => void;
  /**
   * Fired on data-channel turn-level transitions (user starts speaking, AI
   * starts thinking, AI starts speaking, AI finishes). Optional so existing
   * realtime-client.test.ts mock surfaces stay backwards-compatible.
   */
  onConversationState?: (state: RealtimeConversationState) => void;
  /**
   * Fired once per completed AI turn with the final transcript text. The
   * guide-note chat log consumes this to render "AI: …" rows alongside the
   * author's own guide notes. Optional so existing mocks remain backwards-
   * compatible — when undefined, the data-channel still drives `onTranscript`
   * for Firestore persistence.
   */
  onAiChatTurn?: (turn: AiChatTurn) => void;
  onUsage: (usage: { input_tokens?: number; output_tokens?: number }) => void;
}

export interface ConnectInput {
  ephemeralToken: string;
  baseUrl?: string; // defaults https://api.openai.com/v1
  /**
   * Optional `MediaDeviceInfo.deviceId` for the microphone the guest picked
   * in the pre-call device picker. When set, the WebRTC `getUserMedia` call
   * pins to that input instead of letting the OS pick the default mic — the
   * default is usually the laptop built-in even when a USB headset is
   * connected, which is a frequent source of "I sound muffled" feedback.
   */
  audioInputDeviceId?: string;
  /**
   * Optional interview id tag for the `first_ai_turn` boot log. When set,
   * the realtime client emits one structured INFO log the first time the
   * AI begins speaking after connect — the single signal ops uses to
   * verify "did the AI greet the user?" from gcloud without replaying the
   * audio stream. Omitted when running outside the interview session hook.
   */
  interviewId?: string;
}

// WebRTC reconnect policy. Mirrors the SSE backoff in use-interview-session.ts
// but on the realtime audio channel. Capped at 3 attempts — a fourth failure
// surfaces a hard error to the UI rather than looping forever and racking up
// OpenAI session-mint costs. Slots are 1s / 3s / 10s per product spec.
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BACKOFF_MS = [1_000, 3_000, 10_000];

// Instructions attached to the data-channel-open `response.create`. The
// session-level system prompt already pins the verbatim greeting text;
// this short directive forces the model to actually emit audio for its
// opening turn instead of returning an empty response under server VAD
// (the W15.4 `ai_greeting_timeout` regression). Kept short and
// imperative so it doesn't compete with the full system prompt.
const GREETING_RESPONSE_INSTRUCTIONS =
  "Begin the interview now. Speak your opening greeting aloud immediately, exactly as the session instructions specify. Do not wait for the user to speak first.";

export class RealtimeClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mediaStream: MediaStream | null = null;
  private state: RealtimeClientState = "idle";
  private reconnectAttempt = 0;
  private events: RealtimeClientEvents;
  private lastConnectInput: ConnectInput | null = null;
  private isReconnectingInProgress = false;
  private audioCtx: AudioContext | null = null;
  // Last `RealtimeConversationState` we surfaced. Tracked so the chatty
  // `response.audio.delta` stream does not re-fire `ai_speaking` on every
  // chunk and so the hook logs each turn-level transition only once.
  private lastConversationState: RealtimeConversationState | null = null;
  // Epoch ms when `connect()` was invoked. Used to compute `msFromConnect`
  // for the one-shot `first_ai_turn` boot log so ops can answer "did the
  // AI greet?" and "how long did it take?" from gcloud alone.
  private connectStartedAt = 0;
  // Has the `first_ai_turn` boot log fired on this connection? Latched
  // true on the first audio delta (or first transcript-done) so the log
  // fires exactly once per session even though the realtime API streams
  // many audio chunks per turn.
  private firstAiTurnLogged = false;
  // Epoch ms when the server VAD last committed a user audio buffer
  // (`input_audio_buffer.committed`). Used by the `realtime.response.created`
  // log so each server-fired response carries the elapsed ms since the
  // user actually spoke — a `response.created` with `audioMsSinceCommit:
  // null` is the signature of the W15.1 runaway-AI bug.
  private lastAudioCommittedAt: number | null = null;
  // When the ephemeral token is a mock-prefixed string we delegate the
  // entire session to the scripted SSE client and do NOT open a WebRTC
  // peer. This is the bypass the dev interview harness uses so local QA
  // runs don't burn real OpenAI Realtime spend.
  private mockDelegate: MockScriptedRealtimeClient | null = null;

  constructor(events: RealtimeClientEvents) {
    this.events = events;
  }

  async connect(input: ConnectInput): Promise<void> {
    this.lastConnectInput = input;
    // Stamp the connect time and reset the boot-log latch BEFORE any await
    // so a reconnect cycle re-arms the `first_ai_turn` log against the new
    // attempt's start time, not the original mount.
    this.connectStartedAt = Date.now();
    this.firstAiTurnLogged = false;
    this.lastAudioCommittedAt = null;

    // Mock-prefixed tokens mean LLM_PROVIDER=mock minted a scripted-timeline
    // ephemeral on the server. Skip the WebRTC handshake and let the
    // scripted client drive the same listener surface (it owns its own
    // `connecting → live` transitions, so we don't set state here). Real
    // production tokens never start with `mock-`, so this branch is inert
    // there.
    if (input.ephemeralToken.startsWith(MOCK_REALTIME_TOKEN_PREFIX)) {
      log.info("Routing realtime connect to MockScriptedRealtimeClient");
      const delegate = new MockScriptedRealtimeClient(this.events);
      this.mockDelegate = delegate;
      await delegate.connect({ ephemeralToken: input.ephemeralToken });
      return;
    }

    if (this.state !== "reconnecting") {
      this.setState("connecting");
    }

    try {
      const audioConstraints: MediaTrackConstraints | true = input.audioInputDeviceId
        ? { deviceId: { exact: input.audioInputDeviceId } }
        : true;
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      this.pc = new RTCPeerConnection();

      // Capture mic
      for (const track of this.mediaStream.getTracks()) {
        this.pc.addTrack(track, this.mediaStream);
      }

      // Subscribe to remote audio
      this.pc.ontrack = (e) => {
        log.info("Received remote audio track");
        try {
          const audioEl = document.createElement("audio");
          audioEl.autoplay = true;
          audioEl.srcObject = e.streams[0];
          audioEl.dataset.realtime = "remote";
          document.body.appendChild(audioEl);
          this.setupAudioLevelMeter(e.streams[0]);
        } catch (err) {
          log.error("Failed to append audio element or setup level meter", { error: err });
        }
      };

      // Data channel for events
      this.dc = this.pc.createDataChannel("oai-events");
      this.dc.onmessage = (e) => this.onDataChannelMessage(e.data as string);
      // The server-side VAD config (see `SERVER_VAD_CONFIG` in
      // `openai-realtime.ts`) gates AI responses on a committed user audio
      // buffer — which means the model will NOT fire the opening greeting
      // on its own. Trigger it exactly once when the data channel opens so
      // the AI greets first as the system prompt instructs, then VAD takes
      // over for subsequent turns. This is the ONLY response.create the
      // client fires that isn't tied to a tool-call narration cue.
      //
      // The greeting `response.create` carries explicit `instructions` so
      // the model is forced to emit audio for its opening line. Without
      // them W15.4 saw `response.created → response.done` with no
      // `response.audio.delta` in between — an empty 5s greeting turn
      // that tripped `ai_greeting_timeout`. Telling the model directly to
      // speak its opening line removes that ambiguity.
      this.dc.onopen = () => {
        this.sendResponseCreate({
          trigger: "greeting",
          instructions: GREETING_RESPONSE_INSTRUCTIONS,
        });
      };

      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      const baseUrl = input.baseUrl ?? "https://api.openai.com/v1";
      // OpenAI's GA realtime API moved the WebRTC SDP handshake from
      // `/v1/realtime?model=...` to `/v1/realtime/calls`. The legacy
      // query-param-model URL returns 400 on the GA endpoint (same
      // deprecation pattern as `/v1/realtime/sessions` →
      // `/v1/realtime/client_secrets` for ephemeral mint). The model is
      // already locked in by the ephemeral session minted server-side,
      // so it doesn't need to repeat in the URL.
      const sdpUrl = `${baseUrl}/realtime/calls`;
      const sdpRes = await fetch(sdpUrl, {
        method: "Article",
        headers: {
          Authorization: `Bearer ${input.ephemeralToken}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      if (!sdpRes.ok) {
        // Surface the OpenAI response body so the next 4xx is debuggable
        // from the browser console alone — the previous logger only
        // printed the status code, which left every regression as a
        // mystery 400.
        const errBody = await sdpRes.text().catch(() => "<no body>");
        const requestId = sdpRes.headers.get("x-request-id");
        log.error("Realtime server SDP exchange failed", {
          status: sdpRes.status,
          url: sdpUrl,
          requestId,
          responseBody: errBody.slice(0, 1000),
        });
        throw new Error(
          `Realtime connect failed (${sdpRes.status}): ${errBody.slice(0, 200)}`,
        );
      }

      const answer = await sdpRes.text();
      await this.pc.setRemoteDescription({ type: "answer", sdp: answer });

      this.setState("live");
      this.reconnectAttempt = 0;
      this.isReconnectingInProgress = false;

      this.pc.onconnectionstatechange = () => {
        if (this.pc?.connectionState === "failed" || this.pc?.connectionState === "disconnected") {
          log.warn("WebRTC connection failed or disconnected, triggering recovery");
          void this.handleDisconnect();
        }
      };
    } catch (err) {
      log.error("Failed to establish realtime WebRTC connection", { error: err });
      if (!this.isReconnectingInProgress) {
        this.setState("error");
      }
      throw err;
    }
  }

  mute(muted: boolean): void {
    if (this.mockDelegate) {
      this.mockDelegate.mute(muted);
      return;
    }
    log.info(`Muting microphone: ${muted}`);
    for (const track of this.mediaStream?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
  }

  /**
   * Inject a narration cue into the realtime session. This sends a
   * `conversation.item.create` (a marker-prefixed user-role message) plus a
   * `response.create` over the WebRTC data channel so the realtime model
   * immediately speaks a short narration line back to the user.
   *
   * Used by the interview-session hook when an SSE `tool_in_flight`,
   * `tool_result`, or `tool_completed` event arrives — without this
   * cue the model goes silent for the duration of every tool call,
   * which on a voice channel feels like the AI froze. Also used by the
   * canvas collaborative editor when the human types directly on the
   * page so the AI can see and react to the edit (W20.I, W23.E).
   *
   * The optional `kind` is purely for log breadcrumbs so we can tell
   * tool-driven cues apart from user-edit cues in production traces —
   * the payload itself stays a plain marker-prefixed message either way.
   *
   * Role choice — `user`, not `system`: the Realtime API treats
   * `role: "system"` items as ephemeral guidance for the *next*
   * response only and prunes them from the conversation history a
   * subsequent turn can read back (the W23.E walkthrough caught this:
   * the user typed text, then asked "what did I type?" two turns
   * later, and the AI had no record of the cue). Posting as
   * `role: "user"` with the `[system narration cue]` marker prefix
   * keeps the cue persistent in conversation history so a later turn
   * can quote back the verbatim user text, while the system prompt's
   * narration-cue handling block tells the model the marker means
   * "out-of-band — don't treat as user speech".
   *
   * No-op when:
   * - the data channel is not yet open (cue would be silently dropped
   *   by the OpenAI session anyway),
   * - the session is in a non-live state (`connecting`/`reconnecting`/
   *   `ended`/`error`),
   * - we are routed to the mock scripted client (the dev harness owns
   *   its own scripted narration timeline).
   */
  sendNarrationCue(text: string, options?: { kind?: string }): void {
    const kind = options?.kind;
    if (this.mockDelegate) {
      log.debug("sendNarrationCue: mock delegate active, skipping", { kind });
      return;
    }
    if (this.state !== "live") {
      log.debug("sendNarrationCue: skipped (not live)", { state: this.state, kind });
      return;
    }
    if (!this.dc || this.dc.readyState !== "open") {
      log.debug("sendNarrationCue: skipped (data channel not open)", {
        readyState: this.dc?.readyState ?? "none",
        kind,
      });
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    log.info("sendNarrationCue", { textLength: trimmed.length, kind });
    try {
      // Inject the cue as a user-role conversation item so the realtime
      // session retains it in the persistent history (system-role items
      // are pruned after the next response). The marker prefix in
      // `trimmed` plus the system-prompt's narration-cue handling block
      // tells the model this is out-of-band and not literal user
      // speech. We follow with `response.create` so the model speaks
      // the next short narration line immediately — the whole point of
      // the cue is to break the silence right after a tool call or
      // canvas edit.
      this.dc.send(
        JSON.stringify({
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [{ type: "input_text", text: trimmed }],
          },
        }),
      );
      this.sendResponseCreate({
        trigger: "tool_result",
        textLength: trimmed.length,
      });
    } catch (err) {
      log.warn("sendNarrationCue: data channel send failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Send a single `response.create` over the WebRTC data channel and log
   * the trigger so every client-fired AI response is traceable.
   *
   * The W15.1 walkthrough surfaced a runaway-AI bug where the model
   * generated a full article transcript with no user audio. The session
   * config now pins server-side VAD with `create_response: true` so the
   * SERVER auto-fires responses only on committed user audio — but the
   * client still needs to fire `response.create` for the opening greeting
   * and after tool-result narration cues. This wrapper makes every such
   * fire structured-loggable so future fabrications are diagnosable from
   * logs alone instead of via session replay.
   *
   * `instructions`, when provided, is attached to the inner
   * `response.create` payload so the model is told exactly what to do for
   * that turn (e.g. the greeting fix forces the model to speak its
   * opening line aloud, which closed the W15.4 silent-greeting gap).
   */
  private sendResponseCreate(meta: {
    trigger: "greeting" | "tool_result";
    textLength?: number;
    instructions?: string;
  }): void {
    if (!this.dc || this.dc.readyState !== "open") {
      log.debug("sendResponseCreate: data channel not open", {
        trigger: meta.trigger,
        readyState: this.dc?.readyState ?? "none",
      });
      return;
    }
    log.info("response_create_sent", {
      trigger: meta.trigger,
      interviewId: this.lastConnectInput?.interviewId,
      textLength: meta.textLength ?? 0,
      instructionsLength: meta.instructions?.length ?? 0,
    });
    try {
      const payload: { type: "response.create"; response?: { instructions: string } } = {
        type: "response.create",
      };
      if (meta.instructions) {
        payload.response = { instructions: meta.instructions };
      }
      this.dc.send(JSON.stringify(payload));
    } catch (err) {
      log.warn("sendResponseCreate: send failed", {
        trigger: meta.trigger,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  disconnect(): void {
    if (this.mockDelegate) {
      this.mockDelegate.disconnect();
      this.mockDelegate = null;
      return;
    }
    log.info("Disconnecting realtime client");
    this.setState("ended");
    this.dc?.close();
    this.pc?.close();
    for (const track of this.mediaStream?.getTracks() ?? []) {
      track.stop();
    }
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    try {
      document.querySelectorAll("audio[data-realtime='remote']").forEach((el) => el.remove());
    } catch {
      // safe in non-DOM envs
    }
  }

  /** End the call; subclasses for `/end` flow callsite. Alias for disconnect. */
  forceEnd(): void {
    this.disconnect();
  }

  private async handleDisconnect(): Promise<void> {
    if (this.isReconnectingInProgress) return;
    this.isReconnectingInProgress = true;

    if (this.reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
      log.error("Max reconnection attempts reached. Failing connection.");
      this.setState("error");
      this.isReconnectingInProgress = false;
      return;
    }

    this.setState("reconnecting");
    const wait = RECONNECT_BACKOFF_MS[this.reconnectAttempt] ?? 5000;
    this.reconnectAttempt++;
    log.info(`Reconnecting in ${wait}ms (attempt ${this.reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})`);
    
    await new Promise((r) => setTimeout(r, wait));

    if (this.state === "ended") {
      this.isReconnectingInProgress = false;
      return;
    }

    if (this.lastConnectInput) {
      try {
        // Close old connections cleanly
        this.dc?.close();
        this.pc?.close();
        for (const track of this.mediaStream?.getTracks() ?? []) {
          track.stop();
        }
        await this.connect(this.lastConnectInput);
      } catch (err) {
        log.error("Reconnection attempt failed", { error: err });
        this.isReconnectingInProgress = false;
        // handleDisconnect will be called again on next pc state failure
        void this.handleDisconnect();
      }
    } else {
      this.isReconnectingInProgress = false;
    }
  }

  private setState(s: RealtimeClientState): void {
    this.state = s;
    this.events.onStateChange(s);
  }

  private setupAudioLevelMeter(stream: MediaStream): void {
    // Close any previous AudioContext from a prior connect()/reconnect cycle —
    // the prior stream's rAF loop only exits on "ended"/"error" states, so
    // during "reconnecting" the old meter would leak alongside the new one.
    this.audioCtx?.close().catch(() => {});
    try {
      const ctx = new AudioContext();
      this.audioCtx = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        // Exit if this ctx is no longer the active one (replaced by a reconnect)
        // OR if the client is finished.
        if (this.audioCtx !== ctx || this.state === "ended" || this.state === "error") {
          ctx.close().catch(() => {});
          return;
        }
        analyser.getByteFrequencyData(data);
        const sum = data.reduce((a, b) => a + b, 0);
        const level = sum / data.length / 255;
        this.events.onAudioLevel(level);
        requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // AudioContext not available in test env — silent
    }
  }

  /**
   * Emit a one-shot structured INFO log the first time the AI starts
   * speaking after `connect()`. This is the single signal ops uses to
   * verify "did the AI greet the user at session start?" — searchable in
   * gcloud as `interviews:realtime-client first_ai_turn`. Subsequent AI
   * turns within the same session are intentionally not logged here; the
   * goal is to detect missing or delayed greetings, not turn-level
   * cadence.
   */
  private maybeLogFirstAiTurn(source: "audio_delta" | "transcript_done"): void {
    if (this.firstAiTurnLogged) return;
    this.firstAiTurnLogged = true;
    const msFromConnect = this.connectStartedAt
      ? Date.now() - this.connectStartedAt
      : 0;
    log.info("first_ai_turn", {
      interviewId: this.lastConnectInput?.interviewId,
      msFromConnect,
      source,
    });
  }

  private emitConversationState(state: RealtimeConversationState): void {
    // Coalesce repeats so the chatty `response.audio.delta` stream does not
    // fire the same `ai_speaking` transition on every chunk.
    if (this.lastConversationState === state) return;
    this.lastConversationState = state;
    this.events.onConversationState?.(state);
  }

  private onDataChannelMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw) as { type: string; [k: string]: unknown };
      log.debug("Received data channel message", { type: msg.type });
      switch (msg.type) {
        case "input_audio_buffer.speech_started":
          this.emitConversationState("user_speaking");
          break;
        case "input_audio_buffer.speech_stopped":
        case "input_audio_buffer.committed":
          // User finished talking but the AI has not started yet — the gap
          // until the first audio delta is the AI "thinking". Stamp the
          // commit time so the next `response.created` log can report how
          // many ms of audio the model is actually responding to.
          this.lastAudioCommittedAt = Date.now();
          this.emitConversationState("ai_thinking");
          break;
        case "response.created":
          // Log every server-fired response.created so the W15.1 runaway-AI
          // bug (AI generates a full transcript with no mic input) is
          // diagnosable from logs alone. `responseId` is the OpenAI handle
          // for follow-up correlation in their dashboards. A response that
          // fires without a preceding `input_audio_buffer.committed`
          // (audioMsSinceCommit === null) is the signature of the runaway
          // state we fixed by pinning server_vad — leaving this log in
          // production lets us catch regressions immediately.
          log.info("realtime.response.created", {
            trigger: this.lastAudioCommittedAt ? "user_speech" : "greeting_or_tool",
            interviewId: this.lastConnectInput?.interviewId,
            responseId: typeof msg.response === "object" && msg.response
              ? (msg.response as { id?: string }).id ?? null
              : null,
            audioMsSinceCommit: this.lastAudioCommittedAt
              ? Date.now() - this.lastAudioCommittedAt
              : null,
            lastConversationState: this.lastConversationState,
          });
          this.emitConversationState("ai_thinking");
          break;
        case "response.output_item.added":
          // A response has been scheduled but no audio bytes have arrived
          // yet — treat as "thinking" so the orb flips off "listening".
          this.emitConversationState("ai_thinking");
          break;
        case "response.audio.delta":
        case "response.output_audio.delta":
          // The first audio delta is also the first audible byte of the
          // greeting — log it so ops can verify the AI spoke first.
          this.maybeLogFirstAiTurn("audio_delta");
          this.emitConversationState("ai_speaking");
          break;
        case "response.audio_transcript.done": {
          const text = String(msg.transcript ?? "");
          // Tool-only turns can complete the transcript without an audio
          // delta — still treat as the first AI turn so the log fires.
          this.maybeLogFirstAiTurn("transcript_done");
          this.events.onTranscript({ role: "ai", text });
          // Surface the completed turn for the chat log. Empty transcripts
          // (mic glitch, tool-only turn) are not useful to render and would
          // produce blank chat rows — skip them.
          if (text.trim().length > 0) {
            this.events.onAiChatTurn?.({ text, timestamp: Date.now() });
          }
          break;
        }
        case "conversation.item.input_audio_transcription.completed":
          this.events.onTranscript({ role: "user", text: String(msg.transcript ?? "") });
          break;
        case "response.function_call_arguments.done": {
          const name = String(msg.name ?? "");
          let args: unknown = {};
          try {
            args = JSON.parse(String(msg.arguments ?? "{}"));
          } catch {}
          const callId =
            typeof msg.call_id === "string"
              ? msg.call_id
              : typeof msg.callId === "string"
                ? msg.callId
                : undefined;
          this.events.onToolCall({ name, arguments: args, callId });
          break;
        }
        case "response.done":
        case "response.completed": {
          // AI's turn is over — flip to `ai_done` so the orb returns to the
          // ambient "listening" pulse.
          this.emitConversationState("ai_done");
          const usage = (msg.response as { usage?: { input_tokens?: number; output_tokens?: number } } | undefined)?.usage;
          if (usage) {
            this.events.onUsage(usage);
          }
          break;
        }
        default:
          // ignore unknown event types
          break;
      }
    } catch (err) {
      log.error("Failed to parse data channel message", { error: err, raw });
    }
  }
}
