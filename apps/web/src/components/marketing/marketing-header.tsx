/**
 * Marketing site sticky header: brand wordmark + sign-in / start CTAs.
 *
 * Server-rendered. A skip link lets keyboard and screen-reader users jump
 * straight to the main content past the nav.
 */

import Link from "next/link";

import { Button } from "@repo/ui/primitives/button";

import { BatMark } from "./bat-mark";
import { APP_LOGIN_URL, APP_SIGNUP_URL } from "./marketing-links";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 text-foreground no-underline"
          aria-label="BlogBat home"
        >
          <BatMark className="size-7 text-primary transition-transform duration-200 group-hover:-translate-y-0.5" />
          <span className="text-lg font-semibold tracking-tight">BlogBat</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={APP_LOGIN_URL}>Sign In</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={APP_SIGNUP_URL}>Start Your Blog</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
