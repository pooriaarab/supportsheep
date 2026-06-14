/** Font family definitions and application logic */

export interface FontDefinition {
  /** Unique kebab-case ID stored in settings */
  id: string;
  /** Human-readable display name */
  name: string;
  /** CSS variable name set by next/font/google (e.g., --font-inter) */
  cssVariable: string;
  /** Short description shown in the picker */
  description: string;
}

export const FONT_OPTIONS: FontDefinition[] = [
  {
    id: "geist",
    name: "Geist",
    cssVariable: "--font-geist-sans",
    description: "Clean & modern",
  },
  {
    id: "inter",
    name: "Inter",
    cssVariable: "--font-inter",
    description: "Neutral UI standard",
  },
  {
    id: "dm-sans",
    name: "DM Sans",
    cssVariable: "--font-dm-sans",
    description: "Geometric & friendly",
  },
  {
    id: "plus-jakarta-sans",
    name: "Plus Jakarta Sans",
    cssVariable: "--font-plus-jakarta-sans",
    description: "Rounded & warm",
  },
  {
    id: "space-grotesk",
    name: "Space Grotesk",
    cssVariable: "--font-space-grotesk",
    description: "Techy & distinctive",
  },
  {
    id: "ibm-plex-sans",
    name: "IBM Plex Sans",
    cssVariable: "--font-ibm-plex-sans",
    description: "Technical & structured",
  },
];

export const DEFAULT_FONT_ID = "geist";

const FONT_STYLE_TAG_ID = "app-font-overrides";

export function getFontById(id: string): FontDefinition | undefined {
  return FONT_OPTIONS.find((f) => f.id === id);
}

/**
 * Apply a font by injecting a <style> tag that overrides --font-sans.
 * The default font (geist) needs no override since it's already set in globals.css.
 */
export function applyFont(fontId: string): void {
  if (typeof document === "undefined") return;

  const font = getFontById(fontId);

  // Default font = no override needed
  if (!font || fontId === DEFAULT_FONT_ID) {
    removeFontOverrides();
    return;
  }

  const css = `:root { --font-sans: var(${font.cssVariable}); }`;

  let styleEl = document.getElementById(
    FONT_STYLE_TAG_ID,
  ) as HTMLStyleElement | null;

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = FONT_STYLE_TAG_ID;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = css;

  try {
    localStorage.setItem("app-font-css", css);
    localStorage.setItem("app-font-id", fontId);
  } catch {}
}

/** Remove the font override style tag (revert to default Geist) */
export function removeFontOverrides(): void {
  if (typeof document === "undefined") return;
  const styleEl = document.getElementById(FONT_STYLE_TAG_ID);
  if (styleEl) styleEl.remove();
  try {
    localStorage.removeItem("app-font-css");
    localStorage.removeItem("app-font-id");
  } catch {}
}
