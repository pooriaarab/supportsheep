import type { ThemePreset } from "../types";

/**
 * Solarized theme — light + dark
 * https://ethanschoonover.com/solarized/
 *
 * Base03 #002B36    Base02 #073642    Base01 #586E75    Base00 #657B83
 * Base0  #839496    Base1  #93A1A1    Base2  #EEE8D5    Base3  #FDF6E3
 * Yellow #B58900    Orange #CB4B16    Red    #DC322F    Magenta #D33682
 * Violet #6C71C4    Blue   #268BD2    Cyan   #2AA198    Green  #859900
 */
export const solarizedTheme: ThemePreset = {
  id: "solarized",
  name: "Solarized",
  mode: "both",
  light: {
    // Base3 background, dark text
    background: "oklch(0.97 0.015 85)", // #FDF6E3
    foreground: "oklch(0.55 0.02 195)", // #657B83 Base00
    card: "oklch(0.94 0.015 85)", // #EEE8D5 Base2
    "card-foreground": "oklch(0.55 0.02 195)",
    popover: "oklch(0.97 0.015 85)",
    "popover-foreground": "oklch(0.55 0.02 195)",
    primary: "oklch(0.55 0.12 245)", // #268BD2 blue
    "primary-foreground": "oklch(0.97 0.015 85)",
    secondary: "oklch(0.94 0.015 85)", // #EEE8D5 Base2
    "secondary-foreground": "oklch(0.45 0.02 195)", // #586E75 Base01
    muted: "oklch(0.94 0.015 85)",
    "muted-foreground": "oklch(0.60 0.02 195)", // #93A1A1 Base1
    accent: "oklch(0.55 0.12 245)", // blue
    "accent-foreground": "oklch(0.97 0.015 85)",
    destructive: "oklch(0.52 0.18 25)", // #DC322F
    border: "oklch(0.91 0.015 85)", // between Base2 and Base3
    input: "oklch(0.91 0.015 85)",
    ring: "oklch(0.55 0.12 245)",

    "chart-1": "oklch(0.55 0.12 245)", // blue
    "chart-2": "oklch(0.58 0.12 110)", // #859900 green
    "chart-3": "oklch(0.64 0.14 70)", // #B58900 yellow
    "chart-4": "oklch(0.55 0.17 40)", // #CB4B16 orange
    "chart-5": "oklch(0.50 0.14 290)", // #6C71C4 violet

    success: "oklch(0.58 0.12 110)", // #859900
    "success-foreground": "oklch(0.97 0.015 85)",
    "success-subtle": "oklch(0.95 0.03 110)",
    "success-border": "oklch(0.78 0.08 110)",
    warning: "oklch(0.64 0.14 70)", // #B58900
    "warning-foreground": "oklch(0.97 0.015 85)",
    "warning-subtle": "oklch(0.95 0.03 70)",
    "warning-border": "oklch(0.80 0.08 70)",
    error: "oklch(0.52 0.18 25)", // #DC322F
    "error-foreground": "oklch(0.97 0.015 85)",
    "error-subtle": "oklch(0.95 0.04 25)",
    "error-border": "oklch(0.78 0.10 25)",
    info: "oklch(0.60 0.10 190)", // #2AA198 cyan
    "info-foreground": "oklch(0.97 0.015 85)",
    "info-subtle": "oklch(0.95 0.03 190)",
    "info-border": "oklch(0.78 0.06 190)",

    link: "oklch(0.55 0.12 245)", // blue
    "link-hover": "oklch(0.50 0.14 290)", // violet

    sidebar: "oklch(0.94 0.015 85)", // #EEE8D5
    "sidebar-foreground": "oklch(0.55 0.02 195)",
    "sidebar-primary": "oklch(0.55 0.12 245)",
    "sidebar-primary-foreground": "oklch(0.97 0.015 85)",
    "sidebar-accent": "oklch(0.95 0.015 85)",
    "sidebar-accent-foreground": "oklch(0.45 0.02 195)",
    "sidebar-border": "oklch(0.91 0.015 85)",
    "sidebar-ring": "oklch(0.55 0.12 245)",
  },
  dark: {
    // Base03 background, light text
    background: "oklch(0.25 0.03 205)", // #002B36
    foreground: "oklch(0.62 0.02 195)", // #839496 Base0
    card: "oklch(0.28 0.03 200)", // #073642 Base02
    "card-foreground": "oklch(0.62 0.02 195)",
    popover: "oklch(0.28 0.03 200)",
    "popover-foreground": "oklch(0.62 0.02 195)",
    primary: "oklch(0.55 0.12 245)", // #268BD2 blue
    "primary-foreground": "oklch(0.97 0.015 85)",
    secondary: "oklch(0.28 0.03 200)", // Base02
    "secondary-foreground": "oklch(0.62 0.02 195)",
    muted: "oklch(0.28 0.03 200)",
    "muted-foreground": "oklch(0.45 0.02 195)", // #586E75 Base01
    accent: "oklch(0.55 0.12 245)",
    "accent-foreground": "oklch(0.97 0.015 85)",
    destructive: "oklch(0.52 0.18 25)", // #DC322F
    border: "oklch(0.28 0.03 200)", // Base02
    input: "oklch(0.30 0.03 200)",
    ring: "oklch(0.55 0.12 245)",

    "chart-1": "oklch(0.55 0.12 245)", // blue
    "chart-2": "oklch(0.58 0.12 110)", // green
    "chart-3": "oklch(0.64 0.14 70)", // yellow
    "chart-4": "oklch(0.55 0.17 40)", // orange
    "chart-5": "oklch(0.50 0.14 290)", // violet

    success: "oklch(0.58 0.12 110)", // #859900
    "success-foreground": "oklch(0.25 0.03 205)",
    "success-subtle": "oklch(0.30 0.04 110)",
    "success-border": "oklch(0.42 0.08 110)",
    warning: "oklch(0.64 0.14 70)", // #B58900
    "warning-foreground": "oklch(0.25 0.03 205)",
    "warning-subtle": "oklch(0.32 0.05 70)",
    "warning-border": "oklch(0.45 0.08 70)",
    error: "oklch(0.52 0.18 25)", // #DC322F
    "error-foreground": "oklch(0.97 0.015 85)",
    "error-subtle": "oklch(0.30 0.06 25)",
    "error-border": "oklch(0.42 0.12 25)",
    info: "oklch(0.60 0.10 190)", // #2AA198 cyan
    "info-foreground": "oklch(0.25 0.03 205)",
    "info-subtle": "oklch(0.30 0.04 190)",
    "info-border": "oklch(0.42 0.06 190)",

    link: "oklch(0.55 0.12 245)", // blue
    "link-hover": "oklch(0.60 0.10 190)", // cyan

    sidebar: "oklch(0.22 0.03 205)", // #00212B darker
    "sidebar-foreground": "oklch(0.62 0.02 195)",
    "sidebar-primary": "oklch(0.55 0.12 245)",
    "sidebar-primary-foreground": "oklch(0.97 0.015 85)",
    "sidebar-accent": "oklch(0.27 0.03 200)",
    "sidebar-accent-foreground": "oklch(0.62 0.02 195)",
    "sidebar-border": "oklch(0.27 0.03 200)",
    "sidebar-ring": "oklch(0.55 0.12 245)",
  },
  preview: {
    light: {
      bg: "#FDF6E3",
      fg: "#657B83",
      accent: "#268BD2",
      sidebar: "#EEE8D5",
    },
    dark: {
      bg: "#002B36",
      fg: "#839496",
      accent: "#268BD2",
      sidebar: "#00212B",
    },
  },
};
