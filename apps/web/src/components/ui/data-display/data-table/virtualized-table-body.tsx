"use client";

import * as React from "react";
import type { Row } from "@tanstack/react-table";
import { TableBody, TableRow, TableCell } from "@repo/ui/primitives/table";
import type { Virtualizer } from "@tanstack/react-virtual";

interface VirtualizedTableBodyProps<TData> {
  rows: Row<TData>[];
  rowVirtualizer: Virtualizer<HTMLDivElement, Element> | null;
  columnsCount: number;
  emptyState?: React.ReactNode;
  emptyMessage?: string;
  renderRow: (row: Row<TData>) => React.ReactNode;
  isVirtualized?: boolean;
}

export function VirtualizedTableBody<TData>({
  rows,
  rowVirtualizer,
  columnsCount,
  emptyState,
  emptyMessage,
  renderRow,
  isVirtualized = false,
}: VirtualizedTableBodyProps<TData>) {
  if (rows.length === 0) {
    return (
      <TableBody className="[&_tr:last-child]:border-0">
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={columnsCount} className="p-0">
            {emptyState || (
              <div className="flex flex-col items-center justify-center gap-6 px-6 pt-10 pb-40">
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted-foreground">
                    {emptyMessage}
                  </p>
                </div>
              </div>
            )}
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  // Non-virtualized rendering
  if (!isVirtualized || !rowVirtualizer) {
    return (
      <TableBody className="[&_tr:last-child]:border-0">
        {rows.map(renderRow)}
      </TableBody>
    );
  }

  // Virtualized rendering
  const virtualItems = rowVirtualizer ? rowVirtualizer.getVirtualItems() : [];
  const totalSize = rowVirtualizer ? rowVirtualizer.getTotalSize() : 0;

  return (
    <TableBody className="[&_tr:last-child]:border-0">
      {/* Spacer for rows before visible range */}
      {virtualItems.length > 0 && (
        <tr>
          <td
            colSpan={columnsCount}
            style={{
              height: `${virtualItems[0]?.start ?? 0}px`,
            }}
          />
        </tr>
      )}
      {/* Render visible rows */}
      {virtualItems.map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        return renderRow(row);
      })}
      {/* Spacer for rows after visible range */}
      {virtualItems.length > 0 && (
        <tr>
          <td
            colSpan={columnsCount}
            style={{
              height: `${totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)}px`,
            }}
          />
        </tr>
      )}
    </TableBody>
  );
}
