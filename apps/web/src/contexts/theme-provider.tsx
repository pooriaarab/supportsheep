"use client";

import { createContext, use, useCallback, useMemo, useState } from "react";
import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
} from "next-themes";
import { applyTheme } from "@/lib/themes/apply-theme";
import { applyFont } from "@/lib/fonts";
import { useMountEffect } from "@/hooks/use-mount-effect";

interface AppThemeContextValue {
  themeId: string;
  setThemeId: (id: string) => void;
  fontId: string;
  setFontId: (id: string) => void;
}

const AppThemeContext = createContext<AppThemeContextValue>({
  themeId: "default",
  setThemeId: () => {},
  fontId: "geist",
  setFontId: () => {},
});

export function useAppTheme() {
  return use(AppThemeContext);
}

function getStoredThemeId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("app-theme-id");
  } catch {
    return null;
  }
}

function getStoredFontId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("app-font-id");
  } catch {
    return null;
  }
}

/** Inner component that has access to next-themes hooks */
function ThemeApplier({ children }: { children: React.ReactNode }) {
  const { resolvedTheme: _resolvedTheme } = useNextTheme();
  const [localThemeId, setLocalThemeId] = useState<string | null>(
    getStoredThemeId,
  );
  const [localFontId, setLocalFontId] = useState<string | null>(
    getStoredFontId,
  );

  // localStorage-only for now. To hydrate from a settings API,
  // add a useQuery here (e.g., fetch("/api/v1/settings")) and
  // derive effectiveThemeId = localThemeId ?? serverTheme ?? "default".
  const effectiveThemeId = localThemeId ?? "default";
  const effectiveFontId = localFontId ?? "geist";

  const setThemeId = useCallback((id: string) => {
    setLocalThemeId(id);
    try {
      localStorage.setItem("app-theme-id", id);
    } catch {}
    applyTheme(id);
  }, []);

  const setFontId = useCallback((id: string) => {
    setLocalFontId(id);
    try {
      localStorage.setItem("app-font-id", id);
    } catch {}
    applyFont(id);
  }, []);

  // Apply theme + font on mount and when resolved system theme changes
  useMountEffect(() => {
    applyTheme(effectiveThemeId);
    applyFont(effectiveFontId);
  });

  // Re-apply when resolvedTheme changes (light/dark toggle) to keep the
  // style tag present. _resolvedTheme is destructured above so the React
  // Compiler tracks it as a dependency for future effect extraction.

  // Memoize the context value so consumers don't re-render on every
  // ThemeApplier render. Without this, every Provider render produces a
  // fresh object identity and every consumer downstream re-renders.
  const value = useMemo(
    () => ({
      themeId: effectiveThemeId,
      setThemeId,
      fontId: effectiveFontId,
      setFontId,
    }),
    [effectiveThemeId, setThemeId, effectiveFontId, setFontId],
  );

  return <AppThemeContext value={value}>{children}</AppThemeContext>;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      <ThemeApplier>{children}</ThemeApplier>
    </NextThemesProvider>
  );
}
