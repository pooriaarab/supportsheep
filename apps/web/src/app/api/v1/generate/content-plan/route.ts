/**
 * Content Plan Generation API
 *
 * GET  /api/v1/generate/content-plan?id=xxx -- Fetch a content plan by ID
 * GET  /api/v1/generate/content-plan         -- List all content plans
 * POST /api/v1/generate/content-plan         -- Generate a new content plan via AI
 */

import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/create-api-handler";
import { generateContentPlanSchema } from "@/lib/schemas";
import { generateContent } from "@/lib/ai/generate";
import type { AIProvider } from "@/lib/ai/providers";
import type { ContentPlanPost, PostType } from "@repo/types";
import { POST_TYPES } from "@repo/types";
import { createLogger } from "@/lib/logger";
import { VOICE_GUARDRAIL } from "@/lib/generation/templates";
import {
  createContentPlan,
  getContentPlan,
  listContentPlans,
} from "@/lib/content-plans/repository";

const log = createLogger("api:generate:content-plan");

/**
 * GET /api/v1/generate/content-plan?id=xxx
 * Fetch a single content plan by ID, or list all plans if no id provided.
 */
export const GET = createApiHandler({
  auth: "user",
  handler: async ({ request, blogId }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      // List all plans
      const plans = await listContentPlans(blogId);
      return NextResponse.json({ data: plans });
    }

    const plan = await getContentPlan(blogId, id);
    if (!plan) {
      return NextResponse.json(
        { error: "Content plan not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: plan });
  },
});

export const POST = createApiHandler({
  auth: "user",
  input: generateContentPlanSchema,
  audit: "generate_content_plan",
  handler: async ({ body, blogId }) => {
    const days = parseInt(body.duration);
    const provider = body.provider as AIProvider;

    // Generate the plan via AI
    const planJson = await generateContent({
      provider,
      systemPrompt: `You are a content strategist. Generate a blog content calendar as a JSON array.
Each item MUST have:
- "keyword": a specific, searchable keyword phrase (3-6 words)
- "postType": one of: ${POST_TYPES.join(", ")}

Output ONLY valid JSON. No markdown fences, no explanation. Just the array.
Example: [{"keyword": "best project management tools 2026", "postType": "listicle"}]
${VOICE_GUARDRAIL}`,
      userPrompt: `Create a ${days}-day content plan for the niche: "${body.niche}".
Generate exactly ${days} entries — one per day. Mix post types for variety.
Focus on keywords with strong search intent.`,
      temperature: 0.8,
      maxTokens: 4096,
    });

    // Parse the AI response
    let planItems: Array<{ keyword: string; postType: string }>;
    try {
      // Strip any markdown fences if the model adds them
      const cleaned = planJson
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      planItems = JSON.parse(cleaned);
    } catch {
      log.error("Failed to parse content plan JSON", {
        response: planJson.slice(0, 500),
      });
      return NextResponse.json(
        { error: "AI returned invalid plan format. Please try again." },
        { status: 502 },
      );
    }

    if (!Array.isArray(planItems) || planItems.length === 0) {
      return NextResponse.json(
        { error: "AI returned empty plan. Please try again." },
        { status: 502 },
      );
    }

    // Build scheduled posts
    const today = new Date();
    const posts: ContentPlanPost[] = planItems.slice(0, days).map((item, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() + i + 1);

      // Validate postType, default to blog_post
      const validType = POST_TYPES.includes(item.postType as PostType)
        ? (item.postType as PostType)
        : "blog_post";

      return {
        keyword: item.keyword || `${body.niche} topic ${i + 1}`,
        postType: validType,
        scheduledDate: date.toISOString().split("T")[0],
        status: "pending",
        articleSlug: null,
        contextTagId: body.contextTagId ?? "",
      };
    });

    // Save plan
    const plan = await createContentPlan(blogId, {
      name: `${body.niche} — ${days}-day plan`,
      status: "active",
      posts,
      provider,
    });

    return NextResponse.json(
      {
        id: plan.id,
        name: plan.name,
        postCount: posts.length,
      },
      { status: 201 },
    );
  },
});
