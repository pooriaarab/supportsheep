import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { createAnthropicClient } from "@/lib/ai/anthropic-client";
import type { CanvasState } from "./writer-worker";
import type { InterviewLanguage } from "./share-link-schema";

export interface AsyncStitcherQuestion {
  id: string;
  text: string;
}

export interface AsyncStitcherResponse {
  questionId: string;
  transcript: string;
}

export interface StitchAsyncInterviewOptions {
  questions: AsyncStitcherQuestion[];
  responses: AsyncStitcherResponse[];
  topic?: string;
  goal?: string;
  language?: InterviewLanguage;
  guestName?: string;
  apiKey?: string;
  client?: Anthropic;
}

const SYSTEM_PROMPT = `
You are an expert editor and blog writer.
Your job is to read an interview transcript (which consists of questions and answers) and generate a beautifully written, cohesive blog article.
The article should feel modern, authoritative, and engaging.

Rules for polished prose:
- Group related Q&As into cohesive sections with engaging headings.
- Refine the speaker's actual spoken words into smooth, factual, and engaging paragraphs. Eliminate verbal fillers, repetitive phrases, and structural disorganization.
- Keep exact verbatim quotes of key insights from the speaker, attributing them to the speaker (use their name when provided).
- Generate a compelling, high-quality title for the article.
- Provide SEO metadata (description, tags, suggested category).
- Ensure all content is written in the specified Language.

You must output strictly a JSON object conforming to the following TypeScript interface (do not output any markdown block wrappers, prose preambles, or explanations, just raw JSON):

interface CanvasSection {
  id: string; // unique stable id like "section-1", "section-2", etc.
  heading: string | null;
  bullets: string[];
  paragraphs: string[];
  quotes: Array<{ text: string; attributedTo: string }>;
  finalized: boolean; // always set to true
}

interface CanvasState {
  title: string;
  sections: CanvasSection[];
  meta: {
    description: string;
    tags: string[];
    suggestedCategory: string | null;
  };
}
`.trim();

export async function stitchAsyncInterview(opts: StitchAsyncInterviewOptions): Promise<CanvasState> {
  const { questions, responses, topic = "", goal = "", language = "en", guestName = "Guest", client, apiKey } = opts;

  // 1. Build the matched transcript
  const transcriptLines: string[] = [];
  for (const q of questions) {
    const res = responses.find((r) => r.questionId === q.id);
    if (res?.transcript?.trim()) {
      transcriptLines.push(`Q: ${q.text}\nA: ${res.transcript.trim()}`);
    }
  }

  if (transcriptLines.length === 0) {
    return {
      title: "No responses provided",
      sections: [],
      meta: {
        description: "",
        tags: [],
        suggestedCategory: null,
      },
    };
  }

  // 2. Validate client / apiKey. When LLM_PROVIDER=mock the factory
  // returns an in-process mock and apiKey is unused — defer the required
  // check to the factory so the mock path stays no-config.
  const anthropicClient = client ?? createAnthropicClient({ apiKey });

  // 3. Prepare Prompt
  const prompt = `
Generate a beautiful article from the following async interview transcript.

Transcript:
${transcriptLines.join("\n\n")}

Metadata:
Topic: ${topic}
Goal: ${goal}
Language: ${language}
Guest Name: ${guestName}

Please output the completed CanvasState JSON.
`.trim();

  // 4. Call Anthropic
  const response = await anthropicClient.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";
  if (!text) {
    throw new Error("Empty response received from Claude");
  }

  // 5. Parse and Return
  try {
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned) as CanvasState;
  } catch (err) {
    throw new Error(`Failed to parse Claude's response as CanvasState JSON: ${err instanceof Error ? err.message : String(err)}\nResponse text: ${text}`);
  }
}
