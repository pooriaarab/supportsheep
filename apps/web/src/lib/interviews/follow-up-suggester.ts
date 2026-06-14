import "server-only";
import {
  createAnthropicClient,
  isMockAnthropicEnabled,
} from "@/lib/ai/anthropic-client";
import { getProviderApiKey } from "@/lib/ai/providers";

interface SuggestInput {
  topic: string;
  style: string;
  transcript: string; // last ~2000 chars of mixed user+AI turns
}

interface Suggestion {
  text: string;
  rationale: string;
}

const SYSTEM_PROMPT = `You are an expert AI interviewer assistant. Your task is to suggest 1-3 relevant, probing follow-up questions that the interview host can nudge the AI interviewer to ask or ask themselves.
The input will include the interview topic, the interviewer style, and the recent transcript window of the interview.
Provide your response strictly as a JSON array of objects, where each object has "text" (the follow-up question) and "rationale" (a short reason why this question is valuable/insightful at this point).
Example output:
[
  {
    "text": "Can you elaborate on how you handled the team transition?",
    "rationale": "The guest mentioned some resistance from the team but didn't go into detail about how they resolved it."
  }
]
Do not wrap your output in any conversational filler. Only return the JSON array.`;

export async function suggestFollowUps(input: SuggestInput): Promise<Suggestion[]> {
  // Resolve Anthropic API key. Try settings (Firestore) first, fallback to
  // environment variable. Skip the lookup entirely when the in-process mock
  // is active — the factory ignores apiKey in that mode.
  let apiKey: string | undefined;
  if (!isMockAnthropicEnabled()) {
    try {
      apiKey = await getProviderApiKey("claude");
    } catch (_err) {
      apiKey = process.env.ANTHROPIC_API_KEY;
    }

    if (!apiKey) {
      throw new Error(
        "Anthropic API key not configured (neither Firestore Settings nor ANTHROPIC_API_KEY env var found)."
      );
    }
  }

  const client = createAnthropicClient({ apiKey });

  const res = await client.messages.create({
    model: "claude-haiku-4-5", // fast + cheap for this synchronous suggestion path
    max_tokens: 500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Topic: ${input.topic}\nStyle: ${input.style}\n\nRecent transcript:\n${input.transcript}\n\nReturn JSON array of 1-3 {text, rationale}.`,
      },
    ],
  });

  const text = res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  return parseSuggestions(text);
}

function parseSuggestions(text: string): Suggestion[] {
  try {
    // Tolerant parse: try to find the JSON array inside the text block (e.g. if wrapped in ```json)
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item: unknown) => {
        const obj = item as Record<string, unknown> | null;
        return {
          text: String(obj?.text || "").trim(),
          rationale: String(obj?.rationale || "").trim(),
        };
      })
      .filter((item) => item.text !== "");
  } catch (_err) {
    return [];
  }
}
