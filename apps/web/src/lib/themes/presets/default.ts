import type { ThemePreset } from "../types";

export const defaultTheme: ThemePreset = {
  id: "default",
  name: "Default",
  mode: "both",
  light: {},
  dark: {},
  preview: {
    light: {
      bg: "#fafafa",
      fg: "#1a1a1a",
      accent: "#3b82f6",
      sidebar: "#f8f8f8",
    },
    dark: {
      bg: "#1a1a2e",
      fg: "#e8e8e8",
      accent: "#6366f1",
      sidebar: "#1e1e32",
    },
  },
};
