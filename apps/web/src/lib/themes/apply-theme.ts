import type { ThemeColors } from "./types";
import { getThemePreset } from "./presets";

const STYLE_TAG_ID = "app-theme-overrides";

/** Build a CSS block from theme color overrides */
function buildCSSBlock(selector: string, colors: ThemeColors): string {
  const entries = Object.entries(colors);
  if (entries.length === 0) return "";
  const vars = entries
    .map(([name, value]) => `  --${name}: ${value};`)
    .join("\n");
  return `${selector} {\n${vars}\n}`;
}

/**
 * Apply a theme by injecting/updating a <style> tag with CSS variable overrides.
 * Both light and dark CSS blocks are injected simultaneously; CSS selectors handle mode switching.
 *
 * @param themeId - The theme preset ID to apply
 */
export function applyTheme(themeId: string): void {
  if (typeof document === "undefined") return;

  const theme = getThemePreset(themeId);

  // Default theme = no overrides needed
  if (themeId === "default" || (!theme.light && !theme.dark)) {
    removeThemeOverrides();
    return;
  }

  const blocks: string[] = [];

  // Light mode overrides
  if (theme.light && Object.keys(theme.light).length > 0) {
    blocks.push(buildCSSBlock(":root:not(.dark)", theme.light));
  }

  // Dark mode overrides
  if (theme.dark && Object.keys(theme.dark).length > 0) {
    blocks.push(buildCSSBlock(".dark", theme.dark));
  }

  if (blocks.length === 0) {
    removeThemeOverrides();
    return;
  }

  const css = blocks.join("\n\n");
  let styleEl = document.getElementById(
    STYLE_TAG_ID,
  ) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_TAG_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = css;

  try {
    localStorage.setItem("app-theme-css", css);
  } catch {}
}

/** Remove the theme override style tag (revert to default) */
export function removeThemeOverrides(): void {
  if (typeof document === "undefined") return;
  const styleEl = document.getElementById(STYLE_TAG_ID);
  if (styleEl) styleEl.remove();
  try {
    localStorage.removeItem("app-theme-css");
  } catch {}
}
