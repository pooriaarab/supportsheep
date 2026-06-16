import "server-only";
import { getBlogConfig } from "@/lib/blog-config";
import { createLogger, withStructuredLog } from "@/lib/logger";

const log = createLogger("interviews:tavus");

const ENDPOINT = "https://tavusapi.com/v2/conversations";

export interface TavusSession {
  conversationId: string;
  conversationUrl: string;
  expiresAt: number;
}

/**
 * Thrown by `mintTavusSession` when the Tavus Conversation API returns
 * non-2xx, when required configuration is missing, or when the response
 * payload is malformed. Mirrors `RealtimeMintError` so callers (the
 * consent route) can map a single typed error onto a structured client
 * response without parsing message strings.
 *
 * Carries the structured fields a single log line needs to diagnose
 * without cross-referencing other logs: HTTP status, request id, and a
 * truncated response body. The Tavus API key is NEVER stored on the
 * error and never logged from this module.
 */
export class TavusMintError extends Error {
  readonly kind:
    | "missing_api_key"
    | "missing_replica"
    | "upstream_error"
    | "malformed_response";
  readonly status: number | null;
  readonly requestId: string | null;
  readonly responseBody: string;

  constructor(opts: {
    kind: TavusMintError["kind"];
    status?: number | null;
    requestId?: string | null;
    responseBody?: string;
    message: string;
  }) {
    super(opts.message);
    this.name = "TavusMintError";
    this.kind = opts.kind;
    this.status = opts.status ?? null;
    this.requestId = opts.requestId ?? null;
    this.responseBody = opts.responseBody ?? "";
  }
}

export async function mintTavusSession(input: {
  topic?: string;
  guestName?: string;
  maxDurationSec: number;
  avatarId?: string;
  personaId?: string;
}): Promise<TavusSession> {
  const config = await getBlogConfig();
  const apiKey = config.ai?.providers?.tavus?.apiKey?.trim();
  if (!apiKey) {
    throw new TavusMintError({
      kind: "missing_api_key",
      message:
        "Tavus API key not configured. Add it in Settings > AI Providers.",
    });
  }
  const avatarId =
    input.avatarId ?? config.ai?.providers?.tavus?.defaultAvatarId?.trim();
  if (!avatarId) {
    throw new TavusMintError({
      kind: "missing_replica",
      message: "Tavus avatar not configured.",
    });
  }

  // persona_id is REQUIRED by the Tavus v2 Create Conversation endpoint.
  // Omitting it caused the upstream API to reject the request and our
  // consent route to surface a generic 502 with no diagnostic context.
  // Falls back to the configured default when not explicitly passed.
  const personaId =
    input.personaId ?? config.ai?.providers?.tavus?.defaultPersonaId?.trim();
  if (!personaId) {
    throw new TavusMintError({
      kind: "missing_replica",
      message:
        "Tavus persona not configured. Add a default Persona ID in Settings > AI Providers.",
    });
  }

  const requestBody = {
    replica_id: avatarId,
    persona_id: personaId,
    conversation_name: input.topic ?? "Interview",
    conversational_context: input.topic ?? "",
    properties: {
      max_call_duration: input.maxDurationSec,
      participant_left_timeout: 30,
    },
  };

  return withStructuredLog(
    log,
    "tavus.mint",
    {
      provider: "tavus",
      endpoint: ENDPOINT,
      replicaId: avatarId,
      personaId,
      maxDurationSec: input.maxDurationSec,
    },
    () => mintTavusSessionInner({ apiKey, requestBody }),
  );
}

async function mintTavusSessionInner(args: {
  apiKey: string;
  requestBody: Record<string, unknown>;
}): Promise<TavusSession> {
  const { apiKey, requestBody } = args;
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error("Tavus mint network error", {
      endpoint: ENDPOINT,
      error: message,
    });
    throw new TavusMintError({
      kind: "upstream_error",
      message: `Tavus mint network error: ${message}`,
    });
  }

  const requestId =
    res.headers.get("x-request-id") ?? res.headers.get("tavus-request-id");

  if (!res.ok) {
    const text = await res.text();
    log.error("Tavus mint failed", {
      endpoint: ENDPOINT,
      status: res.status,
      requestId,
      responseBody: text.slice(0, 1000),
    });
    throw new TavusMintError({
      kind: "upstream_error",
      status: res.status,
      requestId,
      responseBody: text,
      message: `Tavus mint failed (${res.status}): ${text.slice(0, 200)}`,
    });
  }

  const data = (await res.json()) as {
    conversation_id?: string;
    conversation_url?: string;
  };

  if (!data.conversation_id || !data.conversation_url) {
    log.error("Tavus mint returned malformed payload", {
      endpoint: ENDPOINT,
      requestId,
      keys: Object.keys(data),
    });
    throw new TavusMintError({
      kind: "malformed_response",
      status: res.status,
      requestId,
      message:
        "Tavus mint succeeded but response is missing conversation_id or conversation_url",
    });
  }

  log.info("Tavus conversation minted", {
    conversationId: data.conversation_id,
    requestId,
  });

  return {
    conversationId: data.conversation_id,
    conversationUrl: data.conversation_url,
    expiresAt: Date.now() + 60_000,
  };
}
