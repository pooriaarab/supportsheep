import type { ThemePreset } from "../types";

/**
 * Rose Pine theme — Dawn (light) + Moon (dark)
 * https://rosepinetheme.com/
 *
 * Dawn:  Surface #FAF4ED, Overlay #F2E9E1, Muted #9893A5, Subtle #797593,
 *        Text #575279, Love #B4637A, Gold #EA9D34, Rose #D7827E,
 *        Pine #286983, Foam #56949F, Iris #907AA9
 *
 * Moon:  Base #232136, Surface #2A273F, Overlay #393552, Muted #6E6A86,
 *        Subtle #908CAA, Text #E0DEF4, Love #EB6F92, Gold #F6C177,
 *        Rose #EA9A97, Pine #3E8FB0, Foam #9CCFD8, Iris #C4A7E7
 */
export const rosePineTheme: ThemePreset = {
  id: "rose-pine",
  name: "Rose Pine",
  mode: "both",
  light: {
    // Dawn palette
    background: "oklch(0.97 0.01 50)", // #FAF4ED
    foreground: "oklch(0.42 0.04 290)", // #575279
    card: "oklch(0.94 0.012 50)", // #F2E9E1
    "card-foreground": "oklch(0.42 0.04 290)",
    popover: "oklch(0.97 0.01 50)",
    "popover-foreground": "oklch(0.42 0.04 290)",
    primary: "oklch(0.60 0.12 15)", // #D7827E rose
    "primary-foreground": "oklch(0.97 0.01 50)",
    secondary: "oklch(0.94 0.012 50)", // #F2E9E1
    "secondary-foreground": "oklch(0.52 0.03 290)", // #797593 subtle
    muted: "oklch(0.94 0.012 50)",
    "muted-foreground": "oklch(0.65 0.02 290)", // #9893A5 muted
    accent: "oklch(0.60 0.12 15)", // rose
    "accent-foreground": "oklch(0.97 0.01 50)",
    destructive: "oklch(0.55 0.14 350)", // #B4637A love
    border: "oklch(0.91 0.012 50)",
    input: "oklch(0.91 0.012 50)",
    ring: "oklch(0.60 0.12 15)",

    "chart-1": "oklch(0.60 0.12 15)", // rose
    "chart-2": "oklch(0.48 0.08 210)", // #286983 pine
    "chart-3": "oklch(0.67 0.12 70)", // #EA9D34 gold
    "chart-4": "oklch(0.60 0.08 300)", // #907AA9 iris
    "chart-5": "oklch(0.60 0.08 195)", // #56949F foam

    success: "oklch(0.60 0.08 195)", // #56949F foam
    "success-foreground": "oklch(0.97 0.01 50)",
    "success-subtle": "oklch(0.94 0.03 195)",
    "success-border": "oklch(0.78 0.06 195)",
    warning: "oklch(0.67 0.12 70)", // #EA9D34 gold
    "warning-foreground": "oklch(0.35 0.03 70)",
    "warning-subtle": "oklch(0.94 0.03 70)",
    "warning-border": "oklch(0.80 0.08 70)",
    error: "oklch(0.55 0.14 350)", // #B4637A love
    "error-foreground": "oklch(0.97 0.01 50)",
    "error-subtle": "oklch(0.94 0.03 350)",
    "error-border": "oklch(0.78 0.08 350)",
    info: "oklch(0.48 0.08 210)", // #286983 pine
    "info-foreground": "oklch(0.97 0.01 50)",
    "info-subtle": "oklch(0.94 0.03 210)",
    "info-border": "oklch(0.72 0.06 210)",

    link: "oklch(0.48 0.08 210)", // pine
    "link-hover": "oklch(0.60 0.12 15)", // rose

    sidebar: "oklch(0.94 0.012 50)", // #F2E9E1
    "sidebar-foreground": "oklch(0.42 0.04 290)",
    "sidebar-primary": "oklch(0.60 0.12 15)",
    "sidebar-primary-foreground": "oklch(0.97 0.01 50)",
    "sidebar-accent": "oklch(0.96 0.01 50)",
    "sidebar-accent-foreground": "oklch(0.42 0.04 290)",
    "sidebar-border": "oklch(0.91 0.012 50)",
    "sidebar-ring": "oklch(0.60 0.12 15)",
  },
  dark: {
    // Moon palette
    background: "oklch(0.25 0.03 290)", // #232136
    foreground: "oklch(0.90 0.02 290)", // #E0DEF4
    card: "oklch(0.28 0.03 290)", // #2A273F
    "card-foreground": "oklch(0.90 0.02 290)",
    popover: "oklch(0.28 0.03 290)",
    "popover-foreground": "oklch(0.90 0.02 290)",
    primary: "oklch(0.73 0.10 15)", // #EA9A97 rose
    "primary-foreground": "oklch(0.22 0.03 290)",
    secondary: "oklch(0.33 0.03 290)", // #393552 overlay
    "secondary-foreground": "oklch(0.90 0.02 290)",
    muted: "oklch(0.33 0.03 290)",
    "muted-foreground": "oklch(0.52 0.02 290)", // #6E6A86 muted
    accent: "oklch(0.73 0.10 15)", // rose
    "accent-foreground": "oklch(0.22 0.03 290)",
    destructive: "oklch(0.65 0.18 355)", // #EB6F92 love
    border: "oklch(0.33 0.03 290)", // #393552
    input: "oklch(0.35 0.03 290)",
    ring: "oklch(0.73 0.10 15)",

    "chart-1": "oklch(0.73 0.10 15)", // rose
    "chart-2": "oklch(0.55 0.10 210)", // #3E8FB0 pine
    "chart-3": "oklch(0.82 0.10 70)", // #F6C177 gold
    "chart-4": "oklch(0.78 0.10 305)", // #C4A7E7 iris
    "chart-5": "oklch(0.82 0.06 195)", // #9CCFD8 foam

    success: "oklch(0.82 0.06 195)", // #9CCFD8 foam
    "success-foreground": "oklch(0.22 0.03 290)",
    "success-subtle": "oklch(0.30 0.03 195)",
    "success-border": "oklch(0.48 0.05 195)",
    warning: "oklch(0.82 0.10 70)", // #F6C177 gold
    "warning-foreground": "oklch(0.22 0.03 290)",
    "warning-subtle": "oklch(0.32 0.04 70)",
    "warning-border": "oklch(0.52 0.08 70)",
    error: "oklch(0.65 0.18 355)", // #EB6F92 love
    "error-foreground": "oklch(0.95 0.01 290)",
    "error-subtle": "oklch(0.30 0.06 355)",
    "error-border": "oklch(0.48 0.12 355)",
    info: "oklch(0.55 0.10 210)", // #3E8FB0 pine
    "info-foreground": "oklch(0.95 0.01 290)",
    "info-subtle": "oklch(0.30 0.04 210)",
    "info-border": "oklch(0.45 0.06 210)",

    link: "oklch(0.82 0.06 195)", // foam
    "link-hover": "oklch(0.73 0.10 15)", // rose

    sidebar: "oklch(0.22 0.03 290)", // #1F1D30 darker
    "sidebar-foreground": "oklch(0.90 0.02 290)",
    "sidebar-primary": "oklch(0.73 0.10 15)",
    "sidebar-primary-foreground": "oklch(0.22 0.03 290)",
    "sidebar-accent": "oklch(0.28 0.03 290)",
    "sidebar-accent-foreground": "oklch(0.90 0.02 290)",
    "sidebar-border": "oklch(0.30 0.03 290)",
    "sidebar-ring": "oklch(0.73 0.10 15)",
  },
  preview: {
    light: {
      bg: "#FAF4ED",
      fg: "#575279",
      accent: "#D7827E",
      sidebar: "#F2E9E1",
    },
    dark: {
      bg: "#232136",
      fg: "#E0DEF4",
      accent: "#EA9A97",
      sidebar: "#1F1D30",
    },
  },
};
