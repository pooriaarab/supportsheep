"use client";
"use no memo";

/**
 * DataTable - A reusable, composable table component built on TanStack Table
 *
 * Features:
 * - Virtualization for performance with large datasets (1000+ rows)
 * - Column filtering with faceted filters
 * - Column sorting with visual indicators
 * - Column visibility toggle with localStorage persistence
 * - Column resizing
 * - Column pinning (sticky columns)
 * - Row selection with shift-click range selection
 * - Pagination
 * - Global filter (search within table)
 *
 * @example
 * ```tsx
 * // Basic usage
 * <DataTable
 *   columns={columns}
 *   data={data}
 *   onRowClick={(row) => console.log(row)}
 * />
 *
 * // With persistent settings
 * <DataTable
 *   tableId="users-table"
 *   columns={columns}
 *   data={users}
 * />
 *
 * // With virtualization for large datasets
 * <DataTable
 *   columns={columns}
 *   data={users}
 *   enableVirtualization
 *   estimatedRowHeight={48}
 * />
 * ```
 */

import * as React from "react";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { useMountEffect } from "@/hooks/use-mount-effect";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  type ColumnDef,
  type Row,
  type SortingState,
  type TableOptions,
  type RowSelectionState,
  type ColumnFiltersState,
  type ColumnOrderState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TableHeader, TableRow } from "@repo/ui/primitives/table";
import { useTableSettings } from "@/hooks/table/use-table-settings";
import { createSelectionColumn } from "./selection-column";
import { TableHeaderCell } from "./table-header-cell";
import { TableRowComponent } from "./table-row";
import { VirtualizedTableBody } from "./virtualized-table-body";
import { GlobalFilter } from "./global-filter";
import { cn } from "@repo/ui/utils";
import type { TableSettings } from "@/hooks/table/use-table-settings";

export type { FilterItem } from "./types";
export type { TableSettings };

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onRowClick?: (row: TData) => void;
  emptyMessage?: string;
  emptyState?: React.ReactNode;
  rowClassName?: string | ((row: TData) => string);
  headerClassName?: string;
  className?: string;
  enableSorting?: boolean;
  enableRowSelection?: boolean;
  getRowHref?: (row: TData) => string;
  renderRowWrapper?: (row: TData, children: React.ReactNode) => React.ReactNode;
  bulkActions?: (
    selectedRows: TData[],
    clearSelection: () => void,
  ) => React.ReactNode;
  getRowId?: (row: TData) => string;
  enableColumnFilters?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
  onSelectionChange?: (selectedRows: TData[]) => void;
  // Virtualization options
  enableVirtualization?: boolean;
  estimatedRowHeight?: number;
  virtualizationOverscan?: number;
  // Column features
  enableColumnResizing?: boolean;
  enableColumnPinning?: boolean;
  enableColumnVisibility?: boolean;
  enableColumnReordering?: boolean;
  // Global filtering
  enableGlobalFilter?: boolean;
  globalFilterPlaceholder?: string;
  // Persistent settings
  tableId?: string;
  initialSettings?: TableSettings;
  // Controlled sorting
  sorting?: SortingState;
  onSortingChange?: (sorting: SortingState) => void;
  // Expose table instance and controls
  onTableReady?: (table: ReturnType<typeof useReactTable<TData>>) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onRowClick,
  emptyMessage = "No results.",
  emptyState,
  rowClassName,
  headerClassName,
  className,
  enableSorting = true,
  enableRowSelection = false,
  getRowHref,
  renderRowWrapper,
  bulkActions,
  getRowId,
  enableColumnFilters = false,
  enablePagination = false,
  pageSize = 10,
  onSelectionChange,
  enableVirtualization = false,
  estimatedRowHeight = 48,
  virtualizationOverscan = 5,
  enableColumnResizing = false,
  enableColumnPinning = false,
  enableColumnVisibility = true,
  enableColumnReordering = false,
  enableGlobalFilter = false,
  globalFilterPlaceholder = "Search...",
  tableId,
  initialSettings,
  sorting: controlledSorting,
  onSortingChange: controlledOnSortingChange,
  onTableReady,
}: DataTableProps<TData, TValue>) {
  const [internalSorting, setInternalSorting] = React.useState<SortingState>(
    controlledSorting ?? [],
  );
  const sorting =
    controlledSorting && controlledOnSortingChange
      ? controlledSorting
      : internalSorting;
  const setSorting = controlledOnSortingChange ?? setInternalSorting;
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [globalFilter, setGlobalFilter] = React.useState<string>("");
  const lastClickedRowIdRef = React.useRef<string | null>(null);
  const { settings, updateSettings } = useTableSettings({
    tableId: tableId || "default-table",
    initialSettings,
    debounceMs: 500,
  });

  // Initialize column order from settings
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(() => {
    if (settings.columnOrder && settings.columnOrder.length > 0) {
      return settings.columnOrder;
    }
    return [];
  });
  // Derived sync — adopt settings.columnOrder when it arrives (e.g. after
  // localStorage rehydrates) but only if the local order hasn't diverged yet.
  // See: https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastSyncedColumnOrder, setLastSyncedColumnOrder] = React.useState(
    settings.columnOrder,
  );
  if (
    settings.columnOrder !== lastSyncedColumnOrder &&
    settings.columnOrder &&
    settings.columnOrder.length > 0 &&
    columnOrder.length === 0
  ) {
    setLastSyncedColumnOrder(settings.columnOrder);
    setColumnOrder(settings.columnOrder);
  } else if (settings.columnOrder !== lastSyncedColumnOrder) {
    setLastSyncedColumnOrder(settings.columnOrder);
  }
  const [draggedColumnId, setDraggedColumnId] = React.useState<string | null>(
    null,
  );

  // Refs for virtualization
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  // Check if any row is selected
  const hasSelection = React.useMemo(() => {
    return enableRowSelection && Object.keys(rowSelection).length > 0;
  }, [enableRowSelection, rowSelection]);

  // Add selection column if enabled
  const columnsWithSelection = React.useMemo<ColumnDef<TData, TValue>[]>(() => {
    if (!enableRowSelection) return columns;
    return [
      createSelectionColumn({
        rowSelection,
        hasSelection,
        getRowId,
        lastClickedRowIdRef,
      }),
      ...columns,
    ];
  }, [columns, enableRowSelection, rowSelection, hasSelection, getRowId]);

  // Handle column reordering
  const handleColumnDragStart = React.useCallback(
    (e: React.DragEvent, columnId: string) => {
      setDraggedColumnId(columnId);
    },
    [],
  );

  const handleColumnDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleColumnDragEnd = React.useCallback(() => {
    setDraggedColumnId(null);
  }, []);

  const handleColumnDrop = React.useCallback(
    (e: React.DragEvent, targetColumnId: string, allColumnIds: string[]) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData("text/plain");
      if (!draggedId || draggedId === targetColumnId) return;

      const currentOrder = columnOrder.length > 0 ? columnOrder : allColumnIds;
      const draggedIndex = currentOrder.indexOf(draggedId);
      const targetIndex = currentOrder.indexOf(targetColumnId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      const newOrder = [...currentOrder];
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedId);

      setColumnOrder(newOrder);
      updateSettings({ columnOrder: newOrder });
      setDraggedColumnId(null);
    },
    [columnOrder, updateSettings],
  );

  // Initialize column pinning state
  const [columnPinning, setColumnPinning] = React.useState<{
    left?: string[];
    right?: string[];
  }>(() => settings.columnPinning || { left: [], right: [] });

  // Initialize column sizing state
  const [columnSizing, setColumnSizing] = React.useState<
    Record<string, number>
  >(() => {
    if (
      settings.columnSizing &&
      Object.keys(settings.columnSizing).length > 0
    ) {
      return settings.columnSizing;
    }
    const initialSizing: Record<string, number> = {};
    columns.forEach((col) => {
      if (col.size !== undefined && col.id) {
        initialSizing[col.id] = col.size;
      }
    });
    return initialSizing;
  });

  // Create table instance
  const table = useReactTable({
    data,
    columns: columnsWithSelection,
    columnOrder: columnOrder.length > 0 ? columnOrder : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel:
      enableColumnFilters || enableGlobalFilter
        ? getFilteredRowModel()
        : undefined,
    getFacetedRowModel: enableColumnFilters ? getFacetedRowModel() : undefined,
    getPaginationRowModel: enablePagination
      ? getPaginationRowModel()
      : undefined,
    enableColumnResizing: enableColumnResizing,
    columnResizeMode: enableColumnResizing ? "onChange" : undefined,
    enableColumnPinning: enableColumnPinning,
    state: {
      columnPinning: enableColumnPinning
        ? columnPinning
        : { left: [], right: [] },
      columnVisibility: enableColumnVisibility
        ? settings.columnVisibility
        : undefined,
      columnSizing: columnSizing,
      sorting: enableSorting ? sorting : undefined,
      rowSelection: enableRowSelection ? rowSelection : undefined,
      columnFilters: enableColumnFilters ? columnFilters : undefined,
      globalFilter: enableGlobalFilter ? globalFilter : undefined,
    },
    onSortingChange: enableSorting ? setSorting : undefined,
    onRowSelectionChange: enableRowSelection
      ? (updater) => {
          if (typeof updater === "function") {
            setRowSelection((prev) => {
              const newSelection = updater(prev);
              return newSelection;
            });
          } else {
            setRowSelection(updater);
          }
        }
      : undefined,
    onColumnFiltersChange: enableColumnFilters ? setColumnFilters : undefined,
    onColumnVisibilityChange: enableColumnVisibility
      ? (updater) => {
          const newVisibility =
            typeof updater === "function"
              ? updater(settings.columnVisibility || {})
              : updater;
          updateSettings({ columnVisibility: newVisibility });
        }
      : undefined,
    onColumnSizingChange: enableColumnResizing
      ? (updater) => {
          const newSizing =
            typeof updater === "function"
              ? updater(columnSizing || {})
              : updater;
          setColumnSizing(newSizing);
          updateSettings({ columnSizing: newSizing });
        }
      : undefined,
    onColumnPinningChange: enableColumnPinning
      ? (updater) => {
          const newPinning =
            typeof updater === "function"
              ? updater(columnPinning || { left: [], right: [] })
              : updater;
          setColumnPinning(newPinning);
          updateSettings({ columnPinning: newPinning });
        }
      : undefined,
    onColumnOrderChange: enableColumnReordering ? setColumnOrder : undefined,
    onGlobalFilterChange: enableGlobalFilter ? setGlobalFilter : undefined,
    globalFilterFn: enableGlobalFilter
      ? (row, columnId, filterValue) => {
          const searchValue = String(filterValue).toLowerCase();
          return row.getVisibleCells().some((cell) => {
            const value = String(cell.getValue()).toLowerCase();
            return value.includes(searchValue);
          });
        }
      : undefined,
    enableRowSelection: enableRowSelection,
    getRowId:
      getRowId ||
      ((row, index) => (row as { id?: string }).id || String(index)),
    initialState: {
      pagination: enablePagination ? { pageSize } : undefined,
      columnVisibility: settings.columnVisibility,
      columnSizing: settings.columnSizing || {},
      columnPinning: settings.columnPinning || { left: [], right: [] },
      columnOrder: settings.columnOrder,
    },
  } as TableOptions<TData>);

  // Expose table instance to parent
  const onTableReadyRef = useLatestRef(onTableReady);

  const hasNotifiedRef = React.useRef(false);
  const tableRef = useLatestRef(table);

  useMountEffect(() => {
    if (hasNotifiedRef.current) return;
    if (!tableRef.current || !onTableReadyRef.current) return;
    hasNotifiedRef.current = true;
    const notify = () => {
      if (onTableReadyRef.current && tableRef.current) {
        onTableReadyRef.current(tableRef.current);
      }
    };
    if (
      typeof window !== "undefined" &&
      typeof requestAnimationFrame !== "undefined"
    ) {
      requestAnimationFrame(notify);
    } else {
      notify();
    }
  });

  // Virtualization setup
  const { rows } = table.getRowModel();
  const rowsLength = rows.length;

  const getScrollElement = React.useCallback(
    () => tableContainerRef.current,
    [],
  );
  const estimateSize = React.useCallback(
    () => estimatedRowHeight,
    [estimatedRowHeight],
  );

  const rowVirtualizer = useVirtualizer({
    count: enableVirtualization ? rowsLength : 0,
    getScrollElement,
    estimateSize,
    overscan: virtualizationOverscan,
  });

  // Get selected rows for bulk actions
  const selectedRows = React.useMemo(() => {
    if (!enableRowSelection) return [];
    const selectedRowIds = Object.keys(rowSelection);
    if (selectedRowIds.length === 0) return [];

    const allRows = table.getRowModel().rows;
    return allRows.reduce<TData[]>((selected, row) => {
      const rowId = getRowId ? getRowId(row.original) : row.id;
      if (rowSelection[rowId] === true) {
        selected.push(row.original);
      }
      return selected;
    }, []);
  }, [table, enableRowSelection, rowSelection, getRowId]);

  // Notify parent of selection changes
  const lastSelectionRef = React.useRef<string>("");
  const onSelectionChangeRef = useLatestRef(onSelectionChange);

  // Reactive: notify parent whenever the selected rows change. This is the
  // legitimate (non-mount) use of useEffect because we must respond to a
  // value derived from external state (rowSelection + table data).
  React.useEffect(() => {
    if (enableRowSelection && onSelectionChangeRef.current) {
      const key = JSON.stringify(
        selectedRows.map((row) => (row as { id?: string }).id ?? row),
      );
      if (key !== lastSelectionRef.current) {
        lastSelectionRef.current = key;
        if (
          typeof window !== "undefined" &&
          typeof requestAnimationFrame !== "undefined"
        ) {
          requestAnimationFrame(() => {
            if (onSelectionChangeRef.current) {
              onSelectionChangeRef.current(selectedRows);
            }
          });
        } else {
          if (onSelectionChangeRef.current) {
            onSelectionChangeRef.current(selectedRows);
          }
        }
      }
    }
    // onSelectionChangeRef is a stable useLatestRef -- intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableRowSelection, selectedRows]);

  // Clear selection function
  const clearSelection = React.useCallback(() => {
    if (enableRowSelection) {
      setRowSelection({});
    }
  }, [enableRowSelection]);

  // NOTE: `table` is intentionally NOT in the dep array. The callback never
  // reads from `table` -- the row arg is already passed in by the body
  // component. Including `table` would invalidate this callback on every
  // render (TanStack returns a fresh `table` instance per render), which in
  // turn invalidates every memoized TableRowComponent below.
  const renderRow = React.useCallback(
    (row: Row<TData>) => {
      return (
        <TableRowComponent
          key={row.id}
          row={row}
          enableRowSelection={enableRowSelection}
          hasSelection={hasSelection}
          onRowClick={onRowClick}
          getRowHref={getRowHref}
          renderRowWrapper={renderRowWrapper}
          rowClassName={rowClassName}
        />
      );
    },
    [
      enableRowSelection,
      hasSelection,
      onRowClick,
      getRowHref,
      renderRowWrapper,
      rowClassName,
    ],
  );

  return (
    <div
      className={cn(
        "relative flex-1 flex flex-col overflow-hidden bg-muted/20",
        className,
      )}
    >
      {/* Global Filter */}
      {enableGlobalFilter && (
        <div className="px-4 py-2 border-b">
          <GlobalFilter
            value={globalFilter}
            onChange={setGlobalFilter}
            placeholder={globalFilterPlaceholder}
          />
        </div>
      )}

      {/* Bulk Actions Bar */}
      {enableRowSelection && selectedRows.length > 0 && bulkActions && (
        <div className="sticky top-[1px] z-[999] bg-background border-b shadow-sm px-4 py-2">
          {bulkActions(selectedRows, clearSelection)}
        </div>
      )}

      {/* Table Container */}
      <div
        ref={tableContainerRef}
        className={cn("relative flex-1 overflow-auto overscroll-x-none")}
      >
        <Table className="w-full caption-bottom text-sm">
          <TableHeader
            className={cn("bg-muted/50 [&_tr]:border-b-0", headerClassName)}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="transition-colors border-0 hover:bg-transparent"
              >
                {headerGroup.headers.map((header, index) => (
                  <TableHeaderCell
                    key={header.id}
                    header={header}
                    index={index}
                    totalHeaders={headerGroup.headers.length}
                    enableSorting={enableSorting}
                    enableColumnResizing={enableColumnResizing}
                    enableColumnReordering={enableColumnReordering}
                    draggedColumnId={draggedColumnId}
                    onColumnDragStart={handleColumnDragStart}
                    onColumnDragOver={handleColumnDragOver}
                    onColumnDragEnd={handleColumnDragEnd}
                    onColumnDrop={(e, columnId) =>
                      handleColumnDrop(
                        e,
                        columnId,
                        table.getAllColumns().map((c) => c.id),
                      )
                    }
                  />
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <VirtualizedTableBody
            rows={rows}
            rowVirtualizer={enableVirtualization ? rowVirtualizer : null}
            columnsCount={table.getVisibleLeafColumns().length}
            emptyState={emptyState}
            emptyMessage={emptyMessage}
            renderRow={renderRow}
            isVirtualized={enableVirtualization}
          />
        </Table>
      </div>
    </div>
  );
}
