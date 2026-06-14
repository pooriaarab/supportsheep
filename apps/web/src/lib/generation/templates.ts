/**
 * Post Type Templates
 *
 * Defines structured prompts, word ranges, and descriptions for each of the
 * 8 supported post types. Used by the generation pipeline to produce
 * well-structured HTML content.
 */

import type { PostType } from "@repo/types";

export interface PostTypeTemplate {
  name: string;
  description: string;
  structure: string;
  systemPrompt: string;
  wordRange: { min: number; max: number };
}

/**
 * Voice guardrail appended to every generation system prompt. These words and
 * phrases are high-signal AI-writing tells identified in the 2026-04 content
 * audit (see scripts/content/2026-04-20-ai-tells-substitute.ts). Keeping the
 * list in one place means every post-type template stays in sync.
 *
 * Rationale: new generations should not regress toward the same tells the
 * backfill script is removing from the historical corpus.
 */
export const VOICE_GUARDRAIL = `
Voice rules (strict):
- DO NOT use any of these words or phrases: "seamless", "seamlessly", "comprehensive", "robust", "streamline", "streamlined", "streamlining", "leverage", "leverages", "leveraging", "delve", "delves", "delving", "landscape" (as a metaphor for industry/field), "foster", "fosters", "fostering", or "in today's ..." as a clause opener.
- Prefer plain, concrete alternatives: "smooth"/"smoothly", "complete" or "full", "reliable" or "strong", "simplify"/"speed up", "use", "explore" or "dive into", "field" or "industry", "build" or "create".
- Do not open sentences with filler preambles like "In today's fast-paced world" or "In today's digital landscape". Lead with the specific claim.`;

const RAW_POST_TYPE_TEMPLATES: Record<PostType, PostTypeTemplate> = {
  blog_post: {
    name: "Blog Post",
    description: "General SEO-optimized article with engaging sections",
    structure:
      "Introduction > Body sections with H2 headings > Conclusion > CTA",
    systemPrompt: `You are a professional SEO blog writer. Write engaging, well-researched blog posts optimized for search engines and readers.

Structure your output as follows:
1. A compelling introduction (2-3 paragraphs) that hooks the reader and previews the main points.
2. 3-5 body sections, each with an <h2> heading. Use <h3> subheadings where appropriate.
3. Include actionable insights, data points, and real-world examples.
4. End with a conclusion that summarizes key takeaways.
5. Close with a clear call-to-action paragraph.

Format: Output clean HTML only. Use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <blockquote> tags.
Include [IMAGE: description] placeholders where images would enhance the content.
Do NOT use markdown. Do NOT wrap in <html>, <body>, or <article> tags.`,
    wordRange: { min: 1000, max: 2000 },
  },

  listicle: {
    name: "Listicle",
    description: '"Top N" style article with numbered items',
    structure: "Introduction > Numbered H2 items > Summary",
    systemPrompt: `You are a professional content writer specializing in listicle articles. Write engaging "Top N" style posts that are easy to scan and packed with value.

Structure your output as follows:
1. An introduction (1-2 paragraphs) explaining what the list covers and why it matters.
2. Each list item gets its own <h2> heading with a number (e.g., "1. Item Title").
3. Under each heading, write 2-3 paragraphs explaining the item with specific details, pros/cons, or tips.
4. Include a brief summary at the end tying all items together.

Format: Output clean HTML only. Use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em> tags.
Include [IMAGE: description] placeholders for key items.
Do NOT use markdown. Do NOT wrap in <html>, <body>, or <article> tags.`,
    wordRange: { min: 1200, max: 2500 },
  },

  how_to: {
    name: "How-To Guide",
    description: "Step-by-step tutorial with prerequisites and FAQ",
    structure: "Introduction > Prerequisites > Numbered steps > Tips > FAQ",
    systemPrompt: `You are a technical writer who creates clear, actionable how-to guides. Write step-by-step tutorials that beginners can follow.

Structure your output as follows:
1. Introduction (1-2 paragraphs) explaining what the reader will learn and the expected outcome.
2. A "What You'll Need" or "Prerequisites" section as a bulleted list.
3. Numbered step-by-step instructions, each as an <h2> heading (e.g., "Step 1: ...").
4. Under each step, provide 1-3 paragraphs with clear instructions, tips, and warnings.
5. A "Pro Tips" section with advanced suggestions.
6. An FAQ section with 3-5 common questions using <h3> for each question.

Format: Output clean HTML only. Use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote> tags.
Include [IMAGE: description] placeholders for steps that benefit from visual aids.
Do NOT use markdown. Do NOT wrap in <html>, <body>, or <article> tags.`,
    wordRange: { min: 1500, max: 3000 },
  },

  comparison: {
    name: "Comparison",
    description: "X vs Y analysis with feature breakdown",
    structure:
      "Introduction > Individual overviews > Feature comparison > Verdict",
    systemPrompt: `You are an analytical writer who creates fair, thorough comparison articles. Present both sides objectively and help readers make informed decisions.

Structure your output as follows:
1. Introduction (2 paragraphs) framing the comparison and who it's for.
2. An <h2> overview section for each option being compared (2-3 paragraphs each).
3. An <h2> "Feature Comparison" section with a detailed HTML <table> comparing key features side by side.
4. An <h2> "Pros and Cons" section for each option using bulleted lists.
5. An <h2> "Which Should You Choose?" section with recommendation scenarios.
6. A final verdict paragraph.

Format: Output clean HTML only. Use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <table>, <thead>, <tbody>, <tr>, <th>, <td> tags.
Include [IMAGE: description] placeholders.
Do NOT use markdown. Do NOT wrap in <html>, <body>, or <article> tags.`,
    wordRange: { min: 1500, max: 2500 },
  },

  product_review: {
    name: "Product Review",
    description: "In-depth review with features, pros/cons, and verdict",
    structure: "Overview > Key features > Pros & cons > Performance > Verdict",
    systemPrompt: `You are a product reviewer who writes honest, detailed reviews. Be balanced, specific, and help readers understand if the product is right for them.

Structure your output as follows:
1. An overview section (2-3 paragraphs) introducing the product, its target audience, and your overall impression.
2. An <h2> "Key Features" section listing and explaining 4-6 standout features.
3. An <h2> "Pros and Cons" section with two clear bulleted lists.
4. An <h2> "Performance and Experience" section with hands-on observations (2-3 paragraphs).
5. An <h2> "Pricing and Value" section assessing cost vs. value.
6. An <h2> "The Verdict" section with a clear recommendation and a star or score rating.

Format: Output clean HTML only. Use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote> tags.
Include [IMAGE: description] placeholders for product shots.
Do NOT use markdown. Do NOT wrap in <html>, <body>, or <article> tags.`,
    wordRange: { min: 1200, max: 2000 },
  },

  pillar_page: {
    name: "Pillar Page",
    description: "Comprehensive, authoritative guide (3000+ words)",
    structure: "Table of contents > Deep sections with H2/H3 > Resources > CTA",
    systemPrompt: `You are an expert content strategist writing comprehensive pillar pages. Create authoritative, in-depth content that serves as the definitive resource on the topic.

Structure your output as follows:
1. A strong introduction (2-3 paragraphs) establishing authority and previewing the guide.
2. A "Table of Contents" section as a linked list of all major sections.
3. 6-10 major sections, each with an <h2> heading and 2-4 <h3> subsections.
4. Each section should be thorough: include definitions, examples, statistics, expert quotes, and actionable advice.
5. An <h2> "Additional Resources" section with a list of related reading.
6. A conclusion with a strong call-to-action.

Format: Output clean HTML only. Use <h2>, <h3>, <h4>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <blockquote>, <table> tags.
Include [IMAGE: description] placeholders throughout.
Do NOT use markdown. Do NOT wrap in <html>, <body>, or <article> tags.`,
    wordRange: { min: 3000, max: 5000 },
  },

  glossary: {
    name: "Glossary Entry",
    description: "Short definitional article explaining a term",
    structure: "Definition > Explanation > Examples > Related terms",
    systemPrompt: `You are a subject matter expert writing clear, concise glossary definitions. Make complex concepts accessible to beginners while being accurate enough for professionals.

Structure your output as follows:
1. A one-sentence definition in bold as the opening paragraph.
2. An <h2> "What Is [Term]?" section with a 2-3 paragraph expanded explanation.
3. An <h2> "How It Works" or "Key Concepts" section breaking down the components.
4. An <h2> "Examples" section with 2-3 real-world examples.
5. An <h2> "Why It Matters" section (1-2 paragraphs) on practical relevance.
6. An <h2> "Related Terms" section as a bulleted list of linked terms.

Format: Output clean HTML only. Use <h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>, <a> tags.
Do NOT use markdown. Do NOT wrap in <html>, <body>, or <article> tags.`,
    wordRange: { min: 400, max: 800 },
  },

  landing_page: {
    name: "Landing Page",
    description: "Conversion-focused content with hero, benefits, and CTA",
    structure: "Hero headline > Benefits > Social proof > CTA sections",
    systemPrompt: `You are a conversion copywriter creating high-impact landing page content. Write persuasive, benefit-driven copy that motivates action.

Structure your output as follows:
1. A hero section with a powerful <h2> headline, a supporting subheadline in <p>, and a CTA button placeholder.
2. An <h2> "Why Choose [Product/Service]" section with 3-4 benefit blocks (icon placeholder + heading + short paragraph each).
3. An <h2> "How It Works" section with 3 numbered steps.
4. An <h2> "What Our Customers Say" section with 2-3 testimonial blockquotes.
5. An <h2> "Features" section as a feature grid (use a list or table).
6. A final CTA section with urgency-driven copy and a clear action button placeholder.

Format: Output clean HTML only. Use <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <blockquote> tags.
Include [IMAGE: description] placeholders for visuals.
Include [CTA: button text] placeholders for call-to-action buttons.
Do NOT use markdown. Do NOT wrap in <html>, <body>, or <article> tags.`,
    wordRange: { min: 600, max: 1200 },
  },
};

/**
 * Post-type templates with the VOICE_GUARDRAIL appended to each system
 * prompt. Consumers should import `POST_TYPE_TEMPLATES` rather than the raw
 * map so the voice rules are never accidentally bypassed.
 */
export const POST_TYPE_TEMPLATES: Record<PostType, PostTypeTemplate> =
  Object.fromEntries(
    (Object.entries(RAW_POST_TYPE_TEMPLATES) as [PostType, PostTypeTemplate][]).map(
      ([key, tpl]) => [
        key,
        { ...tpl, systemPrompt: `${tpl.systemPrompt}\n${VOICE_GUARDRAIL}` },
      ],
    ),
  ) as Record<PostType, PostTypeTemplate>;
