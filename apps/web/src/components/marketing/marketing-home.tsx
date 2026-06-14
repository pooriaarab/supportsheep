/**
 * BlogBat marketing landing page (served at the apex / `www`).
 *
 * A polished, characterful, server-rendered landing built entirely on the
 * design system: semantic color tokens (light + dark), the shared `Button`
 * primitive, and the bat brand mark. Animation is CSS-only (transform/opacity,
 * reduced-motion-gated); the only interactive surface is the native
 * `<details>` FAQ, so the whole page stays static chrome plus links into the
 * dashboard app at `app.blogbat.com`.
 *
 * Composed from focused section components under `components/marketing/`.
 */

import { AgentsSection } from "./agents-section";
import { BuiltForBand } from "./built-for-band";
import { FeatureGrid } from "./feature-grid";
import { FinalCta } from "./final-cta";
import { HowItWorks } from "./how-it-works";
import { MarketingFaq } from "./marketing-faq";
import { MarketingFooter } from "./marketing-footer";
import { MarketingHeader } from "./marketing-header";
import { MarketingHero } from "./marketing-hero";

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

      <main id="main" className="flex-1">
        <MarketingHero />
        <FeatureGrid />
        <HowItWorks />
        <BuiltForBand />
        <AgentsSection />
        <MarketingFaq />
        <FinalCta />
      </main>

      <MarketingFooter />
    </div>
  );
}
