import { generateText } from "ai";
import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { getProviderModel } from "@/lib/ai/providers";
import { getErrorMessage } from "@/lib/error-utils";
import { getFreeToolById } from "@/lib/free-tools/repository";

function isMissingProviderCredentials(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("api key") ||
    message.includes("api-key") ||
    message.includes("x-api-key") ||
    message.includes("not configured") ||
    message.includes("unauthorized")
  );
}

function parseJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response did not include JSON");
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function stringField(
  value: unknown,
  fallback: string,
  maxLength: number,
): string {
  return (typeof value === "string" ? value : fallback)
    .trim()
    .slice(0, maxLength);
}

function truncate(value: string | undefined, maxLength: number): string {
  return (value ?? "").slice(0, maxLength);
}

function httpsUrlField(value: unknown, fallback: string): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  try {
    return candidate && new URL(candidate).protocol === "https:"
      ? candidate
      : fallback;
  } catch {
    return fallback;
  }
}

export const POST = createApiHandler<unknown, { id: string }>({
  auth: "user",
  handler: async ({ params, blogId }) => {
    const tool = await getFreeToolById(params.id, blogId);
    if (!tool) {
      return NextResponse.json(
        { error: "Free tool not found" },
        { status: 404 },
      );
    }

    let model: Awaited<ReturnType<typeof getProviderModel>>;
    try {
      model = await getProviderModel(tool.ai.provider, tool.ai.model);
    } catch (error) {
      if (isMissingProviderCredentials(error)) {
        return NextResponse.json(
          { error: "AI provider is not configured" },
          { status: 503 },
        );
      }
      throw error;
    }

    let text: string;
    try {
      const generation = await generateText({
        model,
        system:
          "You draft concise callouts for predefined public SEO tools. Return JSON only.",
        prompt: [
          `Tool title: ${truncate(tool.title, 160)}`,
          `Tool slug: ${truncate(tool.slug, 120)}`,
          `Tool intro: ${truncate(tool.intro, 1000)}`,
          `Tool meta description: ${truncate(tool.metaDescription, 320)}`,
          `Current primary URL: ${truncate(tool.callout.primaryUrl, 500)}`,
          "Return a JSON object with heading, body, primaryLabel, primaryUrl, secondaryLabel, and secondaryUrl. Use only https URLs.",
        ].join("\n"),
        temperature: 0.5,
        maxOutputTokens: 500,
      });
      text = generation.text;
    } catch (error) {
      if (isMissingProviderCredentials(error)) {
        return NextResponse.json(
          { error: "AI provider is not configured" },
          { status: 503 },
        );
      }
      throw error;
    }

    let draft: Record<string, unknown>;
    try {
      draft = parseJsonObject(text);
    } catch {
      return NextResponse.json(
        { error: "AI callout response was not valid JSON" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      data: {
        heading: stringField(draft.heading, tool.callout.heading, 120),
        body: stringField(draft.body, tool.callout.body, 360),
        primaryLabel: stringField(
          draft.primaryLabel,
          tool.callout.primaryLabel,
          80,
        ),
        primaryUrl: httpsUrlField(draft.primaryUrl, tool.callout.primaryUrl),
        secondaryLabel: stringField(
          draft.secondaryLabel,
          tool.callout.secondaryLabel,
          80,
        ),
        secondaryUrl: httpsUrlField(
          draft.secondaryUrl,
          tool.callout.secondaryUrl,
        ),
      },
    });
  },
});
