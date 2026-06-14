/**
 * Writing Skills Pipeline Engine
 *
 * Runs a sequence of writing skills (AI prompts) on content.
 * Each skill processes the output of the previous one.
 */

import "server-only";

import { generateContent } from "@/lib/ai/generate";
import type { AIProvider } from "@/lib/ai/providers";
import { getWritingSkill } from "@/lib/writing-skills/repository";
import { createLogger } from "@/lib/logger";

const log = createLogger("lib:generation:skills");

/**
 * Run a sequence of writing skills on content (scoped to a blog).
 * Each skill's output becomes the next skill's input.
 */
export async function runSkillsPipeline(
  content: string,
  skillIds: string[],
  blogId: string,
): Promise<string> {
  let result = content;

  for (const skillId of skillIds) {
    const skill = await getWritingSkill(blogId, skillId);

    if (!skill?.enabled) {
      log.info("Skipping disabled or missing skill", { skillId });
      continue;
    }

    log.info("Running skill", { skillId, name: skill.name });

    result = await generateContent({
      provider: skill.provider as AIProvider,
      systemPrompt: skill.prompt,
      userPrompt: `Process the following content. Return ONLY the processed content, no explanations:\n\n${result}`,
      temperature: 0.3,
    });
  }

  return result;
}
