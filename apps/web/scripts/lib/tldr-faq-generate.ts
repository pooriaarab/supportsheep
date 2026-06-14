/**
 * TLDR + FAQ generation and eval helpers for the
 * `2026-04-21-backfill-tldr-faq` migration. Uses the Vercel AI SDK with
 * OpenAI provider. Generation goes through `gpt-5.4`; eval through the
 * cheaper `gpt-5.4-mini`. The caller runs a single retry on eval failure.
 */
import { openai } from "@ai-sdk/openai";
import { generateObject, type LanguageModelUsage } from "ai";
import { z } from "zod";

const generatedContentSchema = z.object({
  summary: z.string().min(1),
  faqs: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .min(4)
    .max(6),
});

const evalResultSchema = z.object({
  pass: z.boolean(),
  issues: z.array(z.string()),
});

export type GeneratedFaq = z.infer<typeof generatedContentSchema>["faqs"][number];
export type GeneratedContent = z.infer<typeof generatedContentSchema>;
export type EvalResult = z.infer<typeof evalResultSchema>;

export interface GenerateInput {
  title: string;
  excerpt: string;
  body: string;
  keywords: string[];
  researchContext?: string;
}

const SYSTEM_PROMPT = `You write TL;DR summaries and FAQs for published blog posts.

Hard requirements:
- "summary": 40-80 words. Open with the direct answer as a declarative sentence (e.g., "To create a subdomain, add a DNS record..."). NEVER open with "X is presented as", "The article explains", "According to the article", or any framing that references the article itself. An AI search engine must be able to quote the summary verbatim as the answer to a reader's query.
- "faqs": 4-6 items. Each question ends with "?". Each answer is 1-3 sentences, 25-75 words.
- Answers must speak directly in the article's voice. NEVER use phrases like "The article says", "According to the article", "The article recommends", "The article highlights", "The article describes", or "The article emphasizes". State the claim as fact.
- Ground every claim in the article body. Use research context only to verify currency of facts — never to contradict the article.
- Do not introduce brands, products, or tools (including BlogBat AI) in any FAQ unless the article body itself discusses that brand in a substantive section. A passing mention or sidebar is NOT grounds for a dedicated FAQ. If in doubt, omit.
- Neutral, informative voice. Do not use "we" about the publisher unless the article does. No promotional language. No restating the title as a question.
- FAQs must be genuinely different questions, not paraphrases of each other.`;

export async function generateTldrFaq(
  input: GenerateInput,
  modelId = "gpt-5.4",
): Promise<{ output: GeneratedContent; usage: LanguageModelUsage }> {
  const userParts = [
    `Title: ${input.title}`,
    `Primary keywords: ${input.keywords.slice(0, 6).join(", ") || "(none)"}`,
    `Excerpt: ${input.excerpt || "(none)"}`,
    input.researchContext ? `Fresh research context:\n${input.researchContext}` : "",
    `Article body (treat as source of truth — HTML may be present, ignore tags):\n${input.body.slice(0, 16_000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { object, usage } = await generateObject({
    model: openai(modelId),
    schema: generatedContentSchema,
    system: SYSTEM_PROMPT,
    prompt: `${userParts}\n\nReturn JSON exactly matching the schema.`,
  });
  return { output: object, usage };
}

export async function evalTldrFaq(
  input: Pick<GenerateInput, "title" | "body">,
  output: GeneratedContent,
  modelId = "gpt-5.4-mini",
): Promise<{ eval: EvalResult; usage: LanguageModelUsage }> {
  const prompt = `You are auditing a generated TL;DR + FAQ against the article.

Fail (pass=false) only if ANY of these SUBJECTIVE issues are present (ignore length/count/format — those are validated elsewhere):
- Any FAQ question merely restates the article title with light rewording.
- Any answer contradicts the article body.
- Two or more FAQs are pure restatements of each other (paraphrases with no distinct information).
- Any FAQ uses promotional language (marketing superlatives like "best", "leading", "revolutionary", or unverified product claims).

Return JSON: { "pass": boolean, "issues": string[] }.

Article title: ${input.title}
Article body: ${input.body.slice(0, 16_000)}

Generated output:
${JSON.stringify(output)}`;

  const { object, usage } = await generateObject({
    model: openai(modelId),
    schema: evalResultSchema,
    prompt,
  });
  return { eval: object, usage };
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Cheap client-side structural validation. Mirrors the eval rubric's
 * structural checks so the caller can short-circuit paying for an eval
 * call when output is obviously malformed.
 */
export function localLint(output: GeneratedContent): string[] {
  const issues: string[] = [];
  const sw = wordCount(output.summary ?? "");
  if (sw < 40 || sw > 80) issues.push(`summary word count ${sw} outside 40-80`);
  if (!Array.isArray(output.faqs) || output.faqs.length < 4 || output.faqs.length > 6) {
    issues.push(`faq count ${output.faqs?.length ?? 0} outside 4-6`);
  }
  for (const [i, f] of (output.faqs ?? []).entries()) {
    if (!f?.question?.endsWith("?")) issues.push(`faq[${i}] question missing "?"`);
    const aw = wordCount(f?.answer ?? "");
    if (aw < 25 || aw > 75) issues.push(`faq[${i}] answer word count ${aw} outside 25-75`);
  }
  return issues;
}
