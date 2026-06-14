import type { ThemePreset } from "../types";

/**
 * GitHub theme — light + dark
 * https://primer.style/
 *
 * Light: bg #FFFFFF, fg #1F2328, muted-fg #656D76, border #D0D7DE,
 *        blue #0969DA, green #1A7F37, red #CF222E, yellow #9A6700,
 *        subtle-bg #F6F8FA
 *
 * Dark:  bg #0D1117, fg #C9D1D9, muted-fg #8B949E, border #30363D,
 *        blue #58A6FF, green #3FB950, red #F85149, yellow #D29922,
 *        subtle-bg #161B22
 */
export const githubTheme: ThemePreset = {
  id: "github",
  name: "GitHub",
  mode: "both",
  light: {
    background: "oklch(1.00 0 0)", // #FFFFFF
    foreground: "oklch(0.24 0.01 250)", // #1F2328
    card: "oklch(1.00 0 0)", // #FFFFFF
    "card-foreground": "oklch(0.24 0.01 250)",
    popover: "oklch(1.00 0 0)",
    "popover-foreground": "oklch(0.24 0.01 250)",
    primary: "oklch(0.52 0.15 250)", // #0969DA
    "primary-foreground": "oklch(1.00 0 0)",
    secondary: "oklch(0.96 0.003 240)", // #F6F8FA
    "secondary-foreground": "oklch(0.24 0.01 250)",
    muted: "oklch(0.96 0.003 240)", // #F6F8FA
    "muted-foreground": "oklch(0.50 0.01 250)", // #656D76
    accent: "oklch(0.52 0.15 250)", // #0969DA
    "accent-foreground": "oklch(1.00 0 0)",
    destructive: "oklch(0.50 0.20 25)", // #CF222E
    border: "oklch(0.87 0.005 240)", // #D0D7DE
    input: "oklch(0.87 0.005 240)",
    ring: "oklch(0.52 0.15 250)",

    "chart-1": "oklch(0.52 0.15 250)", // blue
    "chart-2": "oklch(0.52 0.14 155)", // #1A7F37 green
    "chart-3": "oklch(0.62 0.13 60)", // #9A6700 yellow
    "chart-4": "oklch(0.50 0.20 25)", // #CF222E red
    "chart-5": "oklch(0.55 0.16 300)", // purple accent

    success: "oklch(0.52 0.14 155)", // #1A7F37
    "success-foreground": "oklch(1.00 0 0)",
    "success-subtle": "oklch(0.95 0.03 155)",
    "success-border": "oklch(0.78 0.08 155)",
    warning: "oklch(0.62 0.13 60)", // #9A6700
    "warning-foreground": "oklch(1.00 0 0)",
    "warning-subtle": "oklch(0.95 0.03 60)",
    "warning-border": "oklch(0.80 0.08 60)",
    error: "oklch(0.50 0.20 25)", // #CF222E
    "error-foreground": "oklch(1.00 0 0)",
    "error-subtle": "oklch(0.95 0.03 25)",
    "error-border": "oklch(0.78 0.12 25)",
    info: "oklch(0.52 0.15 250)", // #0969DA
    "info-foreground": "oklch(1.00 0 0)",
    "info-subtle": "oklch(0.95 0.03 250)",
    "info-border": "oklch(0.78 0.08 250)",

    link: "oklch(0.52 0.15 250)", // #0969DA
    "link-hover": "oklch(0.45 0.15 250)", // darker on hover

    sidebar: "oklch(0.96 0.003 240)", // #F6F8FA
    "sidebar-foreground": "oklch(0.24 0.01 250)",
    "sidebar-primary": "oklch(0.52 0.15 250)",
    "sidebar-primary-foreground": "oklch(1.00 0 0)",
    "sidebar-accent": "oklch(0.93 0.005 240)",
    "sidebar-accent-foreground": "oklch(0.24 0.01 250)",
    "sidebar-border": "oklch(0.87 0.005 240)",
    "sidebar-ring": "oklch(0.52 0.15 250)",
  },
  dark: {
    background: "oklch(0.18 0.01 250)", // #0D1117
    foreground: "oklch(0.84 0.01 240)", // #C9D1D9
    card: "oklch(0.22 0.01 250)", // #161B22
    "card-foreground": "oklch(0.84 0.01 240)",
    popover: "oklch(0.22 0.01 250)",
    "popover-foreground": "oklch(0.84 0.01 240)",
    primary: "oklch(0.72 0.12 250)", // #58A6FF
    "primary-foreground": "oklch(0.18 0.01 250)",
    secondary: "oklch(0.30 0.01 250)", // #21262D
    "secondary-foreground": "oklch(0.84 0.01 240)",
    muted: "oklch(0.30 0.01 250)",
    "muted-foreground": "oklch(0.65 0.01 240)", // #8B949E
    accent: "oklch(0.72 0.12 250)", // #58A6FF
    "accent-foreground": "oklch(0.18 0.01 250)",
    destructive: "oklch(0.65 0.20 25)", // #F85149
    border: "oklch(0.32 0.01 250)", // #30363D
    input: "oklch(0.32 0.01 250)",
    ring: "oklch(0.72 0.12 250)",

    "chart-1": "oklch(0.72 0.12 250)", // blue
    "chart-2": "oklch(0.72 0.14 155)", // #3FB950 green
    "chart-3": "oklch(0.72 0.12 60)", // #D29922 yellow
    "chart-4": "oklch(0.65 0.20 25)", // #F85149 red
    "chart-5": "oklch(0.72 0.14 300)", // purple

    success: "oklch(0.72 0.14 155)", // #3FB950
    "success-foreground": "oklch(0.18 0.01 250)",
    "success-subtle": "oklch(0.25 0.04 155)",
    "success-border": "oklch(0.45 0.08 155)",
    warning: "oklch(0.72 0.12 60)", // #D29922
    "warning-foreground": "oklch(0.18 0.01 250)",
    "warning-subtle": "oklch(0.28 0.04 60)",
    "warning-border": "oklch(0.48 0.08 60)",
    error: "oklch(0.65 0.20 25)", // #F85149
    "error-foreground": "oklch(0.97 0.003 0)",
    "error-subtle": "oklch(0.25 0.06 25)",
    "error-border": "oklch(0.45 0.14 25)",
    info: "oklch(0.72 0.12 250)", // #58A6FF
    "info-foreground": "oklch(0.18 0.01 250)",
    "info-subtle": "oklch(0.25 0.04 250)",
    "info-border": "oklch(0.45 0.08 250)",

    link: "oklch(0.72 0.12 250)", // #58A6FF
    "link-hover": "oklch(0.78 0.12 250)", // brighter

    sidebar: "oklch(0.14 0.01 250)", // #010409 very dark
    "sidebar-foreground": "oklch(0.84 0.01 240)",
    "sidebar-primary": "oklch(0.72 0.12 250)",
    "sidebar-primary-foreground": "oklch(0.18 0.01 250)",
    "sidebar-accent": "oklch(0.25 0.01 250)",
    "sidebar-accent-foreground": "oklch(0.84 0.01 240)",
    "sidebar-border": "oklch(0.30 0.01 250)",
    "sidebar-ring": "oklch(0.72 0.12 250)",
  },
  preview: {
    light: {
      bg: "#FFFFFF",
      fg: "#1F2328",
      accent: "#0969DA",
      sidebar: "#F6F8FA",
    },
    dark: {
      bg: "#0D1117",
      fg: "#C9D1D9",
      accent: "#58A6FF",
      sidebar: "#010409",
    },
  },
};
