"use client";

import * as React from "react";
import type { Header } from "@tanstack/react-table";
import { GripVertical } from "lucide-react";
import { cn } from "@repo/ui/utils";

interface ColumnReorderProps<TData, TValue> {
  header: Header<TData, TValue>;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, columnId: string) => void;
  onDragOver: (e: React.DragEvent, columnId: string) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, columnId: string) => void;
}

/**
 * Drag handle for column reordering.
 * Uses HTML5 drag-and-drop.
 */
export function ColumnReorderHandle<TData, TValue>({
  header,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: ColumnReorderProps<TData, TValue>) {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", header.id);
    onDragStart(e, header.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    onDragOver(e, header.id);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (onDrop) {
      onDrop(e, header.id);
    }
  };

  return (
    <button
      type="button"
      draggable
      aria-label={`Reorder ${header.id} column`}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={onDragEnd}
      onDrop={handleDrop}
      className={cn(
        "cursor-grab active:cursor-grabbing p-1 opacity-0 group-hover:opacity-100 transition-opacity",
        isDragging && "opacity-100",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <GripVertical className="size-4 text-muted-foreground" />
    </button>
  );
}
