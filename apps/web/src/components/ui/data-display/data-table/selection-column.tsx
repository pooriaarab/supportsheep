"use client";

import * as React from "react";
import type { ColumnDef, RowSelectionState } from "@tanstack/react-table";
import { Checkbox } from "@repo/ui/primitives/checkbox";
import { cn } from "@repo/ui/utils";

interface SelectionColumnProps<TData> {
  rowSelection: RowSelectionState;
  hasSelection: boolean;
  getRowId?: (row: TData) => string;
  lastClickedRowIdRef?: React.MutableRefObject<string | null>;
}

export function createSelectionColumn<TData>({
  rowSelection,
  hasSelection,
  getRowId,
  lastClickedRowIdRef,
}: SelectionColumnProps<TData>): ColumnDef<TData> {
  return {
    id: "select",
    header: ({ table }) => {
      const showCheckbox = Object.keys(rowSelection).length > 0;
      return (
        <div className="w-8 flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className={cn(showCheckbox ? "visible" : "invisible")}
          />
        </div>
      );
    },
    cell: ({ row, table }) => {
      const rowId = getRowId ? getRowId(row.original) : row.id;
      const isSelected = row.getIsSelected();
      const alwaysShow = isSelected || hasSelection;

      return (
        <div className="flex items-center justify-center w-8">
          <Checkbox
            checked={isSelected}
            disabled={!row.getCanSelect()}
            onCheckedChange={(checked) => {
              row.toggleSelected(!!checked);
            }}
            aria-label="Select row"
            className={cn(
              alwaysShow ? "visible" : "invisible group-hover:visible",
            )}
            onClick={(e) => {
              e.stopPropagation();

              if (
                e.shiftKey &&
                lastClickedRowIdRef &&
                lastClickedRowIdRef.current !== null
              ) {
                e.preventDefault();
                const checked = !isSelected;

                const allRows = table.getRowModel().rows;
                const allRowIds = allRows.map((r) => {
                  const id = getRowId ? getRowId(r.original) : r.id;
                  return id;
                });

                const lastIndex = allRowIds.indexOf(
                  lastClickedRowIdRef.current,
                );
                const currentIndex = allRowIds.indexOf(rowId);

                if (lastIndex !== -1 && currentIndex !== -1) {
                  const start = Math.min(lastIndex, currentIndex);
                  const end = Math.max(lastIndex, currentIndex);
                  const rangeRows = allRows.slice(start, end + 1);

                  rangeRows.forEach((rangeRow) => {
                    rangeRow.toggleSelected(checked);
                  });
                }
              }

              if (lastClickedRowIdRef) {
                lastClickedRowIdRef.current = rowId;
              }
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
            }}
          />
        </div>
      );
    },
    enableSorting: false,
    enableHiding: false,
    size: 32,
  };
}
