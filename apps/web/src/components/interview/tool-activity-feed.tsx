"use client";

import { Cog, AlertTriangle } from "lucide-react";
import type { ToolCallActivity } from "@/hooks/use-interview-session";
import { cn } from "@/lib/utils";

interface Props {
  /** Most-recent-first list of tool invocations observed on the SSE stream.
   * The hook caps + TTL-evicts entries; this component only renders. */
  toolCalls: ToolCallActivity[];
  /** How many rows to render. Defaults to 5 — enough to feel "live" without
   * dominating the canvas chrome. */
  visibleCount?: number;
  className?: string;
}

const DEFAULT_VISIBLE_COUNT = 5;

/**
 * Live activity feed showing the AI's most recent canvas tool calls
 * (set_title, insert_section, replace_text, …) while an interview is in
 * progress. Gives the user visibility into what the AI is actually doing
 * instead of just a static "AI is preparing the outline" spinner.
 *
 * Renders nothing when there are no recent calls so it doesn't take up
 * space during quiet stretches of the interview.
 */
export function ToolActivityFeed({
  toolCalls,
  visibleCount = DEFAULT_VISIBLE_COUNT,
  className,
}: Props) {
  if (toolCalls.length === 0) return null;
  const visible = toolCalls.slice(0, visibleCount);
  return (
    <ol
      role="log"
      aria-live="polite"
      aria-label="Recent AI tool activity"
      className={cn(
        "flex flex-col gap-1 text-xs text-muted-foreground",
        className,
      )}
    >
      {visible.map((entry) => (
        <li
          key={entry.key}
          className={cn(
            "flex items-center gap-2 px-2.5 py-1.5 rounded-md border bg-card/60 backdrop-blur-sm transition-colors duration-200 ease-out",
            entry.status === "failed"
              ? "border-destructive/30 text-destructive"
              : "border-border",
          )}
        >
          {entry.status === "failed" ? (
            <AlertTriangle
              className="w-3.5 h-3.5 shrink-0 text-destructive"
              aria-hidden="true"
            />
          ) : (
            <Cog
              className="w-3.5 h-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <span className="font-mono text-[11px] font-semibold text-foreground/80 truncate">
            {entry.name}
          </span>
          {entry.label && (
            <span className="truncate text-[11px] text-muted-foreground/90">
              {entry.label}
            </span>
          )}
          <span className="ml-auto shrink-0 text-[10px] uppercase tracking-wide">
            {entry.status === "failed" ? (
              <span title={entry.errorMessage ?? undefined}>failed</span>
            ) : (
              <span>applied</span>
            )}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground/70 tabular-nums">
            {formatRelative(entry.observedAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Formats an observed-at epoch ms into a compact relative timestamp
 * ("now", "2s ago", "12s ago"). Tool-call rows TTL out at ~30s so the
 * minute/hour ranges are intentionally omitted.
 */
export function formatRelative(observedAt: number, now: number = Date.now()): string {
  const deltaMs = Math.max(0, now - observedAt);
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds <= 1) return "now";
  return `${seconds}s ago`;
}
