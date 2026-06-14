"use client";

import { useCallback, useState, useRef } from "react";
import { useMountEffect } from "@/hooks/use-mount-effect";
import type {
  VisibilityState,
  ColumnSizingState,
  ColumnPinningState,
  ColumnOrderState,
} from "@tanstack/react-table";
import { createLogger } from "@/lib/logger";
import { getErrorMessage } from "@/lib/error-utils";

const log = createLogger("hook:table-settings");

export interface TableSettings {
  columnVisibility?: VisibilityState;
  columnSizing?: ColumnSizingState;
  columnPinning?: ColumnPinningState;
  columnOrder?: ColumnOrderState;
}

interface UseTableSettingsOptions {
  tableId: string;
  initialSettings?: TableSettings;
  debounceMs?: number;
}

/**
 * Hook for persisting table settings (column visibility, sizing, pinning, order) to localStorage.
 *
 * @example
 * ```tsx
 * const { settings, updateSettings } = useTableSettings({
 *   tableId: 'users-table',
 *   initialSettings: { columnVisibility: { email: true, name: true } },
 * });
 * ```
 */
export function useTableSettings({
  tableId,
  initialSettings,
  debounceMs = 500,
}: UseTableSettingsOptions) {
  const [settings, setSettings] = useState<TableSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(`table-settings-${tableId}`);
        if (stored) {
          const parsed: unknown = JSON.parse(stored);
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            !Array.isArray(parsed)
          ) {
            return {
              ...initialSettings,
              ...(parsed as Partial<TableSettings>),
            };
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
    return initialSettings || {};
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveToStorage = useCallback(
    (newSettings: TableSettings) => {
      if (typeof window === "undefined") return;

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(
            `table-settings-${tableId}`,
            JSON.stringify(newSettings),
          );
        } catch (error: unknown) {
          log.error("Failed to save table settings", {
            error: getErrorMessage(error),
          });
        }
      }, debounceMs);
    },
    [tableId, debounceMs],
  );

  useMountEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  });

  const updateSettings = useCallback(
    (updates: Partial<TableSettings>) => {
      setSettings((prev) => {
        const newSettings = { ...prev, ...updates };
        saveToStorage(newSettings);
        return newSettings;
      });
    },
    [saveToStorage],
  );

  const mergedSettings = initialSettings?.columnVisibility
    ? { ...settings, columnVisibility: initialSettings.columnVisibility }
    : settings;

  return {
    settings: mergedSettings,
    updateSettings,
  };
}
