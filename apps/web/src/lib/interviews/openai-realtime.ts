import "server-only";

import { getProviderApiKey } from "@/lib/ai/providers";
import { createLogger, withStructuredLog } from "@/lib/logger";
import { type InterviewLanguage } from "./share-link-schema";
import { buildRealtimeToolSchemas } from "./tools";

const log = createLogger("interviews:openai-realtime");

export const REALTIME_MODEL = "gpt-realtime-2";
const ENDPOINT = "https://api.openai.com/v1/realtime/client_secrets";

export interface MintRealtimeSessionInput {
  voice: "alloy" | "echo" | "shimmer";
  instructions: string;
  tools: object[];
  /** Override the default REALTIME_MODEL if needed. */
  model?: string;
  language?: InterviewLanguage;
}

/**
 * Server-side voice activity detection (VAD) defaults sent on every realtime
 * session. Without an explicit `turn_detection`, the GA `gpt-realtime` model
 * fell into a runaway state during W15.1 walkthrough where the AI generated a
 * full transcript and authored an entire article with no user audio — it
 * treated each `response.done` as a cue to immediately produce the next
 * response, fabricating user turns in the process.
 *
 * The fix is to pin `server_vad` with documented defaults so the model ONLY
 * generates a response after the server VAD commits a user audio buffer
 * (`input_audio_buffer.committed`). `create_response: true` is what binds
 * "user finished speaking" to "AI may respond" — without it, the model may
 * still emit a response on a non-audio trigger. `interrupt_response: true`
 * lets the user barge in mid-AI-turn (matches real-conversation expectations).
 *
 * Values mirror OpenAI's published defaults for `server_vad`; raise
 * `threshold` if ambient noise (HVAC, traffic) keeps tripping false speech
 * detection in the field.
 */
export const SERVER_VAD_CONFIG = {
  type: "server_vad",
  threshold: 0.5,
  prefix_padding_ms: 300,
  silence_duration_ms: 800,
  create_response: true,
  interrupt_response: true,
} as const;

export interface RealtimeSession {
  /** Ephemeral token the browser uses for the WebRTC SDP exchange. */
  client_secret: { value: string; expires_at: number };
  id: string;
}

interface RawClientSecretResponse {
  // GA shape: top-level value/expires_at plus a session object.
  value?: string;
  expires_at?: number;
  id?: string;
  session?: { id?: string };
  // Legacy beta shape (still observed in some accounts): nested client_secret.
  client_secret?: { value?: string; expires_at?: number };
}

/**
 * Thrown by `mintRealtimeSession` when the GA endpoint returns non-2xx or a
 * malformed payload. Carries the structured fields callers need to log: the
 * HTTP status, the OpenAI request id (for support tickets), and a truncated
 * response body. Net-new because the previous `Error(message)` swallowed
 * everything past the first 200 chars into the message itself, which made
 * the consent route's 502 logs useless without re-probing.
 */
export class RealtimeMintError extends Error {
  readonly status: number;
  readonly requestId: string | null;
  readonly responseBody: string;
  constructor(opts: {
    status: number;
    requestId: string | null;
    responseBody: string;
  }) {
    super(
      `OpenAI realtime mint failed (${opts.status}): ${opts.responseBody.slice(0, 200)}`,
    );
    this.name = "RealtimeMintError";
    this.status = opts.status;
    this.requestId = opts.requestId;
    this.responseBody = opts.responseBody;
  }
}

/**
 * Mints an ephemeral realtime client secret. Browsers then use the returned
 * `value` as a bearer token for the WebRTC SDP handshake at
 * https://api.openai.com/v1/realtime?model=...
 *
 * Migrated from the legacy POST /v1/realtime/sessions (which OpenAI moved to
 * "Legacy APIs > Realtime Beta") to POST /v1/realtime/client_secrets.
 */
export async function mintRealtimeSession(
  input: MintRealtimeSessionInput,
): Promise<RealtimeSession> {
  const apiKey = await getProviderApiKey("gpt");
  const model = input.model ?? REALTIME_MODEL;

  return withStructuredLog(
    log,
    "openai.realtime.mint",
    { provider: "openai", endpoint: ENDPOINT, model },
    () => mintRealtimeSessionInner({ ...input, model }, apiKey),
  );
}

async function mintRealtimeSessionInner(
  input: MintRealtimeSessionInput & { model: string },
  apiKey: string,
): Promise<RealtimeSession> {
  const { model } = input;
  const requestBody = {
    session: {
      type: "realtime",
      model,
      instructions: input.instructions,
      output_modalities: ["audio"],
      audio: {
        // `format` is the `{ type, rate }` object the GA client_secrets
        // endpoint validates against — strings ("pcm16") return 400
        // "Invalid type for 'session.audio.input.format': expected an
        // object, but got a string instead". Verified live; do not change
        // without re-probing.
        input: {
          format: { type: "audio/pcm", rate: 24000 },
          // Pin server-side VAD with documented defaults so the model only
          // generates a response after a real user audio commit. Without
          // this the GA model ran away during W15.1 walkthrough — see
          // SERVER_VAD_CONFIG docs above.
          turn_detection: SERVER_VAD_CONFIG,
          // Whisper transcription opt-in nests under audio.input.transcription —
          // the older `session.input_audio_transcription` location (introduced
          // by V2.1 multi-language) is rejected with 400 "Unknown parameter:
          // 'session.input_audio_transcription'". The GA endpoint moved this
          // field into the audio-input subtree; verified live.
          ...(input.language && {
            transcription: { model: "whisper-1", language: input.language },
          }),
        },
        output: {
          format: { type: "audio/pcm", rate: 24000 },
          voice: input.voice,
        },
      },
      tools: input.tools,
      // Force the model to actually pick tools when appropriate. Without
      // this the realtime model defaults to audio-only turns and ignores
      // the registered canvas tools (silent "ai_thinking → ai_done"
      // turns with no tool_call events). "auto" lets the model decide
      // per turn but biases strongly toward tool use when tools are
      // declared, which is exactly what the live canvas requires.
      tool_choice: "auto",
    },
  };

  const res = await fetch(ENDPOINT, {
    method: "Article",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  const requestId = res.headers.get("x-request-id");

  if (!res.ok) {
    const text = await res.text();
    log.error("OpenAI realtime client_secrets mint failed", {
      endpoint: ENDPOINT,
      status: res.status,
      model,
      requestId,
      responseBody: text.slice(0, 1000),
    });
    throw new RealtimeMintError({
      status: res.status,
      requestId,
      responseBody: text,
    });
  }

  const data = (await res.json()) as RawClientSecretResponse;

  const value = data.value ?? data.client_secret?.value;
  const expires_at = data.expires_at ?? data.client_secret?.expires_at ?? 0;
  const id = data.id ?? data.session?.id ?? "";

  if (!value) {
    log.error("OpenAI realtime mint returned no ephemeral token value", {
      endpoint: ENDPOINT,
      model,
      requestId,
      keys: Object.keys(data),
    });
    throw new Error("OpenAI realtime mint succeeded but response is missing client secret value");
  }

  log.info("OpenAI realtime session minted", {
    model,
    requestId,
    expiresAt: expires_at,
  });

  return {
    client_secret: { value, expires_at },
    id,
  };
}

/**
 * The full list of realtime tool schemas the session is configured
 * with. Built from the per-tool registry at `./tools/`: any file that
 * adds a default-exported `Tool` becomes part of this list automatically.
 *
 * Includes both `sync` and `fire-and-forget` tools from Phase 5 onward —
 * fire-and-forget tools (images, SEO score, internal-link suggestions)
 * ack within milliseconds and stream their real result back through
 * the SSE diff channel, so they're safe to expose alongside sync
 * canvas mutations.
 */
export function getCanvasTools(): ReturnType<typeof buildRealtimeToolSchemas> {
  return buildRealtimeToolSchemas();
}

/**
 * Convenience constant — array form for callers that want to spread
 * the schemas into a request body. Resolved once at import time so
 * passing it to multiple sessions doesn't re-walk the registry.
 */
export const CANVAS_TOOLS = getCanvasTools();
