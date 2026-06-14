import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import type { BlogConfig } from "@repo/types";

interface PublicHeaderProps {
  config: BlogConfig;
}

const DEFAULT_HEADER_LOGO_URL = "/blogbat-header-logo.svg";

export function PublicHeader({ config }: PublicHeaderProps) {
  const headerAppearance = {
    logoUrl: config.publicAppearance?.header?.logoUrl ?? null,
    text: config.publicAppearance?.header?.text ?? "",
    backgroundColor:
      config.publicAppearance?.header?.backgroundColor ?? "#1d1133",
    textColor: config.publicAppearance?.header?.textColor ?? "#FFFFFF",
  };
  const brandText = headerAppearance?.text?.trim() || config.siteName;
  const brandLogoUrl = headerAppearance.logoUrl ?? DEFAULT_HEADER_LOGO_URL;
  const brandAlt = headerAppearance.logoUrl
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
      width={220}
      height={36}
      unoptimized
      className="h-9 w-auto max-w-[220px] object-contain"
    />
  );

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/10 backdrop-blur"
      style={{
        backgroundColor: headerAppearance?.backgroundColor,
        color: headerAppearance?.textColor,
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <Link
            href="/"
            className="inline-flex items-center gap-3 no-underline"
            style={{ color: "inherit" }}
            aria-label={brandAlt}
          >
            {brandMarkup}
          </Link>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          <Link
            href="/"
            className="text-sm font-medium opacity-80 transition-opacity hover:opacity-100"
            style={{ color: "inherit" }}
          >
            Home
          </Link>
          <Link
            href="/tools"
            className="text-sm font-medium opacity-80 transition-opacity hover:opacity-100"
            style={{ color: "inherit" }}
          >
            Tools
          </Link>
        </nav>

        <Link
          href="/blog/search"
          aria-label="Search articles"
          className="inline-flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90"
        >
          <Search className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
