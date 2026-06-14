"use client";

import * as React from "react";

import { cn } from "../utils";

export interface ToolbarAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  isActive?: boolean;
  disabled?: boolean;
  onAction: () => void;
}

export interface EditorToolbarProps {
  actions: ToolbarAction[];
  /** "floating" renders as a bubble/pill; "fixed" renders as a top bar */
  variant?: "floating" | "fixed";
  className?: string;
}

/**
 * Presentational toolbar that renders a row of icon buttons with optional
 * active state and keyboard shortcut hints.
 *
 * Consumer provides which actions appear — the toolbar handles rendering only.
 */
export function EditorToolbar({
  actions,
  variant = "fixed",
  className,
}: EditorToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Editor toolbar"
      className={cn(
        "flex items-center gap-0.5",
        variant === "fixed" &&
          "border-b border-border bg-background px-2 py-1",
        variant === "floating" &&
          "rounded-lg border border-border bg-popover px-1.5 py-1 shadow-md",
        className,
      )}
    >
      {actions.map((action, index) => {
        // Insert separator before action if it has a different group
        // (detected by consecutive IDs containing "/" — e.g., "format/bold" vs "insert/link")
        const prevGroup = index > 0 ? getGroup(actions[index - 1].id) : null;
        const currentGroup = getGroup(action.id);
        const showSeparator = index > 0 && prevGroup !== currentGroup && prevGroup !== null && currentGroup !== null;

        return (
          <React.Fragment key={action.id}>
            {showSeparator && (
              <div
                role="separator"
                aria-orientation="vertical"
                className="mx-0.5 h-5 w-px bg-border"
              />
            )}
            <ToolbarButton action={action} />
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ── Internal Button ── */

function ToolbarButton({ action }: { action: ToolbarAction }) {
  const Icon = action.icon;

  return (
    <button
      type="button"
      onClick={action.onAction}
      disabled={action.disabled}
      title={
        action.shortcut
          ? `${action.label} (${action.shortcut})`
          : action.label
      }
      aria-label={action.label}
      aria-pressed={action.isActive}
      data-active={action.isActive || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[active]:bg-accent data-[active]:text-accent-foreground",
      )}
    >
      <Icon className="size-4" />
      {action.shortcut && (
        <span className="sr-only">({action.shortcut})</span>
      )}
    </button>
  );
}

/* ── Helpers ── */

function getGroup(id: string): string | null {
  const slashIndex = id.indexOf("/");
  return slashIndex > 0 ? id.slice(0, slashIndex) : null;
}
