import type { CSSProperties } from "react";
import { DEFAULT_PUBLIC_ARTICLE_APPEARANCE } from "@/lib/public-article-appearance";
import type { PublicArticleAppearanceConfig } from "@repo/types";

export interface ResolvedPublicArticleTheme {
  cards: {
    containerClassName: string;
    containerStyle?: CSSProperties;
    mediaClassName: string;
    mediaStyle?: CSSProperties;
    hoverClassName: string;
  };
  readingLayout: {
    contentContainerStyle?: CSSProperties;
    bodyTextStyle?: CSSProperties;
    summaryClassName: string;
    summaryStyle?: CSSProperties;
    heroClassName: string;
    heroStyle?: CSSProperties;
    sidebarCardClassName: string;
    sidebarCardStyle?: CSSProperties;
  };
  tableOfContents: {
    enabled: boolean;
    containerClassName: string;
    containerStyle?: CSSProperties;
  };
  typography: {
    headingFontClassName: string;
    bodyFontClassName: string;
    proseClassName: string;
    pageTitleClassName: string;
    sectionTitleClassName: string;
    featuredCardTitleClassName: string;
    listCardTitleClassName: string;
    gridCardTitleClassName: string;
  };
}

function resolveRadiusClasses(
  preset: PublicArticleAppearanceConfig["cards"]["borderRadiusPreset"],
) {
  switch (preset) {
    case "sharp":
      return {
        surfaceClassName: "rounded-lg",
        mediaClassName: "rounded-md",
        proseImageClassName: "prose-img:rounded-md",
      };
    case "round":
      return {
        surfaceClassName: "rounded-2xl",
        mediaClassName: "rounded-xl",
        proseImageClassName: "prose-img:rounded-xl",
      };
    case "soft":
    default:
      return {
        surfaceClassName: "rounded-xl",
        mediaClassName: "rounded-lg",
        proseImageClassName: "prose-img:rounded-lg",
      };
  }
}

function resolveShadowClass(
  preset: PublicArticleAppearanceConfig["cards"]["shadowPreset"],
) {
  switch (preset) {
    case "subtle":
      return "shadow-[0_16px_40px_-32px_rgba(20,24,35,0.28)]";
    case "elevated":
      return "shadow-[0_24px_80px_-48px_rgba(20,24,35,0.48)]";
    case "none":
    default:
      return "";
  }
}

function resolveHoverClass(
  preset: PublicArticleAppearanceConfig["cards"]["hoverStyle"],
) {
  switch (preset) {
    case "none":
      return "";
    case "lift":
      return "hover:-translate-y-1 hover:border-primary/30";
    case "border":
    default:
      return "hover:border-primary/30";
  }
}

function resolveContentWidth(
  layout: PublicArticleAppearanceConfig["readingLayout"],
) {
  if (layout.contentWidth.trim()) {
    return { maxWidth: layout.contentWidth };
  }

  switch (layout.contentWidthPreset) {
    case "narrow":
      return { maxWidth: "42rem" };
    case "wide":
      return { maxWidth: "56rem" };
    case "standard":
    default:
      return { maxWidth: "48rem" };
  }
}

function resolveLineHeight(
  layout: PublicArticleAppearanceConfig["readingLayout"],
) {
  const lineHeightValue = layout.bodyLineHeight.trim()
    ? layout.bodyLineHeight
    : (() => {
        switch (layout.bodyLineHeightPreset) {
          case "compact":
            return "1.65";
          case "airy":
            return "1.95";
          case "balanced":
          default:
            return "1.8";
        }
      })();

  return {
    lineHeight: lineHeightValue,
    ["--article-body-line-height" as string]: lineHeightValue,
  } as CSSProperties;
}

function resolveProseClassName(
  fontPreset: ReturnType<typeof resolveFontPreset>,
  radius: ReturnType<typeof resolveRadiusClasses>,
) {
  // `dark:prose-invert` flips the Tailwind Typography palette to its
  // light-on-dark counterpart so body copy stays legible whenever the host
  // surface activates the `.dark` class (e.g. next-themes' system-pref
  // resolution on the interview canvas). Public article pages override the
  // semantic tokens via inline style on `PublicShell` without toggling
  // `.dark`, so this variant is a no-op there and the existing light-mode
  // pairing is preserved.
  return `${fontPreset.bodyFontClassName} prose prose-lg dark:prose-invert max-w-none ${fontPreset.proseHeadingFontClassName} prose-headings:scroll-mt-24 prose-a:text-primary prose-a:no-underline hover:prose-a:text-link-hover prose-p:leading-[var(--article-body-line-height)] prose-li:leading-[var(--article-body-line-height)] prose-blockquote:leading-[var(--article-body-line-height)] ${radius.proseImageClassName} prose-img:border prose-img:border-border prose-strong:text-foreground`;
}

function resolveHeadingScale(
  preset: PublicArticleAppearanceConfig["typography"]["headingScalePreset"],
) {
  switch (preset) {
    case "compact":
      return {
        pageTitleClassName: "text-3xl sm:text-4xl",
        sectionTitleClassName: "text-2xl",
        featuredCardTitleClassName: "text-2xl sm:text-3xl",
        listCardTitleClassName: "text-xl",
        gridCardTitleClassName: "text-lg",
      };
    case "display":
      return {
        pageTitleClassName: "text-5xl sm:text-6xl",
        sectionTitleClassName: "text-4xl",
        featuredCardTitleClassName: "text-4xl sm:text-5xl",
        listCardTitleClassName: "text-3xl",
        gridCardTitleClassName: "text-2xl",
      };
    case "balanced":
    default:
      return {
        pageTitleClassName: "text-4xl sm:text-5xl",
        sectionTitleClassName: "text-3xl",
        featuredCardTitleClassName: "text-3xl sm:text-4xl",
        listCardTitleClassName: "text-2xl",
        gridCardTitleClassName: "text-xl",
      };
  }
}

function resolveFontPreset(
  preset: PublicArticleAppearanceConfig["typography"]["fontPreset"],
) {
  switch (preset) {
    case "editorial":
      return {
        headingFontClassName: "font-[family:var(--font-dm-sans)]",
        bodyFontClassName: "font-[family:var(--font-ibm-plex-sans)]",
        proseHeadingFontClassName:
          "prose-headings:font-[family:var(--font-dm-sans)]",
      };
    case "modern":
      return {
        headingFontClassName: "font-[family:var(--font-space-grotesk)]",
        bodyFontClassName: "font-[family:var(--font-geist-sans)]",
        proseHeadingFontClassName:
          "prose-headings:font-[family:var(--font-space-grotesk)]",
      };
    case "default":
    default:
      return {
        headingFontClassName: "font-[family:var(--font-plus-jakarta-sans)]",
        bodyFontClassName: "font-[family:var(--font-ibm-plex-sans)]",
        proseHeadingFontClassName:
          "prose-headings:font-[family:var(--font-plus-jakarta-sans)]",
      };
  }
}

function resolveSummaryClass(
  preset: PublicArticleAppearanceConfig["readingLayout"]["summaryBoxStyle"],
  radiusClassName: string,
  shadowClassName: string,
) {
  switch (preset) {
    case "minimal":
      return `${radiusClassName} border border-border/60 bg-transparent p-6 ${shadowClassName}`.trim();
    case "filled":
      return `${radiusClassName} border border-border bg-muted/40 p-6 ${shadowClassName}`.trim();
    case "outlined":
    default:
      return `${radiusClassName} border border-border bg-card p-6 ${shadowClassName}`.trim();
  }
}

function resolveTocContainerClass(
  preset: PublicArticleAppearanceConfig["tableOfContents"]["stylePreset"],
  radiusClassName: string,
  shadowClassName: string,
) {
  switch (preset) {
    case "minimal":
      return `max-h-[calc(100vh-8rem)] overflow-y-auto ${radiusClassName} border-l-2 border-border bg-transparent p-0 ${shadowClassName}`.trim();
    case "card":
      return `max-h-[calc(100vh-8rem)] overflow-y-auto ${radiusClassName} border border-border bg-card p-6 ${shadowClassName}`.trim();
    case "bordered":
    default:
      return `max-h-[calc(100vh-8rem)] overflow-y-auto ${radiusClassName} border border-border bg-card p-6 ${shadowClassName}`.trim();
  }
}

export function resolvePublicArticleTheme(
  articleAppearance?: Partial<PublicArticleAppearanceConfig> | null,
): ResolvedPublicArticleTheme {
  const merged: PublicArticleAppearanceConfig = {
    cards: {
      ...DEFAULT_PUBLIC_ARTICLE_APPEARANCE.cards,
      ...articleAppearance?.cards,
    },
    readingLayout: {
      ...DEFAULT_PUBLIC_ARTICLE_APPEARANCE.readingLayout,
      ...articleAppearance?.readingLayout,
    },
    tableOfContents: {
      ...DEFAULT_PUBLIC_ARTICLE_APPEARANCE.tableOfContents,
      ...articleAppearance?.tableOfContents,
    },
    typography: {
      ...DEFAULT_PUBLIC_ARTICLE_APPEARANCE.typography,
      ...articleAppearance?.typography,
    },
  };

  const radius = resolveRadiusClasses(merged.cards.borderRadiusPreset);
  const shadowClassName = resolveShadowClass(merged.cards.shadowPreset);
  const hoverClassName = resolveHoverClass(merged.cards.hoverStyle);
  const headingScale = resolveHeadingScale(merged.typography.headingScalePreset);
  const fontPreset = resolveFontPreset(merged.typography.fontPreset);

  const surfaceStyle = merged.cards.borderRadius.trim()
    ? ({ borderRadius: merged.cards.borderRadius } satisfies CSSProperties)
    : undefined;
  const contentContainerStyle = resolveContentWidth(merged.readingLayout);
  const bodyTextStyle = resolveLineHeight(merged.readingLayout);

  return {
    cards: {
      containerClassName: `${radius.surfaceClassName} ${shadowClassName}`.trim(),
      containerStyle: surfaceStyle,
      mediaClassName: radius.mediaClassName,
      mediaStyle: surfaceStyle,
      hoverClassName,
    },
    readingLayout: {
      contentContainerStyle,
      bodyTextStyle,
      summaryClassName: resolveSummaryClass(
        merged.readingLayout.summaryBoxStyle,
        radius.surfaceClassName,
        shadowClassName,
      ),
      summaryStyle: surfaceStyle,
      heroClassName: `${radius.surfaceClassName} border border-border bg-card ${shadowClassName}`.trim(),
      heroStyle: surfaceStyle,
      sidebarCardClassName: `${radius.surfaceClassName} border border-border bg-card ${shadowClassName}`.trim(),
      sidebarCardStyle: surfaceStyle,
    },
    tableOfContents: {
      enabled: merged.tableOfContents.enabled,
      containerClassName: resolveTocContainerClass(
        merged.tableOfContents.stylePreset,
        radius.surfaceClassName,
        shadowClassName,
      ),
      containerStyle: surfaceStyle,
    },
    typography: {
      ...headingScale,
      ...fontPreset,
      proseClassName: resolveProseClassName(fontPreset, radius),
    },
  };
}
