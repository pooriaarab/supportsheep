import { useMemo, useCallback, type SetStateAction } from "react";
import type { SortingState } from "@tanstack/react-table";
import type {
  DisplaySettings,
  DisplayProperty,
} from "@repo/ui/composites/display-popover";

/**
 * Derives DataTable sorting + column visibility from DisplaySettings.
 *
 * Eliminates the duplicated useMemo/callback boilerplate that was
 * copy-pasted across multiple pages.
 */
export function useDataTableDisplay(
  displaySettings: DisplaySettings,
  setDisplaySettings: (s: SetStateAction<DisplaySettings>) => void,
  displayProperties: readonly DisplayProperty[],
) {
  const sorting = useMemo<SortingState>(
    () => [
      {
        id: displaySettings.ordering,
        desc: displaySettings.orderDirection === "desc",
      },
    ],
    [displaySettings.ordering, displaySettings.orderDirection],
  );

  const columnVisibility = useMemo(() => {
    const visibility: Record<string, boolean> = {};
    for (const prop of displayProperties) {
      visibility[prop.id] = displaySettings.visibleProperties.has(prop.id);
    }
    return visibility;
  }, [displaySettings.visibleProperties, displayProperties]);

  const onSortingChange = useCallback(
    (s: SortingState) => {
      if (s.length > 0) {
        setDisplaySettings((prev) => ({
          ...prev,
          ordering: s[0].id,
          orderDirection: s[0].desc ? "desc" : "asc",
        }));
      }
    },
    [setDisplaySettings],
  );

  return { sorting, columnVisibility, onSortingChange };
}
