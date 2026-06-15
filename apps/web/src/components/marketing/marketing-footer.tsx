/**
 * Marketing site footer.
 *
 * Mirrors the public blog footer's dark brand surface, but for the apex
 * marketing site: the Supportsheep wordmark, a few product links, and a
 * "Powered by Supportsheep" credit. Uses the fixed brand surface colors documented
 * in DESIGN.md (the same `#171325` footer surface as the tenant footer) so the
 * white wordmark logo reads correctly.
 */

import Image from "next/image";
import Link from "next/link";

import { APP_LOGIN_URL, APP_SIGNUP_URL } from "./marketing-links";

export function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="font-[family:var(--font-ibm-plex-sans)]"
      style={{ backgroundColor: "#171325", color: "#FFFFFF" }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-8 py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="inline-block" aria-label="Supportsheep home">
              <Image
                src="/supportsheep-footer-logo.svg"
                alt="Supportsheep logo"
                width={240}
                height={40}
                unoptimized
                className="h-10 w-auto max-w-[240px] object-contain"
              />
            </Link>

            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                href={APP_SIGNUP_URL}
                className="text-sm opacity-80 transition-opacity hover:opacity-100 no-underline"
              >
                Start your blog
              </Link>
              <Link
                href={APP_LOGIN_URL}
                className="text-sm opacity-80 transition-opacity hover:opacity-100 no-underline"
              >
                Sign in
              </Link>
              <Link
                href="https://github.com/pooriaarab/blogbat"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm opacity-80 transition-opacity hover:opacity-100 no-underline"
              >
                GitHub
              </Link>
            </nav>
          </div>

          <hr className="my-0 border-t border-current/20" />

          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm opacity-70">&copy; {currentYear} Supportsheep</p>
            <span className="text-sm opacity-70">Powered by Supportsheep</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
