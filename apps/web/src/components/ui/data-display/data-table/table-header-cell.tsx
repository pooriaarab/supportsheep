"use client";

import * as React from "react";
import type { Header } from "@tanstack/react-table";
import { TableHead } from "@repo/ui/primitives/table";
import { flexRender } from "@tanstack/react-table";
import { cn } from "@repo/ui/utils";
import { ColumnReorderHandle } from "./column-reorder";

interface TableHeaderCellProps<TData, TValue> {
  header: Header<TData, TValue>;
  index: number;
  totalHeaders: number;
  enableSorting?: boolean;
  enableColumnResizing: boolean;
  enableColumnReordering?: boolean;
  draggedColumnId?: string | null;
  onColumnDragStart?: (e: React.DragEvent, columnId: string) => void;
  onColumnDragOver?: (e: React.DragEvent, columnId: string) => void;
  onColumnDragEnd?: () => void;
  onColumnDrop?: (e: React.DragEvent, columnId: string) => void;
}

export function TableHeaderCell<TData, TValue>({
  header,
  index,
  totalHeaders,
  enableColumnResizing,
  enableColumnReordering = false,
  draggedColumnId,
  onColumnDragStart,
  onColumnDragOver,
  onColumnDragEnd,
  onColumnDrop,
}: TableHeaderCellProps<TData, TValue>) {
  const isDragging = draggedColumnId === header.id;
  const columnMeta = header.column.columnDef.meta as
    | { align?: "left" | "right" | "center" }
    | undefined;
  const align = columnMeta?.align || "left";

  return (
    <TableHead
      key={header.id}
      className={cn(
        "whitespace-nowrap px-4 align-middle font-medium sticky top-0 z-20 h-9 bg-muted after:absolute after:bottom-0 after:left-0 after:right-0 after:h-px after:bg-border text-muted-foreground",
        align === "right"
          ? "text-right"
          : align === "center"
            ? "text-center"
            : "text-left",
        index === 0 ? "pl-6" : "",
        index === totalHeaders - 1 ? "pr-6" : "",
        header.id === "select" ? "w-8 px-0" : "",
        header.column.getIsPinned() === "left" && "left-0 z-30",
        header.column.getIsPinned() === "right" && "right-0 z-30",
      )}
      style={{
        width: header.column.columnDef.size
          ? `${header.getSize()}px`
          : undefined,
        minWidth: header.column.columnDef.size
          ? `${header.getSize()}px`
          : undefined,
        maxWidth: enableColumnResizing ? header.getSize() : undefined,
        left:
          header.column.getIsPinned() === "left"
            ? `${header.column.getStart("left")}px`
            : undefined,
        right:
          header.column.getIsPinned() === "right"
            ? `${header.column.getAfter("right")}px`
            : undefined,
      }}
    >
      {header.isPlaceholder ? null : (
        <div className="flex items-center gap-2 relative group">
          {enableColumnReordering &&
            header.id !== "select" &&
            onColumnDragStart && (
              <ColumnReorderHandle
                header={header}
                isDragging={isDragging}
                onDragStart={onColumnDragStart}
                onDragOver={onColumnDragOver || (() => {})}
                onDragEnd={onColumnDragEnd || (() => {})}
                onDrop={onColumnDrop || (() => {})}
              />
            )}
          {enableColumnResizing && header.column.getCanResize() && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize column"
              tabIndex={0}
              onMouseDown={header.getResizeHandler()}
              onTouchStart={header.getResizeHandler()}
              className={cn(
                "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-border opacity-0 transition-opacity hover:opacity-100 focus:opacity-100",
                header.column.getIsResizing() && "opacity-100 bg-primary",
              )}
            />
          )}
          <div className="flex items-center gap-1">
            {flexRender(header.column.columnDef.header, header.getContext())}
          </div>
        </div>
      )}
    </TableHead>
  );
}
