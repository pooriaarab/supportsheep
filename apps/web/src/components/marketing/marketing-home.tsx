/**
 * Supportsheep marketing landing page (served at the apex / `www`).
 *
 * A polished, characterful, server-rendered landing built entirely on the
 * design system: semantic color tokens (light + dark), the shared `Button`
 * primitive, and the sheep brand mark. Animation is CSS-only (transform/opacity,
 * reduced-motion-gated); the only interactive surface is the native
 * `<details>` FAQ, so the whole page stays static chrome plus links into the
 * dashboard app at `app.supportsheep.com`.
 *
 * Composed from focused section components under `components/marketing/`.
 */

import Link from "next/link";
import { MarketingHeader } from "./marketing-header";
import { MarketingFooter } from "./marketing-footer";
import { ArrowRight, Github, Mic, MessageCircle, FileText } from "lucide-react";

export function MarketingHome() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>

      <MarketingHeader />

      <main id="main" className="flex-1 min-h-screen bg-background pb-20">
        {/* Ferndesk-style Minimalist Hero */}
        <section className="pt-32 pb-16 text-center px-4 max-w-4xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Introducing GitHub Auto-Docs
          </div>
          
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-foreground mb-6 leading-tight">
            The AI-native help center that <span className="text-primary">updates itself.</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Never write another support article. Supportsheep connects to your GitHub, drafts docs from merged PRs, and serves your customers instantly via Voice and Chat.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/onboarding" className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:bg-primary/90 transition shadow-sm flex items-center gap-2">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="#features" className="bg-secondary text-secondary-foreground px-6 py-3 rounded-md font-medium hover:bg-secondary/80 transition">
              See how it works
            </Link>
          </div>
        </section>

        {/* Workflow Graphic Section */}
        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto bg-card border border-border rounded-2xl p-8 sm:p-12 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left flex-1">
              <div className="bg-muted w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto md:mx-0">
                <Github className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="font-semibold text-lg">1. Merge a PR</h3>
              <p className="text-muted-foreground text-sm mt-2">Push code like you normally do.</p>
            </div>
            
            <div className="hidden md:flex text-muted-foreground">
              <ArrowRight className="w-8 h-8" />
            </div>

            <div className="text-center md:text-left flex-1">
              <div className="bg-muted w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto md:mx-0">
                <FileText className="w-6 h-6 text-foreground" />
              </div>
              <h3 className="font-semibold text-lg">2. AI Drafts Docs</h3>
              <p className="text-muted-foreground text-sm mt-2">Supportsheep writes the user guide.</p>
            </div>

            <div className="hidden md:flex text-muted-foreground">
              <ArrowRight className="w-8 h-8" />
            </div>

            <div className="text-center md:text-left flex-1">
              <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4 mx-auto md:mx-0">
                <Mic className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">3. Customers Ask</h3>
              <p className="text-muted-foreground text-sm mt-2">Real-time Voice & Chat answers them instantly.</p>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section id="features" className="py-20">
          <div className="max-w-5xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold">Everything you need to scale support</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
                <Mic className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Real-time Voice AI</h3>
                <p className="text-muted-foreground">Embed a voice widget on your site so customers can literally talk to your docs.</p>
              </div>
              <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
                <MessageCircle className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">Chatbot Widget</h3>
                <p className="text-muted-foreground">A sleek, embeddable chat interface that grounds answers strictly in your knowledge base.</p>
              </div>
              <div className="bg-card p-8 rounded-2xl border border-border shadow-sm">
                <Github className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-xl font-bold mb-2">GitHub Auto-Docs</h3>
                <p className="text-muted-foreground">Connect your repo and let Anthropic Claude turn your technical PRs into human-readable guides.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
