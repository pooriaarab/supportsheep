import type { ThemePreset } from "../types";

/**
 * Tokyo Night theme — dark only
 * https://github.com/enkia/tokyo-night-vscode-theme
 *
 * Background:   #1A1B26    Editor BG:    #16161E    Selection: #283457
 * Foreground:   #A9B1D6    Comment:      #565F89    Blue:      #7AA2F7
 * Cyan:         #7DCFFF    Green:        #9ECE6A    Magenta:   #BB9AF7
 * Orange:       #FF9E64    Red:          #F7768E    Yellow:    #E0AF68
 * Terminal Blk: #414868
 */
export const tokyoNightTheme: ThemePreset = {
  id: "tokyo-night",
  name: "Tokyo Night",
  mode: "dark",
  dark: {
    background: "oklch(0.22 0.02 270)", // #1A1B26
    foreground: "oklch(0.76 0.04 270)", // #A9B1D6
    card: "oklch(0.35 0.03 265)", // #283457 selection
    "card-foreground": "oklch(0.76 0.04 270)",
    popover: "oklch(0.25 0.02 268)", // slightly lighter than bg
    "popover-foreground": "oklch(0.76 0.04 270)",
    primary: "oklch(0.72 0.12 260)", // #7AA2F7 blue
    "primary-foreground": "oklch(0.20 0.02 270)",
    secondary: "oklch(0.38 0.03 265)", // #414868
    "secondary-foreground": "oklch(0.76 0.04 270)",
    muted: "oklch(0.38 0.03 265)", // #414868
    "muted-foreground": "oklch(0.48 0.04 265)", // #565F89 comment
    accent: "oklch(0.72 0.12 260)", // blue
    "accent-foreground": "oklch(0.95 0.01 270)",
    destructive: "oklch(0.66 0.18 5)", // #F7768E red
    border: "oklch(0.35 0.03 265)", // #283457
    input: "oklch(0.38 0.03 265)", // #414868
    ring: "oklch(0.72 0.12 260)",

    "chart-1": "oklch(0.72 0.12 260)", // #7AA2F7 blue
    "chart-2": "oklch(0.75 0.13 130)", // #9ECE6A green
    "chart-3": "oklch(0.75 0.10 70)", // #E0AF68 yellow
    "chart-4": "oklch(0.74 0.12 300)", // #BB9AF7 magenta
    "chart-5": "oklch(0.82 0.10 210)", // #7DCFFF cyan

    success: "oklch(0.75 0.13 130)", // #9ECE6A green
    "success-foreground": "oklch(0.20 0.02 270)",
    "success-subtle": "oklch(0.28 0.04 130)",
    "success-border": "oklch(0.48 0.08 130)",
    warning: "oklch(0.75 0.10 70)", // #E0AF68 yellow
    "warning-foreground": "oklch(0.20 0.02 270)",
    "warning-subtle": "oklch(0.30 0.04 70)",
    "warning-border": "oklch(0.50 0.08 70)",
    error: "oklch(0.66 0.18 5)", // #F7768E
    "error-foreground": "oklch(0.95 0.01 270)",
    "error-subtle": "oklch(0.28 0.06 5)",
    "error-border": "oklch(0.48 0.12 5)",
    info: "oklch(0.82 0.10 210)", // #7DCFFF cyan
    "info-foreground": "oklch(0.20 0.02 270)",
    "info-subtle": "oklch(0.28 0.04 210)",
    "info-border": "oklch(0.48 0.06 210)",

    link: "oklch(0.82 0.10 210)", // #7DCFFF cyan
    "link-hover": "oklch(0.72 0.12 260)", // blue

    sidebar: "oklch(0.19 0.02 270)", // #16161E editor bg
    "sidebar-foreground": "oklch(0.76 0.04 270)",
    "sidebar-primary": "oklch(0.72 0.12 260)",
    "sidebar-primary-foreground": "oklch(0.20 0.02 270)",
    "sidebar-accent": "oklch(0.28 0.03 268)",
    "sidebar-accent-foreground": "oklch(0.76 0.04 270)",
    "sidebar-border": "oklch(0.30 0.03 268)",
    "sidebar-ring": "oklch(0.72 0.12 260)",
  },
  preview: {
    dark: {
      bg: "#1A1B26",
      fg: "#A9B1D6",
      accent: "#7AA2F7",
      sidebar: "#16161E",
    },
  },
};
