"use client";

/**
 * Version History Panel -- lists saved versions with timestamps,
 * inline diff preview, and restore action.
 */

import { useState, useMemo, useCallback } from "react";
import type { ArticleVersion } from "@repo/types";
import { Button } from "@repo/ui/primitives/button";
import { Badge } from "@repo/ui/primitives/badge";
import { RotateCcw, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

interface VersionHistoryProps {
  versions: ArticleVersion[];
  currentBody: string;
  onRestore: (body: string) => void;
}

/* -------------------------------------------------------------------------- */
/* Simple diff                                                                 */
/* -------------------------------------------------------------------------- */

interface DiffLine {
  type: "added" | "removed" | "same";
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];

    if (oldLine === undefined) {
      result.push({
        type: "added",
        text: newLine ?? "",
        newLineNumber: i + 1,
      });
    } else if (newLine === undefined) {
      result.push({
        type: "removed",
        text: oldLine,
        oldLineNumber: i + 1,
      });
    } else if (oldLine === newLine) {
      result.push({
        type: "same",
        text: oldLine,
        oldLineNumber: i + 1,
        newLineNumber: i + 1,
      });
    } else {
      result.push({
        type: "removed",
        text: oldLine,
        oldLineNumber: i + 1,
      });
      result.push({
        type: "added",
        text: newLine,
        newLineNumber: i + 1,
      });
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/* Version Item                                                                */
/* -------------------------------------------------------------------------- */

function VersionItem({
  version,
  index,
  compareBody,
  onRestore,
}: {
  version: ArticleVersion;
  index: number;
  compareBody: string;
  onRestore: (body: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const diff = useMemo(() => {
    if (!expanded) return [];
    return computeDiff(compareBody, version.body);
  }, [expanded, compareBody, version.body]);

  const changedLines = useMemo(
    () => diff.filter((d) => d.type !== "same").length,
    [diff],
  );

  const formattedTime = useMemo(() => {
    try {
      return new Date(version.savedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return version.savedAt;
    }
  }, [version.savedAt]);

  const handleToggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="size-3 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Clock className="size-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs font-medium truncate">
              {formattedTime}
            </span>
            <Badge variant="outline" className="text-[9px] h-4 px-1">
              v{index + 1}
            </Badge>
          </div>
          {version.note && (
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {version.note}
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Diff view */}
          <div className="max-h-48 overflow-y-auto bg-muted/30 font-mono text-[10px] p-2">
            {diff.length === 0 || changedLines === 0 ? (
              <p className="text-muted-foreground italic text-center py-2">
                No differences
              </p>
            ) : (
              diff
                .filter((d) => d.type !== "same")
                .slice(0, 50)
                .map((line) => (
                  <div
                    key={`${line.type}-${line.oldLineNumber ?? ""}-${
                      line.newLineNumber ?? ""
                    }-${line.text}`}
                    className={cn(
                      "px-1 leading-relaxed whitespace-pre-wrap break-all",
                      line.type === "added" && "bg-success/10 text-success",
                      line.type === "removed" &&
                        "bg-destructive/10 text-destructive",
                    )}
                  >
                    <span className="select-none opacity-50">
                      {line.type === "added" ? "+" : "-"}{" "}
                    </span>
                    {line.text || " "}
                  </div>
                ))
            )}
          </div>

          {/* Restore button */}
          <div className="flex justify-end px-3 py-1.5 border-t border-border bg-muted/20">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1"
              onClick={() => onRestore(version.body)}
            >
              <RotateCcw className="size-3" />
              Restore
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export function VersionHistory({
  versions,
  currentBody,
  onRestore,
}: VersionHistoryProps) {
  const sorted = useMemo(
    () => [...versions].reverse(), // Most recent first
    [versions],
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Clock className="size-8 text-muted-foreground/50 mb-2" />
        <p className="text-xs text-muted-foreground">No versions yet</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          Versions are saved automatically when you edit
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4 overflow-y-auto">
      <p className="text-[10px] text-muted-foreground">
        {sorted.length} version{sorted.length !== 1 ? "s" : ""}
      </p>
      {sorted.map((version, idx) => (
        <VersionItem
          key={version.savedAt}
          version={version}
          index={versions.length - 1 - idx}
          compareBody={currentBody}
          onRestore={onRestore}
        />
      ))}
    </div>
  );
}
