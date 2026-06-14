/**
 * Supportsheep marketing landing page (served at the apex / `www`).
 *
 * A polished, characterful, server-rendered landing built entirely on the
 * design system: semantic color tokens (light + dark), the shared `Button`
 * primitive, and the bat brand mark. Animation is CSS-only (transform/opacity,
 * reduced-motion-gated); the only interactive surface is the native
 * `<details>` FAQ, so the whole page stays static chrome plus links into the
 * dashboard app at `app.supportsheep.com`.
 *
 * Composed from focused section components under `components/marketing/`.
 */

import Link from "next/link";
import { MarketingHeader } from "./marketing-header";
import { MarketingFooter } from "./marketing-footer";

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

      <main id="main" className="flex-1 min-h-screen bg-background">
        {/* Hero Section */}
        <section className="py-20 text-center px-4">
          <h1 className="text-5xl font-extrabold tracking-tight text-foreground mb-6">
            The AI-native support platform with Real-time Voice
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            Give your customers instant answers via Chat and Voice. Supportsheep builds your knowledge base and serves it instantly.
          </p>
          <Link href="/onboarding" className="bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition">
            Start Free Trial
          </Link>
        </section>

        {/* Feature Grid */}
        <section className="py-20 bg-muted/30">
          <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border">
              <h3 className="text-lg font-bold mb-2">Real-time AI Voice 🌟</h3>
              <p className="text-muted-foreground">Customers can talk to your AI agent live, receiving instant audio answers.</p>
            </div>
            <div className="bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border">
              <h3 className="text-lg font-bold mb-2">Embeddable Chatbot</h3>
              <p className="text-muted-foreground">A powerful support widget that you can embed anywhere in your app.</p>
            </div>
            <div className="bg-card text-card-foreground p-6 rounded-xl shadow-sm border border-border">
              <h3 className="text-lg font-bold mb-2">Multitenant Custom Domains</h3>
              <p className="text-muted-foreground">Host your support docs on your own domain with full SSL.</p>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
