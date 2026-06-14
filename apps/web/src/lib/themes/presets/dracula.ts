import type { ThemePreset } from "../types";

/**
 * Dracula theme — dark only
 * https://draculatheme.com/
 *
 * Background:    #282A36    Current Line: #44475A    Foreground: #F8F8F2
 * Comment:       #6272A4    Cyan:         #8BE9FD    Green:      #50FA7B
 * Orange:        #FFB86C    Pink:         #FF79C6    Purple:     #BD93F9
 * Red:           #FF5555    Yellow:       #F1FA8C
 */
export const draculaTheme: ThemePreset = {
  id: "dracula",
  name: "Dracula",
  mode: "dark",
  dark: {
    background: "oklch(0.28 0.02 280)", // #282A36
    foreground: "oklch(0.97 0.005 100)", // #F8F8F2
    card: "oklch(0.35 0.02 275)", // #44475A
    "card-foreground": "oklch(0.97 0.005 100)", // #F8F8F2
    popover: "oklch(0.32 0.02 278)", // slightly lighter than bg
    "popover-foreground": "oklch(0.97 0.005 100)",
    primary: "oklch(0.72 0.15 300)", // #BD93F9 purple
    "primary-foreground": "oklch(0.22 0.02 280)", // dark bg
    secondary: "oklch(0.35 0.02 275)", // #44475A
    "secondary-foreground": "oklch(0.97 0.005 100)",
    muted: "oklch(0.35 0.02 275)", // #44475A
    "muted-foreground": "oklch(0.55 0.06 260)", // #6272A4 comment
    accent: "oklch(0.72 0.15 300)", // #BD93F9
    "accent-foreground": "oklch(0.97 0.005 100)",
    destructive: "oklch(0.63 0.22 25)", // #FF5555
    border: "oklch(0.35 0.02 275)", // #44475A
    input: "oklch(0.38 0.02 275)", // slightly lighter
    ring: "oklch(0.72 0.15 300)", // #BD93F9

    "chart-1": "oklch(0.72 0.15 300)", // #BD93F9 purple
    "chart-2": "oklch(0.87 0.18 160)", // #50FA7B green
    "chart-3": "oklch(0.85 0.12 195)", // #8BE9FD cyan
    "chart-4": "oklch(0.75 0.16 345)", // #FF79C6 pink
    "chart-5": "oklch(0.80 0.13 70)", // #FFB86C orange

    success: "oklch(0.87 0.18 160)", // #50FA7B
    "success-foreground": "oklch(0.22 0.02 280)",
    "success-subtle": "oklch(0.32 0.06 160)",
    "success-border": "oklch(0.50 0.12 160)",
    warning: "oklch(0.80 0.13 70)", // #FFB86C
    "warning-foreground": "oklch(0.22 0.02 280)",
    "warning-subtle": "oklch(0.35 0.05 70)",
    "warning-border": "oklch(0.55 0.10 70)",
    error: "oklch(0.63 0.22 25)", // #FF5555
    "error-foreground": "oklch(0.97 0.005 100)",
    "error-subtle": "oklch(0.35 0.08 25)",
    "error-border": "oklch(0.50 0.16 25)",
    info: "oklch(0.85 0.12 195)", // #8BE9FD
    "info-foreground": "oklch(0.22 0.02 280)",
    "info-subtle": "oklch(0.32 0.05 195)",
    "info-border": "oklch(0.50 0.08 195)",

    link: "oklch(0.85 0.12 195)", // #8BE9FD cyan
    "link-hover": "oklch(0.72 0.15 300)", // #BD93F9 purple

    sidebar: "oklch(0.24 0.02 280)", // #21222C darker
    "sidebar-foreground": "oklch(0.97 0.005 100)",
    "sidebar-primary": "oklch(0.72 0.15 300)",
    "sidebar-primary-foreground": "oklch(0.22 0.02 280)",
    "sidebar-accent": "oklch(0.32 0.02 278)",
    "sidebar-accent-foreground": "oklch(0.97 0.005 100)",
    "sidebar-border": "oklch(0.32 0.02 278)",
    "sidebar-ring": "oklch(0.72 0.15 300)",
  },
  preview: {
    dark: {
      bg: "#282A36",
      fg: "#F8F8F2",
      accent: "#BD93F9",
      sidebar: "#21222C",
    },
  },
};
