import type { PublicArticleAppearanceConfig } from "@repo/types";

export const DEFAULT_PUBLIC_ARTICLE_APPEARANCE: PublicArticleAppearanceConfig = {
  cards: {
    borderRadiusPreset: "soft",
    borderRadius: "",
    shadowPreset: "none",
    hoverStyle: "border",
  },
  readingLayout: {
    contentWidthPreset: "standard",
    contentWidth: "",
    bodyLineHeightPreset: "balanced",
    bodyLineHeight: "",
    summaryBoxStyle: "outlined",
  },
  tableOfContents: {
    enabled: true,
    stylePreset: "bordered",
  },
  typography: {
    fontPreset: "default",
    headingScalePreset: "balanced",
  },
};
