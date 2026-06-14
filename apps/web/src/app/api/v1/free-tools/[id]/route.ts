import { NextResponse } from "next/server";
import { z } from "zod";
import { createApiHandler } from "@/lib/create-api-handler";
import {
  DuplicateFreeToolSlugError,
  getFreeToolById,
  patchFreeTool,
} from "@/lib/free-tools/repository";
import type { FreeToolAdminUpdateInput } from "@/lib/free-tools/types";

const httpsUrlSchema = z
  .string()
  .max(500)
  .url()
  .refine(
    (value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "URL must use https://" },
  );

const calloutSchema = z.object({
  enabled: z.boolean().optional(),
  heading: z.string().max(160).optional(),
  body: z.string().max(500).optional(),
  primaryLabel: z.string().max(80).optional(),
  primaryUrl: httpsUrlSchema.optional(),
  secondaryLabel: z.string().max(80).optional(),
  secondaryUrl: httpsUrlSchema.or(z.literal("")).optional(),
  utm: z
    .object({
      source: z.string().max(80).optional(),
      medium: z.string().max(80).optional(),
      campaign: z.string().max(120).optional(),
      content: z.string().max(120).optional(),
      term: z.string().max(120).optional(),
    })
    .partial()
    .optional(),
});

const freeToolPatchSchema = z
  .object({
    slug: z.string().max(120).optional(),
    title: z.string().min(1).max(160).optional(),
    metaTitle: z.string().max(180).optional(),
    metaDescription: z.string().max(320).optional(),
    intro: z.string().max(2000).optional(),
    faq: z
      .array(
        z.object({
          question: z.string().min(1).max(220),
          answer: z.string().min(1).max(1200),
        }),
      )
      .max(20)
      .optional(),
    cta: z
      .object({
        label: z.string().max(80),
        url: httpsUrlSchema,
      })
      .optional(),
    enabled: z.boolean().optional(),
    appearance: z
      .object({
        layout: z.enum(["compact", "editorial", "utility"]),
        accent: z.enum(["default", "blue", "green", "purple"]),
      })
      .partial()
      .optional(),
    ai: z
      .object({
        enabled: z.boolean().optional(),
        provider: z.enum(["claude", "gpt", "gemini"]).optional(),
        model: z.string().min(1).max(120).optional(),
        dailyLimit: z.number().int().min(1).max(1000).optional(),
        maxInputChars: z.number().int().min(1).max(20000).optional(),
        maxOutputTokens: z.number().int().min(1).max(4000).optional(),
      })
      .partial()
      .optional(),
    seo: z
      .object({
        indexable: z.boolean().optional(),
        canonicalPath: z.string().startsWith("/tools/").optional(),
        includeInToolsIndex: z.boolean().optional(),
        includeInSitemap: z.boolean().optional(),
      })
      .partial()
      .optional(),
    callout: calloutSchema.partial().optional(),
  })
  .strict();

export const GET = createApiHandler<unknown, { id: string }>({
  auth: "user",
  handler: async ({ params, blogId }) => {
    const tool = await getFreeToolById(params.id, blogId);
    if (!tool) {
      return NextResponse.json(
        { error: "Free tool not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: tool });
  },
});

export const PATCH = createApiHandler<
  z.infer<typeof freeToolPatchSchema>,
  { id: string }
>({
  auth: "user",
  input: freeToolPatchSchema,
  handler: async ({ body, params, blogId }) => {
    try {
      await patchFreeTool(params.id, body as FreeToolAdminUpdateInput, blogId);
    } catch (error) {
      if (error instanceof DuplicateFreeToolSlugError) {
        return NextResponse.json(
          { error: "Free tool slug already exists" },
          { status: 409 },
        );
      }
      throw error;
    }

    const tool = await getFreeToolById(params.id, blogId);
    if (!tool) {
      return NextResponse.json(
        { error: "Free tool not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: tool });
  },
});
