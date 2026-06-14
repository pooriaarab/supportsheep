import type { ThemePreset } from "../types";

/**
 * Nord theme — Polar Night, Snow Storm, Frost, Aurora
 * https://www.nordtheme.com/
 *
 * Polar Night: #2E3440, #3B4252, #434C5E, #4C566A
 * Snow Storm:  #D8DEE9, #E5E9F0, #ECEFF4
 * Frost:       #8FBCBB, #88C0D0, #81A1C1, #5E81AC
 * Aurora:      #BF616A, #D08770, #EBCB8B, #A3BE8C, #B48EAD
 */
export const nordTheme: ThemePreset = {
  id: "nord",
  name: "Nord",
  mode: "both",
  light: {
    // Snow Storm base
    background: "oklch(0.95 0.005 240)", // #ECEFF4
    foreground: "oklch(0.30 0.02 240)", // #2E3440
    card: "oklch(0.93 0.006 240)", // #E5E9F0
    "card-foreground": "oklch(0.30 0.02 240)", // #2E3440
    popover: "oklch(0.95 0.005 240)", // #ECEFF4
    "popover-foreground": "oklch(0.30 0.02 240)", // #2E3440
    primary: "oklch(0.55 0.08 240)", // #5E81AC
    "primary-foreground": "oklch(0.97 0.003 240)", // white-ish
    secondary: "oklch(0.90 0.008 240)", // #D8DEE9
    "secondary-foreground": "oklch(0.35 0.02 240)", // #3B4252
    muted: "oklch(0.90 0.008 240)", // #D8DEE9
    "muted-foreground": "oklch(0.43 0.02 240)", // #4C566A
    accent: "oklch(0.72 0.07 200)", // #81A1C1
    "accent-foreground": "oklch(0.30 0.02 240)", // #2E3440
    destructive: "oklch(0.58 0.16 20)", // #BF616A
    border: "oklch(0.88 0.01 240)", // light border
    input: "oklch(0.88 0.01 240)", // same as border
    ring: "oklch(0.55 0.08 240)", // #5E81AC

    "chart-1": "oklch(0.55 0.08 240)", // #5E81AC Frost blue
    "chart-2": "oklch(0.67 0.10 155)", // #A3BE8C Aurora green
    "chart-3": "oklch(0.80 0.10 85)", // #EBCB8B Aurora yellow
    "chart-4": "oklch(0.62 0.12 35)", // #D08770 Aurora orange
    "chart-5": "oklch(0.65 0.10 320)", // #B48EAD Aurora purple

    success: "oklch(0.67 0.10 155)", // #A3BE8C
    "success-foreground": "oklch(0.30 0.02 240)",
    "success-subtle": "oklch(0.92 0.04 155)",
    "success-border": "oklch(0.80 0.08 155)",
    warning: "oklch(0.80 0.10 85)", // #EBCB8B
    "warning-foreground": "oklch(0.30 0.02 240)",
    "warning-subtle": "oklch(0.93 0.04 85)",
    "warning-border": "oklch(0.85 0.08 85)",
    error: "oklch(0.58 0.16 20)", // #BF616A
    "error-foreground": "oklch(0.97 0.003 240)",
    "error-subtle": "oklch(0.92 0.04 20)",
    "error-border": "oklch(0.78 0.10 20)",
    info: "oklch(0.75 0.08 200)", // #88C0D0
    "info-foreground": "oklch(0.30 0.02 240)",
    "info-subtle": "oklch(0.93 0.03 200)",
    "info-border": "oklch(0.82 0.06 200)",

    link: "oklch(0.55 0.08 240)", // #5E81AC
    "link-hover": "oklch(0.72 0.07 200)", // #81A1C1

    sidebar: "oklch(0.93 0.006 240)", // #E5E9F0
    "sidebar-foreground": "oklch(0.30 0.02 240)",
    "sidebar-primary": "oklch(0.55 0.08 240)",
    "sidebar-primary-foreground": "oklch(0.97 0.003 240)",
    "sidebar-accent": "oklch(0.90 0.008 240)",
    "sidebar-accent-foreground": "oklch(0.30 0.02 240)",
    "sidebar-border": "oklch(0.88 0.01 240)",
    "sidebar-ring": "oklch(0.55 0.08 240)",
  },
  dark: {
    // Polar Night base
    background: "oklch(0.30 0.02 240)", // #2E3440
    foreground: "oklch(0.88 0.01 225)", // #D8DEE9
    card: "oklch(0.33 0.02 240)", // #3B4252
    "card-foreground": "oklch(0.88 0.01 225)", // #D8DEE9
    popover: "oklch(0.33 0.02 240)", // #3B4252
    "popover-foreground": "oklch(0.88 0.01 225)", // #D8DEE9
    primary: "oklch(0.75 0.08 200)", // #88C0D0
    "primary-foreground": "oklch(0.30 0.02 240)", // #2E3440
    secondary: "oklch(0.38 0.02 240)", // #434C5E
    "secondary-foreground": "oklch(0.88 0.01 225)", // #D8DEE9
    muted: "oklch(0.38 0.02 240)", // #434C5E
    "muted-foreground": "oklch(0.73 0.01 225)", // lighter gray
    accent: "oklch(0.72 0.07 200)", // #81A1C1
    "accent-foreground": "oklch(0.95 0.005 240)", // #ECEFF4
    destructive: "oklch(0.58 0.16 20)", // #BF616A
    border: "oklch(0.38 0.02 240)", // #434C5E
    input: "oklch(0.38 0.02 240)", // #434C5E
    ring: "oklch(0.75 0.08 200)", // #88C0D0

    "chart-1": "oklch(0.75 0.08 200)", // #88C0D0 Frost cyan
    "chart-2": "oklch(0.67 0.10 155)", // #A3BE8C Aurora green
    "chart-3": "oklch(0.80 0.10 85)", // #EBCB8B Aurora yellow
    "chart-4": "oklch(0.62 0.12 35)", // #D08770 Aurora orange
    "chart-5": "oklch(0.65 0.10 320)", // #B48EAD Aurora purple

    success: "oklch(0.67 0.10 155)", // #A3BE8C
    "success-foreground": "oklch(0.30 0.02 240)",
    "success-subtle": "oklch(0.35 0.04 155)",
    "success-border": "oklch(0.50 0.08 155)",
    warning: "oklch(0.80 0.10 85)", // #EBCB8B
    "warning-foreground": "oklch(0.30 0.02 240)",
    "warning-subtle": "oklch(0.38 0.04 85)",
    "warning-border": "oklch(0.55 0.08 85)",
    error: "oklch(0.58 0.16 20)", // #BF616A
    "error-foreground": "oklch(0.95 0.005 240)",
    "error-subtle": "oklch(0.35 0.06 20)",
    "error-border": "oklch(0.48 0.12 20)",
    info: "oklch(0.75 0.08 200)", // #88C0D0
    "info-foreground": "oklch(0.30 0.02 240)",
    "info-subtle": "oklch(0.35 0.04 200)",
    "info-border": "oklch(0.52 0.06 200)",

    link: "oklch(0.75 0.08 200)", // #88C0D0
    "link-hover": "oklch(0.72 0.10 190)", // #8FBCBB

    sidebar: "oklch(0.27 0.02 240)", // darker than bg
    "sidebar-foreground": "oklch(0.88 0.01 225)",
    "sidebar-primary": "oklch(0.75 0.08 200)",
    "sidebar-primary-foreground": "oklch(0.30 0.02 240)",
    "sidebar-accent": "oklch(0.35 0.02 240)",
    "sidebar-accent-foreground": "oklch(0.88 0.01 225)",
    "sidebar-border": "oklch(0.35 0.02 240)",
    "sidebar-ring": "oklch(0.75 0.08 200)",
  },
  preview: {
    light: {
      bg: "#ECEFF4",
      fg: "#2E3440",
      accent: "#5E81AC",
      sidebar: "#E5E9F0",
    },
    dark: {
      bg: "#2E3440",
      fg: "#D8DEE9",
      accent: "#88C0D0",
      sidebar: "#292E39",
    },
  },
};
