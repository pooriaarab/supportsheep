/** All CSS variable names defined in globals.css that themes can override */
export type CSSVariableName =
  | "background"
  | "foreground"
  | "card"
  | "card-foreground"
  | "popover"
  | "popover-foreground"
  | "primary"
  | "primary-foreground"
  | "secondary"
  | "secondary-foreground"
  | "muted"
  | "muted-foreground"
  | "accent"
  | "accent-foreground"
  | "destructive"
  | "border"
  | "input"
  | "ring"
  | "chart-1"
  | "chart-2"
  | "chart-3"
  | "chart-4"
  | "chart-5"
  | "success"
  | "success-foreground"
  | "success-subtle"
  | "success-border"
  | "warning"
  | "warning-foreground"
  | "warning-subtle"
  | "warning-border"
  | "error"
  | "error-foreground"
  | "error-subtle"
  | "error-border"
  | "info"
  | "info-foreground"
  | "info-subtle"
  | "info-border"
  | "link"
  | "link-hover"
  | "sidebar"
  | "sidebar-foreground"
  | "sidebar-primary"
  | "sidebar-primary-foreground"
  | "sidebar-accent"
  | "sidebar-accent-foreground"
  | "sidebar-border"
  | "sidebar-ring";

/** Partial CSS variable overrides — only specify what differs from Default */
export type ThemeColors = Partial<Record<CSSVariableName, string>>;

/** Which color modes this theme supports */
export type ThemeMode = "light" | "dark" | "both";

/** Preview colors for theme cards in settings UI */
export interface ThemePreview {
  bg: string;
  fg: string;
  accent: string;
  sidebar: string;
}

/** A complete theme preset definition */
export interface ThemePreset {
  /** Unique kebab-case ID: 'nord', 'dracula', etc. */
  id: string;
  /** Human-readable display name */
  name: string;
  /** Which modes this theme supports */
  mode: ThemeMode;
  /** CSS variable overrides for light mode (undefined if dark-only) */
  light?: ThemeColors;
  /** CSS variable overrides for dark mode (undefined if light-only) */
  dark?: ThemeColors;
  /** Preview colors for the settings UI theme cards */
  preview: {
    light?: ThemePreview;
    dark?: ThemePreview;
  };
}

/** Valid theme preset IDs */
export const THEME_IDS = [
  "default",
  "nord",
  "dracula",
  "catppuccin",
  "github",
  "solarized",
  "rose-pine",
  "tokyo-night",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];
