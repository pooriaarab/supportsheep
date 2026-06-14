import type { ThemePreset, ThemeId } from "../types";
import { THEME_IDS } from "../types";
import { defaultTheme } from "./default";
import { nordTheme } from "./nord";
import { draculaTheme } from "./dracula";
import { catppuccinTheme } from "./catppuccin";
import { githubTheme } from "./github";
import { solarizedTheme } from "./solarized";
import { rosePineTheme } from "./rose-pine";
import { tokyoNightTheme } from "./tokyo-night";

/** All available theme presets indexed by ID */
export const THEME_PRESETS: Record<ThemeId, ThemePreset> = {
  default: defaultTheme,
  nord: nordTheme,
  dracula: draculaTheme,
  catppuccin: catppuccinTheme,
  github: githubTheme,
  solarized: solarizedTheme,
  "rose-pine": rosePineTheme,
  "tokyo-night": tokyoNightTheme,
};

/** Get a theme preset by ID, falling back to default */
export function getThemePreset(id: string): ThemePreset {
  return THEME_PRESETS[id as ThemeId] ?? THEME_PRESETS.default;
}

/** Get all available themes as an array, ordered for display */
export function getAvailableThemes(): ThemePreset[] {
  return THEME_IDS.map((id) => THEME_PRESETS[id]);
}
