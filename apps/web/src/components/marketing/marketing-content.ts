/**
 * Static copy for the Supportsheep marketing homepage.
 *
 * Centralizing the feature/step/FAQ data keeps the page components small and
 * lets a tiny unit test assert the data shape (e.g. every FAQ has a non-empty
 * question and answer). Icons are referenced by lucide component so the page
 * stays fully server-rendered.
 */

import {
  Bot,
  Globe,
  KeyRound,
  PenLine,
  Rocket,
  Search,
  Sparkles,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

export interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const FEATURES: readonly Feature[] = [
  {
    icon: Globe,
    title: "Your Subdomain or Your Domain",
    description:
      "Launch at yourname.supportsheep.com the moment you sign up, then point a custom domain at it whenever you are ready.",
  },
  {
    icon: Sparkles,
    title: "AI-Assisted Writing",
    description:
      "Outline, draft, and sharpen posts with built-in AI generation and a writing-skills pipeline that learns your voice.",
  },
  {
    icon: Zap,
    title: "Fast on the Edge",
    description:
      "Served from Cloudflare’s edge, your knowledge base loads quickly for readers anywhere — no cold starts, no waiting.",
  },
  {
    icon: KeyRound,
    title: "Bring Your Own AI Key",
    description:
      "Connect your own Anthropic, OpenAI, or Google key and write with the models you already pay for.",
  },
  {
    icon: Search,
    title: "SEO in the Box",
    description:
      "Per-post metadata, structured data, sitemaps, and RSS ship by default. No plugins to wire up, nothing to forget.",
  },
  {
    icon: Users,
    title: "Multi-Author",
    description:
      "Invite teammates to draft and publish together under one blog, with shared categories and a single voice.",
  },
] as const;

export interface Step {
  icon: LucideIcon;
  step: string;
  title: string;
  description: string;
}

export const STEPS: readonly Step[] = [
  {
    icon: Globe,
    step: "01",
    title: "Claim Your Subdomain",
    description:
      "Pick a name and you are live at yourname.supportsheep.com in seconds — no DNS, no deploy step, no setup wizard.",
  },
  {
    icon: PenLine,
    step: "02",
    title: "Write With AI",
    description:
      "Draft with the built-in editor and AI assistance. Bring your own model key, then refine until it sounds like you.",
  },
  {
    icon: Rocket,
    step: "03",
    title: "Publish to the Edge",
    description:
      "Hit publish and your post ships to Cloudflare’s edge — SEO-ready, fast everywhere, and ready to share.",
  },
] as const;

export interface Audience {
  icon: LucideIcon;
  title: string;
  description: string;
}

export const AUDIENCES: readonly Audience[] = [
  {
    icon: PenLine,
    title: "Writers",
    description:
      "A calm, focused place to publish — without fighting themes, plugins, or a server.",
  },
  {
    icon: Rocket,
    title: "Indie Hackers",
    description:
      "Stand up a product blog or changelog on your own domain in an afternoon.",
  },
  {
    icon: Bot,
    title: "Agents",
    description:
      "Draft and publish programmatically over the Supportsheep API and MCP server.",
  },
] as const;

export interface Faq {
  question: string;
  answer: string;
}

export const FAQS: readonly Faq[] = [
  {
    question: "Can I use my own custom domain?",
    answer:
      "Yes. Every blog starts on a free yourname.supportsheep.com subdomain, and you can point a custom domain at it whenever you like — your subdomain keeps working too.",
  },
  {
    question: "Do I need my own AI key?",
    answer:
      "You can bring your own Anthropic, OpenAI, or Google key and write with the models you already pay for. The AI-assisted editor works with whichever provider you connect.",
  },
  {
    question: "Is the free subdomain really free?",
    answer:
      "Publishing on a yourname.supportsheep.com subdomain costs nothing to start. You only reach for a custom domain or larger limits when your knowledge base grows into them.",
  },
  {
    question: "Is SEO handled for me?",
    answer:
      "Per-post metadata, structured data, an XML sitemap, and an RSS feed ship by default — no plugins to install. You write the post; the SEO scaffolding comes with it.",
  },
  {
    question: "Can I write with a team?",
    answer:
      "Yes. Invite teammates to draft and publish together under one blog, with shared categories so everything stays organized under a single voice.",
  },
  {
    question: "Can AI agents publish to My Support Hub?",
    answer:
      "Agents can sign up with an invite code to mint an API key and publish programmatically over the Supportsheep API and MCP server — the same blog, driven by code.",
  },
] as const;
