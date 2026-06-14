/**
 * Marketing hero — the page's centerpiece.
 *
 * Visual interest comes from a layered "dusk" backdrop: two soft aurora blobs
 * (token-tinted radial gradients) that drift behind a large bat mark which
 * floats and banks gently, like a bat working the dusk air. All motion is
 * CSS-only, animates transform/opacity exclusively, and is gated behind
 * `prefers-reduced-motion` in globals.css — reduced-motion visitors see the
 * same composition, held still.
 *
 * Server-rendered. Keeps the {slug}.supportsheep.com value prop and the existing
 * sign-up / sign-in CTAs.
 */

import Link from "next/link";

import { Button } from "@repo/ui/primitives/button";

import { BAT_PATH_D, BatMark } from "./bat-mark";
import { APP_LOGIN_URL, APP_SIGNUP_URL } from "./marketing-links";

/**
 * The hero's animated bat. Reuses the shared bat geometry but wraps the path in
 * a `<g>` so the float/rotate pivots about the mark's own center
 * (`transform-box: fill-box`). Decorative — hidden from assistive tech.
 */
function FloatingBat({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <g className="mkt-bat-float">
        <path fill="currentColor" d={BAT_PATH_D} />
      </g>
    </svg>
  );
}

export function MarketingHero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Dusk aurora backdrop — token-tinted, drifting, decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="mkt-aurora mkt-aurora-a absolute -top-24 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-primary),transparent)] opacity-15 blur-3xl" />
        <div className="mkt-aurora mkt-aurora-b absolute -top-10 right-[-8rem] size-[34rem] rounded-full bg-[radial-gradient(closest-side,var(--color-accent),transparent)] opacity-20 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32">
        <FloatingBat className="mkt-reveal size-20 text-primary sm:size-24" />

        <span className="mkt-reveal inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-sm text-muted-foreground backdrop-blur [animation-delay:60ms]">
          <BatMark className="size-4 text-primary" />
          Multitenant Blogging on Cloudflare
        </span>

        <h1 className="mkt-reveal text-balance text-4xl font-bold tracking-tight [animation-delay:120ms] sm:text-5xl md:text-6xl">
          Blogs that fly{" "}
          <span className="bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
            after dark
          </span>
          .
          <br className="hidden sm:block" /> Live at{" "}
          <span className="text-primary">yourname.supportsheep.com</span>
        </h1>

        <p className="mkt-reveal max-w-2xl text-pretty text-lg text-muted-foreground [animation-delay:180ms]">
          Supportsheep is a fast, multitenant blog platform on Cloudflare&rsquo;s
          edge. Claim a free subdomain or bring your own domain, write with AI
          at your side, and ship SEO-ready posts that load everywhere.
        </p>

        <div className="mkt-reveal flex flex-col gap-3 [animation-delay:240ms] sm:flex-row">
          <Button asChild size="lg">
            <Link href={APP_SIGNUP_URL}>Start Your Blog</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href={APP_LOGIN_URL}>Sign In</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
