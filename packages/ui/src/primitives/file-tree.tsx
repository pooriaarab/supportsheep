"use client";

import * as React from "react";
import { ChevronRightIcon, FolderIcon, FolderOpenIcon, FileIcon } from "lucide-react";

import { cn } from "../utils";

export interface FileTreeItem {
  id: string;
  name: string;
  type: "file" | "directory";
  children?: FileTreeItem[];
  icon?: React.ComponentType<{ className?: string }>;
  meta?: Record<string, unknown>;
}

export interface FileTreeProps {
  items: FileTreeItem[];
  selectedId?: string;
  onSelect: (item: FileTreeItem) => void;
  onContextMenu?: (item: FileTreeItem, e: React.MouseEvent) => void;
  className?: string;
}

/**
 * Recursive file tree primitive with keyboard navigation,
 * expand/collapse, and context menu support.
 *
 * Purely presentational — consumer provides data and handlers.
 */
export function FileTree({
  items,
  selectedId,
  onSelect,
  onContextMenu,
  className,
}: FileTreeProps) {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Auto-expand directories that contain the selected item
    if (selectedId) {
      expandPathTo(items, selectedId, initial);
    }
    return initial;
  });
  const [focusedItemId, setFocusedItemId] = React.useState<string>();
  const focusedId = focusedItemId ?? selectedId;

  // Re-compute flat visible list based on expanded state
  const visibleItems = React.useMemo(
    () => flattenVisible(items, expandedIds),
    [items, expandedIds],
  );

  const toggleExpand = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      const currentIndex = visibleItems.findIndex((v) => v.item.id === focusedId);

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, visibleItems.length - 1);
          setFocusedItemId(visibleItems[nextIndex]?.item.id);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          setFocusedItemId(visibleItems[prevIndex]?.item.id);
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const current = visibleItems[currentIndex];
          if (current?.item.type === "directory") {
            if (!expandedIds.has(current.item.id)) {
              toggleExpand(current.item.id);
            } else if (current.item.children?.length) {
              // Move focus to first child
              const nextIndex = Math.min(currentIndex + 1, visibleItems.length - 1);
              setFocusedItemId(visibleItems[nextIndex]?.item.id);
            }
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const curr = visibleItems[currentIndex];
          if (curr?.item.type === "directory" && expandedIds.has(curr.item.id)) {
            toggleExpand(curr.item.id);
          } else if (curr && curr.depth > 0) {
            // Move focus to parent
            const parentEntry = findParent(items, curr.item.id);
            if (parentEntry) {
              setFocusedItemId(parentEntry.id);
            }
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          const selected = visibleItems[currentIndex];
          if (selected) {
            if (selected.item.type === "directory") {
              toggleExpand(selected.item.id);
            }
            onSelect(selected.item);
          }
          break;
        }
      }
    },
    [visibleItems, focusedId, expandedIds, toggleExpand, onSelect, items],
  );

  return (
    <div
      role="tree"
      aria-label="File tree"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn("text-sm outline-none", className)}
    >
      {items.map((item) => (
        <FileTreeNode
          key={item.id}
          item={item}
          depth={0}
          selectedId={selectedId}
          focusedId={focusedId}
          expandedIds={expandedIds}
          onSelect={onSelect}
          onToggleExpand={toggleExpand}
          onFocus={setFocusedItemId}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}

/* ── Internal Node Component ── */

interface FileTreeNodeProps {
  item: FileTreeItem;
  depth: number;
  selectedId?: string;
  focusedId?: string;
  expandedIds: Set<string>;
  onSelect: (item: FileTreeItem) => void;
  onToggleExpand: (id: string) => void;
  onFocus: (id: string) => void;
  onContextMenu?: (item: FileTreeItem, e: React.MouseEvent) => void;
}

function FileTreeNode({
  item,
  depth,
  selectedId,
  focusedId,
  expandedIds,
  onSelect,
  onToggleExpand,
  onFocus,
  onContextMenu,
}: FileTreeNodeProps) {
  const isDirectory = item.type === "directory";
  const isExpanded = expandedIds.has(item.id);
  const isSelected = item.id === selectedId;
  const isFocused = item.id === focusedId;

  const selectTreeItem = () => {
    onFocus(item.id);
    if (isDirectory) {
      onToggleExpand(item.id);
    }
    onSelect(item);
  };

  const openTreeItemContextMenu = (e: React.MouseEvent) => {
    onContextMenu?.(item, e);
  };

  const Icon = item.icon ?? getDefaultIcon(item, isExpanded);

  return (
    <div role="treeitem" aria-expanded={isDirectory ? isExpanded : undefined} aria-selected={isSelected}>
      <button
        type="button"
        onClick={selectTreeItem}
        onContextMenu={openTreeItemContextMenu}
        data-focused={isFocused || undefined}
        data-selected={isSelected || undefined}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-sm transition-colors",
          "hover:bg-accent/50",
          "outline-none data-[focused]:ring-1 data-[focused]:ring-ring",
          isSelected
            ? "bg-accent text-accent-foreground font-medium"
            : "text-foreground/80",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Chevron for directories */}
        {isDirectory ? (
          <ChevronRightIcon
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
              isExpanded && "rotate-90",
            )}
          />
        ) : (
          <span className="size-3.5 shrink-0" />
        )}

        {/* Icon */}
        <Icon className="size-4 shrink-0 text-muted-foreground" />

        {/* Label */}
        <span className="truncate">{item.name}</span>
      </button>

      {/* Children (rendered when expanded) */}
      {isDirectory && isExpanded && item.children && (
        <div role="group">
          {item.children.map((child) => (
            <FileTreeNode
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedId={selectedId}
              focusedId={focusedId}
              expandedIds={expandedIds}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onFocus={onFocus}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Helpers ── */

function getDefaultIcon(item: FileTreeItem, isExpanded: boolean) {
  if (item.type === "directory") {
    return isExpanded ? FolderOpenIcon : FolderIcon;
  }
  return FileIcon;
}

interface VisibleEntry {
  item: FileTreeItem;
  depth: number;
}

function flattenVisible(
  items: FileTreeItem[],
  expanded: Set<string>,
  depth = 0,
): VisibleEntry[] {
  const result: VisibleEntry[] = [];
  for (const item of items) {
    result.push({ item, depth });
    if (item.type === "directory" && expanded.has(item.id) && item.children) {
      result.push(...flattenVisible(item.children, expanded, depth + 1));
    }
  }
  return result;
}

function expandPathTo(
  items: FileTreeItem[],
  targetId: string,
  expanded: Set<string>,
): boolean {
  for (const item of items) {
    if (item.id === targetId) return true;
    if (item.type === "directory" && item.children) {
      if (expandPathTo(item.children, targetId, expanded)) {
        expanded.add(item.id);
        return true;
      }
    }
  }
  return false;
}

function findParent(items: FileTreeItem[], targetId: string, parent?: FileTreeItem): FileTreeItem | undefined {
  for (const item of items) {
    if (item.id === targetId) return parent;
    if (item.type === "directory" && item.children) {
      const found = findParent(item.children, targetId, item);
      if (found) return found;
    }
  }
  return undefined;
}
