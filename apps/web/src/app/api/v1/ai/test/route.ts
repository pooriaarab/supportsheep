/**
 * AI Provider Test API
 *
 * POST /api/v1/ai/test
 * Makes a real API call to verify the provider key and model work.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

const testSchema = z.object({
  provider: z.enum(["claude", "gpt", "gemini"]),
  apiKey: z.string().min(1, "API key is required"),
  model: z.string().min(1, "Model is required"),
});

export const POST = createApiHandler({
  auth: "user",
  input: testSchema,
  handler: async ({ body }) => {
    const { provider } = body;
    const apiKey = body.apiKey.trim();
    const model = body.model.trim();

    if (!apiKey || !model) {
      return NextResponse.json({
        success: false,
        message: "Connection failed: API key and model are required",
      });
    }

    try {
      let aiModel;

      switch (provider) {
        case "claude": {
          const anthropic = createAnthropic({ apiKey });
          aiModel = anthropic(model);
          break;
        }
        case "gpt": {
          const openai = createOpenAI({ apiKey });
          aiModel = openai(model);
          break;
        }
        case "gemini": {
          const google = createGoogleGenerativeAI({ apiKey });
          aiModel = google(model);
          break;
        }
      }

      const { text } = await generateText({
        model: aiModel,
        prompt: "Say hello in exactly one word.",
        // OpenAI's gpt-5.x family enforces max_output_tokens >= 16. Setting
        // 5 returned `Invalid 'max_output_tokens': integer below minimum
        // value` and broke the Test Connection button on /settings/ai.
        // 16 is the minimum that satisfies the validator while keeping the
        // probe cheap (the model still only needs to emit one word).
        maxOutputTokens: 16,
      });

      return NextResponse.json({
        success: true,
        message: `Connection successful (response: "${text.trim()}")`,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error occurred";
      return NextResponse.json(
        { success: false, message: `Connection failed: ${message}` },
        { status: 200 },
      );
    }
  },
});
