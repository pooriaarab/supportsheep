import type { ThemePreset } from "../types";

/**
 * Catppuccin — Latte (light) + Mocha (dark)
 * https://catppuccin.com/
 *
 * Latte:  Base #EFF1F5, Mantle #E6E9EF, Crust #DCE0E8, Surface0 #CCD0DA,
 *         Text #4C4F69, Subtext0 #6C6F85, Overlay0 #9CA0B0,
 *         Mauve #8839EF, Red #D20F39, Green #40A02B, Yellow #DF8E1D,
 *         Blue #1E66F5, Peach #FE640B, Teal #179299, Pink #EA76CB
 *
 * Mocha:  Base #1E1E2E, Mantle #181825, Crust #11111B, Surface0 #313244,
 *         Text #CDD6F4, Subtext0 #A6ADC8, Overlay0 #6C7086,
 *         Mauve #CBA6F7, Red #F38BA8, Green #A6E3A1, Yellow #F9E2AF,
 *         Blue #89B4FA, Peach #FAB387, Teal #94E2D5, Pink #F5C2E7
 */
export const catppuccinTheme: ThemePreset = {
  id: "catppuccin",
  name: "Catppuccin",
  mode: "both",
  light: {
    // Latte palette
    background: "oklch(0.95 0.007 270)", // #EFF1F5
    foreground: "oklch(0.38 0.03 280)", // #4C4F69
    card: "oklch(0.93 0.008 270)", // #E6E9EF
    "card-foreground": "oklch(0.38 0.03 280)", // #4C4F69
    popover: "oklch(0.95 0.007 270)", // #EFF1F5
    "popover-foreground": "oklch(0.38 0.03 280)",
    primary: "oklch(0.50 0.24 305)", // #8839EF mauve
    "primary-foreground": "oklch(0.97 0.003 270)",
    secondary: "oklch(0.85 0.01 270)", // #CCD0DA surface0
    "secondary-foreground": "oklch(0.38 0.03 280)",
    muted: "oklch(0.85 0.01 270)", // #CCD0DA
    "muted-foreground": "oklch(0.52 0.02 275)", // #6C6F85 subtext0
    accent: "oklch(0.50 0.24 305)", // #8839EF mauve
    "accent-foreground": "oklch(0.97 0.003 270)",
    destructive: "oklch(0.52 0.22 15)", // #D20F39
    border: "oklch(0.88 0.01 270)", // between surface0 and mantle
    input: "oklch(0.88 0.01 270)",
    ring: "oklch(0.50 0.24 305)", // mauve

    "chart-1": "oklch(0.50 0.24 305)", // mauve
    "chart-2": "oklch(0.60 0.17 150)", // #40A02B green
    "chart-3": "oklch(0.50 0.18 260)", // #1E66F5 blue
    "chart-4": "oklch(0.68 0.17 55)", // #DF8E1D yellow
    "chart-5": "oklch(0.68 0.16 345)", // #EA76CB pink

    success: "oklch(0.60 0.17 150)", // #40A02B green
    "success-foreground": "oklch(0.97 0.003 270)",
    "success-subtle": "oklch(0.93 0.04 150)",
    "success-border": "oklch(0.78 0.10 150)",
    warning: "oklch(0.68 0.17 55)", // #DF8E1D yellow
    "warning-foreground": "oklch(0.30 0.02 55)",
    "warning-subtle": "oklch(0.93 0.04 55)",
    "warning-border": "oklch(0.80 0.10 55)",
    error: "oklch(0.52 0.22 15)", // #D20F39
    "error-foreground": "oklch(0.97 0.003 270)",
    "error-subtle": "oklch(0.93 0.04 15)",
    "error-border": "oklch(0.75 0.12 15)",
    info: "oklch(0.50 0.18 260)", // #1E66F5 blue
    "info-foreground": "oklch(0.97 0.003 270)",
    "info-subtle": "oklch(0.93 0.04 260)",
    "info-border": "oklch(0.75 0.10 260)",

    link: "oklch(0.50 0.18 260)", // blue
    "link-hover": "oklch(0.50 0.24 305)", // mauve

    sidebar: "oklch(0.93 0.008 270)", // #E6E9EF mantle
    "sidebar-foreground": "oklch(0.38 0.03 280)",
    "sidebar-primary": "oklch(0.50 0.24 305)",
    "sidebar-primary-foreground": "oklch(0.97 0.003 270)",
    "sidebar-accent": "oklch(0.88 0.01 270)",
    "sidebar-accent-foreground": "oklch(0.38 0.03 280)",
    "sidebar-border": "oklch(0.88 0.01 270)",
    "sidebar-ring": "oklch(0.50 0.24 305)",
  },
  dark: {
    // Mocha palette
    background: "oklch(0.25 0.02 280)", // #1E1E2E
    foreground: "oklch(0.87 0.02 275)", // #CDD6F4
    card: "oklch(0.32 0.02 280)", // #313244 surface0
    "card-foreground": "oklch(0.87 0.02 275)", // #CDD6F4
    popover: "oklch(0.28 0.02 280)", // between base and mantle
    "popover-foreground": "oklch(0.87 0.02 275)",
    primary: "oklch(0.78 0.13 305)", // #CBA6F7 mauve
    "primary-foreground": "oklch(0.22 0.02 280)", // #11111B crust
    secondary: "oklch(0.32 0.02 280)", // #313244
    "secondary-foreground": "oklch(0.87 0.02 275)",
    muted: "oklch(0.32 0.02 280)", // #313244
    "muted-foreground": "oklch(0.72 0.02 275)", // #A6ADC8 subtext0
    accent: "oklch(0.78 0.13 305)", // #CBA6F7 mauve
    "accent-foreground": "oklch(0.22 0.02 280)",
    destructive: "oklch(0.72 0.12 10)", // #F38BA8
    border: "oklch(0.32 0.02 280)", // #313244
    input: "oklch(0.35 0.02 278)",
    ring: "oklch(0.78 0.13 305)",

    "chart-1": "oklch(0.78 0.13 305)", // mauve
    "chart-2": "oklch(0.85 0.10 155)", // #A6E3A1 green
    "chart-3": "oklch(0.78 0.10 260)", // #89B4FA blue
    "chart-4": "oklch(0.82 0.10 70)", // #FAB387 peach
    "chart-5": "oklch(0.85 0.08 340)", // #F5C2E7 pink

    success: "oklch(0.85 0.10 155)", // #A6E3A1
    "success-foreground": "oklch(0.22 0.02 280)",
    "success-subtle": "oklch(0.30 0.04 155)",
    "success-border": "oklch(0.50 0.08 155)",
    warning: "oklch(0.90 0.06 80)", // #F9E2AF
    "warning-foreground": "oklch(0.22 0.02 280)",
    "warning-subtle": "oklch(0.32 0.04 80)",
    "warning-border": "oklch(0.55 0.06 80)",
    error: "oklch(0.72 0.12 10)", // #F38BA8
    "error-foreground": "oklch(0.22 0.02 280)",
    "error-subtle": "oklch(0.32 0.06 10)",
    "error-border": "oklch(0.50 0.10 10)",
    info: "oklch(0.78 0.10 260)", // #89B4FA
    "info-foreground": "oklch(0.22 0.02 280)",
    "info-subtle": "oklch(0.30 0.04 260)",
    "info-border": "oklch(0.50 0.08 260)",

    link: "oklch(0.78 0.10 260)", // blue
    "link-hover": "oklch(0.78 0.13 305)", // mauve

    sidebar: "oklch(0.22 0.02 280)", // #181825 mantle
    "sidebar-foreground": "oklch(0.87 0.02 275)",
    "sidebar-primary": "oklch(0.78 0.13 305)",
    "sidebar-primary-foreground": "oklch(0.22 0.02 280)",
    "sidebar-accent": "oklch(0.30 0.02 280)",
    "sidebar-accent-foreground": "oklch(0.87 0.02 275)",
    "sidebar-border": "oklch(0.30 0.02 280)",
    "sidebar-ring": "oklch(0.78 0.13 305)",
  },
  preview: {
    light: {
      bg: "#EFF1F5",
      fg: "#4C4F69",
      accent: "#8839EF",
      sidebar: "#E6E9EF",
    },
    dark: {
      bg: "#1E1E2E",
      fg: "#CDD6F4",
      accent: "#CBA6F7",
      sidebar: "#181825",
    },
  },
};
