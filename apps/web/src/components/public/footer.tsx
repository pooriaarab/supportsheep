/**
 * Public site footer — a clean, minimal blog footer for BlogBat.
 *
 * Renders the blog brand mark, lightweight blog navigation, an RSS link, and a
 * "Powered by BlogBat" credit. Uses semantic color tokens and the Next.js Link
 * component. Brand colors are config-driven via inline style so each tenant blog
 * can theme its own header/footer surfaces.
 */

import Image from "next/image";
import Link from "next/link";
import { Rss } from "lucide-react";
import type { BlogConfig } from "@repo/types";

interface PublicFooterProps {
  config: BlogConfig;
  showToolsLink?: boolean;
}

const DEFAULT_FOOTER_LOGO_URL = "/blogbat-footer-logo.svg";

export function PublicFooter({
  config,
  showToolsLink = false,
}: PublicFooterProps) {
  const footerAppearance = {
    logoUrl: config.publicAppearance?.footer?.logoUrl ?? null,
    text: config.publicAppearance?.footer?.text ?? "",
    backgroundColor:
      config.publicAppearance?.footer?.backgroundColor ?? "#171325",
    textColor: config.publicAppearance?.footer?.textColor ?? "#FFFFFF",
  };
  const brandText = footerAppearance?.text?.trim() || config.siteName;
  const brandLogoUrl = footerAppearance.logoUrl ?? DEFAULT_FOOTER_LOGO_URL;
  const brandAlt = footerAppearance.logoUrl
    ? brandText || `${config.siteName} logo`
    : brandText === "Blog"
      ? "BlogBat logo"
      : brandText === config.siteName
        ? `${brandText} logo`
        : brandText;
  const brandMarkup = (
    <Image
      src={brandLogoUrl}
      alt={brandAlt}
      width={240}
      height={40}
      unoptimized
      className="h-10 w-auto max-w-[240px] object-contain"
    />
  );
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="font-[family:var(--font-ibm-plex-sans)]"
      style={{
        backgroundColor: footerAppearance?.backgroundColor,
        color: footerAppearance?.textColor,
      }}
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-8 py-12">
          {/* Brand + navigation */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/" className="inline-block" aria-label={brandAlt}>
              {brandMarkup}
            </Link>

            <nav className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link
                href="/"
                className="text-sm opacity-80 transition-opacity hover:opacity-100 no-underline"
              >
                Home
              </Link>
              {showToolsLink ? (
                <Link
                  href="/tools"
                  className="text-sm opacity-80 transition-opacity hover:opacity-100 no-underline"
                >
                  Tools
                </Link>
              ) : null}
              <Link
                href="/blog/search"
                className="text-sm opacity-80 transition-opacity hover:opacity-100 no-underline"
              >
                Search
              </Link>
              <Link
                href="/api/feed"
                className="inline-flex items-center gap-1.5 text-sm opacity-80 transition-opacity hover:opacity-100 no-underline"
              >
                <Rss className="size-4" aria-hidden="true" />
                RSS
              </Link>
            </nav>
          </div>

          {/* Divider */}
          <hr className="my-0 border-t border-current/20" />

          {/* Bottom credit */}
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="text-sm opacity-70">
              &copy; {currentYear} {config.siteName}
            </p>
            <Link
              href="https://blogbat.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm opacity-80 transition-opacity hover:opacity-100 no-underline"
            >
              Powered by BlogBat
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
