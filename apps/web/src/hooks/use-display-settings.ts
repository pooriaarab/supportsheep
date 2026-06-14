"use client";

import { useCallback, type SetStateAction } from "react";
import {
  useDisplaySettings as useDisplaySettingsBase,
  type DisplaySettings,
} from "@repo/ui/composites/display-popover";
import { useLatestRef } from "@/hooks/use-latest-ref";

/**
 * Convenience wrapper around the base useDisplaySettings hook.
 *
 * Preserves the tuple API while accepting functional updates for app-level
 * callbacks that need the latest display settings.
 */
export function useDisplaySettings(
  key: string,
  defaults: DisplaySettings,
): readonly [
  DisplaySettings,
  (next: SetStateAction<DisplaySettings>) => void,
] {
  const [displaySettings, setBaseDisplaySettings] = useDisplaySettingsBase(
    key,
    defaults,
  );
  const displaySettingsRef = useLatestRef(displaySettings);

  const setDisplaySettings = useCallback(
    (next: SetStateAction<DisplaySettings>) => {
      const resolved =
        typeof next === "function"
          ? (next as (prev: DisplaySettings) => DisplaySettings)(
              displaySettingsRef.current,
            )
          : next;
      setBaseDisplaySettings(resolved);
    },
    [displaySettingsRef, setBaseDisplaySettings],
  );

  return [displaySettings, setDisplaySettings] as const;
}
