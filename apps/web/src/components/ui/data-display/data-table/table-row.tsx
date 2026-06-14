"use client";

import * as React from "react";
import type { Row } from "@tanstack/react-table";
import { TableRow, TableCell } from "@repo/ui/primitives/table";
import { flexRender } from "@tanstack/react-table";
import { cn } from "@repo/ui/utils";

interface TableRowProps<TData> {
  row: Row<TData>;
  enableRowSelection: boolean;
  hasSelection: boolean;
  onRowClick?: (row: TData) => void;
  getRowHref?: (row: TData) => string;
  renderRowWrapper?: (row: TData, children: React.ReactNode) => React.ReactNode;
  rowClassName?: string | ((row: TData) => string);
}

function TableRowComponentImpl<TData>({
  row,
  enableRowSelection,
  hasSelection,
  onRowClick,
  getRowHref,
  renderRowWrapper,
  rowClassName,
}: TableRowProps<TData>) {
  const isSelected = enableRowSelection && row.getIsSelected();

  const handleRowClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Always prevent navigation when clicking on interactive elements
    if (
      target.closest("button") ||
      target.closest('[role="checkbox"]') ||
      target.closest('[data-action="true"]') ||
      target.closest('[data-select="true"]') ||
      target.closest('input[type="checkbox"]') ||
      target.closest("label")
    ) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // When row selection is enabled AND at least one item is selected,
    // clicking row should toggle selection (multi-select mode)
    if (enableRowSelection && hasSelection) {
      e.preventDefault();
      e.stopPropagation();
      row.toggleSelected();
      return;
    }

    // Navigate when not in multi-select mode
    if (onRowClick) {
      onRowClick(row.original);
    } else if (getRowHref) {
      const href = getRowHref(row.original);
      if (href) {
        window.location.href = href;
      }
    }
  };

  const rowContent = (
    <TableRow
      key={row.id}
      data-state={isSelected ? "selected" : undefined}
      className={cn(
        "group h-[48px] transition-none hover:bg-muted/50 border-0",
        // Show pointer cursor when row is clickable
        ((onRowClick || getRowHref) && !(enableRowSelection && hasSelection)) ||
          (enableRowSelection && hasSelection)
          ? "cursor-pointer"
          : "",
        typeof rowClassName === "function"
          ? rowClassName(row.original)
          : rowClassName,
        isSelected && "bg-muted/70",
      )}
      onClick={handleRowClick}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (
          target.closest('[role="checkbox"]') ||
          target.closest('[data-select="true"]') ||
          target.closest('input[type="checkbox"]')
        ) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }}
    >
      {row.getVisibleCells().map((cell, index) => {
        const columnMeta = cell.column.columnDef.meta as
          | { align?: "left" | "right" | "center" }
          | undefined;
        const align = columnMeta?.align || "left";
        const cellSize = cell.column.getSize();

        return (
          <TableCell
            key={cell.id}
            className={cn(
              "whitespace-nowrap py-2 px-4 align-middle",
              align === "right"
                ? "text-right"
                : align === "center"
                  ? "text-center"
                  : "text-left",
              cell.column.id === "select" ? "w-8 px-0" : "",
              index === 0 && cell.column.id !== "select" ? "pl-6" : "",
              index === row.getVisibleCells().length - 1 ? "pr-6" : "",
            )}
            style={{
              width: cell.column.columnDef.size ? `${cellSize}px` : undefined,
              minWidth: cell.column.columnDef.size
                ? `${cellSize}px`
                : undefined,
            }}
            data-select={cell.column.id === "select" ? "true" : undefined}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        );
      })}
    </TableRow>
  );

  if (renderRowWrapper) {
    return renderRowWrapper(row.original, rowContent);
  }

  // Handle href navigation via onClick instead of wrapping <tr> in <a>
  if (getRowHref) {
    if (enableRowSelection) {
      return rowContent;
    }

    const href = getRowHref(row.original);
    const enhancedRowContent = React.cloneElement(
      rowContent as React.ReactElement<Record<string, unknown>>,
      {
        onClick: (e: React.MouseEvent) => {
          const target = e.target as HTMLElement;
          if (
            target.closest("button") ||
            target.closest('[role="checkbox"]') ||
            target.closest('[data-action="true"]') ||
            target.closest('[data-select="true"]') ||
            target.closest('input[type="checkbox"]')
          ) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }

          if (onRowClick) {
            onRowClick(row.original);
          } else if (href) {
            window.location.href = href;
          }
        },
        role: "link",
        "data-href": href,
      },
    );

    return enhancedRowContent;
  }

  return rowContent;
}

/**
 * Memoized row component. With stable callbacks/rowClassName from the parent,
 * rows skip re-render when only sibling rows change (e.g. selecting one row
 * no longer flashes every row in the table). TanStack `Row` instances are
 * reference-stable across renders when `data` reference is stable, so the
 * default shallow compare from `React.memo` is sufficient.
 *
 * The wrapper preserves the generic <TData> so consumers keep their types.
 */
export const TableRowComponent = React.memo(TableRowComponentImpl) as <TData>(
  props: TableRowProps<TData>,
) => React.ReactElement | null;

