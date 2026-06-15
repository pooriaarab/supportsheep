#!/usr/bin/env node
/**
 * Batch content generator for /for/[vertical] programmatic pages.
 * Uses Tabstack /v1/research for verified citations + Anthropic Claude for content.
 * All Supportsheep claims grounded in .claude/context/supportsheep-product.md.
 *
 * Run: bun --conditions react-server scripts/content-pipeline/generate-for-pages.ts
 * Options:
 *   --dry-run           Print what would be generated, don't write to Firestore
 *   --slug=foo          Only generate one vertical (by slug)
 *   --skip-existing     Skip docs that already exist in Firestore
 *   --manifest=<file>   Manifest JSON file (relative to scripts/content-pipeline/), default: verticals.json
 */

import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { FieldValue } from "firebase-admin/firestore";
import { collections } from "@/lib/db/firebase-admin";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ---------------------------------------------------------------------------
// Word count — strips HTML tags and markdown syntax to count prose words only,
// matching the same logic used in the thin-content guard at render time.
// ---------------------------------------------------------------------------
function countWords(text: string): number {
  const stripped = text
    .replace(/<[^>]*>/g, " ")
    .replace(/[#*_`~>\[\]()!|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return 0;
  return stripped.split(" ").filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Locate supportsheep-product.md — runs upward from cwd until the .claude/context dir
// is found, so the script works whether cwd is apps/web or the repo root.
// ---------------------------------------------------------------------------
function findSupportsheepProductMd(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, ".claude", "context", "supportsheep-product.md");
    try {
      readFileSync(candidate); // throws if not found
      return candidate;
    } catch {
      const parent = resolve(dir, "..");
      if (parent === dir) break;
      dir = parent;
    }
  }
  throw new Error("Cannot locate .claude/context/supportsheep-product.md — run from within the repo");
}

// ---------------------------------------------------------------------------
// Tabstack research — returns markdown report + cited pages list.
// ---------------------------------------------------------------------------
async function tabstackResearch(
  query: string,
  apiKey: string,
): Promise<{ report: string; citedPages: Array<{ url: string; title: string }> }> {
  const response = await fetch("https://api.tabstack.ai/v1/research", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Tabstack error: ${response.status} ${await response.text().catch(() => "")}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
  }

  // Parse SSE blocks separated by double newlines; find the `complete` event.
  const blocks = buffer.split("\n\n").filter((b) => b.trim());
  for (const block of blocks) {
    const lines = block.split("\n");
    const linesByPrefix = new Map<string, string>();
    for (const line of lines) {
      if (line.startsWith("event: ") && !linesByPrefix.has("event")) {
        linesByPrefix.set("event", line);
      } else if (line.startsWith("data: ") && !linesByPrefix.has("data")) {
        linesByPrefix.set("data", line);
      }
    }
    const eventLine = linesByPrefix.get("event");
    const dataLine = linesByPrefix.get("data");
    if (eventLine?.includes("complete") && dataLine) {
      const parsed = JSON.parse(dataLine.replace(/^data: /, ""));
      return {
        report: parsed.report ?? "",
        citedPages: parsed.metadata?.citedPages ?? [],
      };
    }
  }

  throw new Error("Tabstack: no complete event received in SSE stream");
}

// ---------------------------------------------------------------------------
// Content generation — calls Claude with research context + Supportsheep grounding.
// ---------------------------------------------------------------------------
async function generatePageContent(
  vertical: { slug: string; label: string; industry: string },
  research: { report: string; citedPages: Array<{ url: string; title: string }> },
  supportsheepContext: string,
  anthropicClient: Anthropic,
): Promise<{
  uniqueContent: string;
  metaDescription: string;
  title: string;
  faqs: Array<{ question: string; answer: string }>;
  wordCount: number;
}> {
  const citationList = research.citedPages
    .map((p, i) => `[${i + 1}] ${p.title} — ${p.url}`)
    .join("\n");

  const systemPrompt = `You write high-quality programmatic SEO content for supportsheep.com, the blog of Supportsheep (an AI-powered platform for solopreneurs and SMBs).

SUPPORTSHEEP PRODUCT CONTEXT — ground all Supportsheep claims here:
${supportsheepContext}

CORE RULES:
- NEVER claim Supportsheep has a free-form AI writing assistant across the editor
- NEVER claim Supportsheep has native booking (it links to external calendar tools)
- NEVER claim Supportsheep generates AI images (Unsplash default, Pexels for Pro+)
- NEVER claim Supportsheep has a BAA (unsuitable for PHI-collecting forms)
- Use {{supportsheep.pro.yearly}} for $20/mo, {{supportsheep.pro.monthly}} for $25/mo, {{supportsheep.free.monthly}} for $0, {{supportsheep.grow.yearly}} for $90/mo
- Always be honest about Supportsheep's limitations for the specific vertical
- Voice: practical, honest, SMB/solopreneur tone. Respect the reader's time.`;

  const userPrompt = `Write a Tier-3 programmatic SEO page for Supportsheep: "Website builder for ${vertical.label}".

TARGET READER: A ${vertical.label.toLowerCase()} (solo practitioner or 1-5 person practice) who is evaluating website builders. They're not technical. They care about: getting clients, looking professional, not wasting time, and industry-specific concerns.

RESEARCH (from Tabstack — use these for citations, don't fabricate others):
${research.report}

SOURCES (cite inline in content using markdown links):
${citationList}

REQUIRED STRUCTURE (1800-2500 words total):

## TL;DR
3-5 sentences. Who this is for. What they'll learn. Bottom line on Supportsheep for this vertical.

## Why [${vertical.label}] websites have specific challenges
1-2 paragraphs specific to this industry. What makes their website needs different from generic SMBs.

## What a ${vertical.label.toLowerCase()} website needs in 2026
<table> with must-haves, nice-to-haves, and vertical-specific requirements (licensing display, compliance, etc.)

## [Industry-specific concern] (pick the most important: HIPAA for health, licensing for trades, portfolio for creative, etc.)
1-2 focused paragraphs. Be honest about limitations.

## Why Supportsheep works for solo ${vertical.label.toLowerCase()} practices
Honest pitch grounded in Supportsheep's real features. Reference AI-seeded section creation, onboarding speed, pricing (use {{supportsheep.pro.yearly}} etc.). Be clear about what Supportsheep DOESN'T do for this vertical if relevant.

## Comparison with alternatives
<table> comparing Supportsheep vs 2-3 relevant alternatives (Wix, Squarespace, or vertical-specific tools if they exist). One honest row per feature.

## Getting started: a 5-step checklist
Use a proper markdown ordered list (each step on its own line):
1. Step one with detail...
2. Step two...
3. Step three...
4. Step four...
5. Step five...

## FAQ
Include in response as a JSON array at the END of your response, separated by ---FAQ_JSON---:
[{"question": "...", "answer": "..."}, ...]
Include 6-8 Q&As. Include at least one about pricing (use {{supportsheep.pro.yearly}} etc.) and one about any industry-specific compliance concern.

IMAGES: Include 2 Unsplash images using verified URLs in format:
<img src="https://images.unsplash.com/photo-[ID]?w=1200&auto=format&fit=crop" alt="[descriptive alt]" />
Use real Unsplash photo IDs for ${vertical.industry} topics.

YOUTUBE: Include one <iframe src="https://www.youtube-nocookie.com/embed/[REAL_VIDEO_ID]" title="[title]" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen width="560" height="315"></iframe> for a relevant video. Use a real YouTube video ID about ${vertical.label.toLowerCase()} websites or marketing.`;

  const message = await anthropicClient.messages.create({
    model: "claude-opus-4-20250514",
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const rawContent =
    message.content[0].type === "text" ? message.content[0].text : "";

  // Split FAQ JSON from body content
  const [bodyPart, faqPart] = rawContent.split("---FAQ_JSON---");
  const uniqueContent = (bodyPart ?? rawContent).trim();

  let faqs: Array<{ question: string; answer: string }> = [];
  if (faqPart) {
    try {
      faqs = JSON.parse(faqPart.trim());
    } catch {
      console.warn(`  [${vertical.slug}] FAQ JSON parse failed — storing empty faqs`);
      faqs = [];
    }
  } else {
    console.warn(`  [${vertical.slug}] No ---FAQ_JSON--- separator found — storing empty faqs`);
  }

  const wordCount = countWords(uniqueContent);
  const title = `Supportsheep for ${vertical.label}`;
  const metaDescription = `Build a professional ${vertical.label.toLowerCase()} website with Supportsheep. A practical guide to features, compliance considerations, local SEO, and honest alternatives.`.slice(0, 160);

  return { uniqueContent, metaDescription, title, faqs, wordCount };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const isDryRun = process.argv.includes("--dry-run");
  const slugFilter = process.argv
    .find((a) => a.startsWith("--slug="))
    ?.split("=")[1];
  const skipExisting = process.argv.includes("--skip-existing");

  const tabstackApiKey = process.env.TABSTACK_API_KEY ?? "";
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? "";

  if (!tabstackApiKey) throw new Error("TABSTACK_API_KEY is not set");
  if (!anthropicApiKey) throw new Error("ANTHROPIC_API_KEY is not set");

  const anthropicClient = new Anthropic({ apiKey: anthropicApiKey });

  // Load Supportsheep product context (grounding for all content)
  const supportsheepContextPath = findSupportsheepProductMd();
  const supportsheepContext = readFileSync(supportsheepContextPath, "utf-8");
  console.info(`Supportsheep context loaded from: ${supportsheepContextPath}`);

  // Load verticals manifest (--manifest=<file> relative to scripts/content-pipeline/)
  const manifestFile = process.argv.find((a) => a.startsWith("--manifest="))?.split("=")[1] ?? "verticals.json";
  const verticalsPath = join(process.cwd(), "scripts", "content-pipeline", manifestFile);
  const allVerticals: Array<{ slug: string; label: string; industry: string }> =
    JSON.parse(readFileSync(verticalsPath, "utf-8"));

  const verticals = slugFilter
    ? allVerticals.filter((v) => v.slug === slugFilter)
    : allVerticals;

  if (verticals.length === 0) {
    throw new Error(
      slugFilter
        ? `No vertical found with slug "${slugFilter}"`
        : "verticals.json is empty",
    );
  }

  console.info(
    `Generating ${verticals.length} page(s) (dry-run: ${isDryRun}, skip-existing: ${skipExisting})`,
  );

  const results: Array<{
    slug: string;
    status: "written" | "skipped" | "dry-run" | "failed";
    wordCount?: number;
    faqCount?: number;
    citationCount?: number;
    error?: string;
  }> = [];

  for (const vertical of verticals) {
    console.info(`\n[${vertical.slug}] Starting...`);

    // Check if already exists when --skip-existing is active
    if (skipExisting && !isDryRun) {
      try {
        const existing = await collections.programmaticPages().doc(vertical.slug).get();
        if (existing.exists) {
          console.info(`[${vertical.slug}] Skipping (already exists in Firestore)`);
          results.push({ slug: vertical.slug, status: "skipped" });
          continue;
        }
      } catch (err) {
        console.warn(`[${vertical.slug}] Could not check existence: ${err}`);
      }
    }

    let research: { report: string; citedPages: Array<{ url: string; title: string }> };
    try {
      console.info(`[${vertical.slug}] Researching via Tabstack...`);
      research = await tabstackResearch(
        `${vertical.label} website requirements, features, and best practices for small practices in 2026. Include industry-specific compliance, local SEO, and client expectations.`,
        tabstackApiKey,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${vertical.slug}] Tabstack failed: ${message}`);
      results.push({ slug: vertical.slug, status: "failed", error: `tabstack: ${message}` });
      continue;
    }
    const citationCount = research.citedPages.length;
    console.info(`[${vertical.slug}] Got ${citationCount} source(s)`);

    let content: Awaited<ReturnType<typeof generatePageContent>>;
    let wordCount: number;
    let faqs: Awaited<ReturnType<typeof generatePageContent>>["faqs"];
    let faqCount: number;
    try {
      console.info(`[${vertical.slug}] Generating content via Claude...`);
      content = await generatePageContent(vertical, research, supportsheepContext, anthropicClient);
      wordCount = content.wordCount;
      faqs = content.faqs;
      faqCount = faqs.length;
      console.info(
        `[${vertical.slug}] ${wordCount} words, ${faqCount} FAQs, ${citationCount} citations`,
      );

      if (wordCount < 1500) {
        console.warn(
          `[${vertical.slug}] WARNING: only ${wordCount} words (below 1500-word Tier-3 floor)`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${vertical.slug}] Claude failed: ${message}`);
      results.push({ slug: vertical.slug, status: "failed", error: `claude: ${message}` });
      continue;
    }

    if (isDryRun) {
      console.info(
        `[${vertical.slug}] DRY RUN — would write: "${content.title}" (${wordCount} words, ${faqCount} FAQs)`,
      );
      results.push({
        slug: vertical.slug,
        status: "dry-run",
        wordCount,
        faqCount,
        citationCount,
      });
      continue;
    }

    // Write to Firestore
    try {
      const doc = {
        id: vertical.slug,
        collection: "for",
        variantKey: vertical.slug,
        variables: {} as Record<string, string>,
        title: content.title,
        metaDescription: content.metaDescription,
        uniqueContent: content.uniqueContent,
        wordCount,
        faqs,
        publishStatus: "noindex" as const,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await collections.programmaticPages().doc(vertical.slug).set(doc, { merge: true });
      console.info(`[${vertical.slug}] Written to Firestore`);
      results.push({
        slug: vertical.slug,
        status: "written",
        wordCount,
        faqCount,
        citationCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${vertical.slug}] Firestore write failed: ${message}`);
      results.push({ slug: vertical.slug, status: "failed", error: `firestore: ${message}` });
    }

    // Rate limit: 2s between pages to avoid API throttling
    if (verticals.indexOf(vertical) < verticals.length - 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // Summary
  console.info("\n=== SUMMARY ===");
  const written = results.filter((r) => r.status === "written");
  const skipped = results.filter((r) => r.status === "skipped");
  const dryRun = results.filter((r) => r.status === "dry-run");
  const failed = results.filter((r) => r.status === "failed");

  console.info(`Written:  ${written.length}`);
  console.info(`Skipped:  ${skipped.length}`);
  console.info(`Dry-run:  ${dryRun.length}`);
  console.info(`Failed:   ${failed.length}`);

  if (failed.length > 0) {
    console.info("\nFailed slugs:");
    for (const f of failed) {
      console.info(`  - ${f.slug}: ${f.error}`);
    }
  }

  if (written.length > 0 || dryRun.length > 0) {
    console.info("\nGenerated pages:");
    for (const r of [...written, ...dryRun]) {
      console.info(
        `  - ${r.slug}: ${r.wordCount} words, ${r.faqCount} FAQs, ${r.citationCount} citations`,
      );
    }
  }

  console.info("\nDone.");
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
