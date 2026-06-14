/**
 * Closing call to action. A token-tinted dusk wash and the bat mark send the
 * reader off with the brand, then point them straight at sign-up.
 */

import Link from "next/link";

import { Button } from "@repo/ui/primitives/button";

import { BatMark } from "./bat-mark";
import { APP_SIGNUP_URL } from "./marketing-links";

export function FinalCta() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="relative isolate overflow-hidden border-t border-border bg-muted/40"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="mkt-aurora mkt-aurora-a absolute left-1/2 top-0 size-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-primary),transparent)] opacity-15 blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6">
        <BatMark className="size-14 text-primary" />
        <h2
          id="final-cta-heading"
          className="text-balance text-3xl font-bold tracking-tight sm:text-4xl"
        >
          Your Blog Is One Subdomain Away
        </h2>
        <p className="max-w-xl text-pretty text-muted-foreground">
          Claim your subdomain, write your first post with AI at your side, and
          publish to Cloudflare&rsquo;s edge — all in minutes.
        </p>
        <Button asChild size="lg">
          <Link href={APP_SIGNUP_URL}>Start Your Blog</Link>
        </Button>
      </div>
    </section>
  );
}
