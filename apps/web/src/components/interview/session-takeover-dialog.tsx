"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@repo/ui/primitives/button";

interface Props {
  /** When true the dialog is rendered as a non-dismissable modal blocking the page. */
  open: boolean;
  /**
   * Called when the user chooses to take over the active session. The caller
   * is expected to call `controller.takeover()` and then resume the live
   * page; this dialog only owns presentation + the click handler.
   */
  onTakeover: () => void;
  /**
   * Heartbeat id of the currently active tab. Displayed in a small caption so
   * the user can recognise their own session id if they ended up here by
   * mistake (e.g. opened the same link twice in one window).
   */
  currentHolder?: string | null;
  /** True while the takeover request is in flight. */
  isTakingOver?: boolean;
}

/**
 * Blocking notice shown when a second tab opens the same interview while
 * another tab is heartbeating. Offers a single "Take over" action — the user
 * confirms intent before we forcibly evict the other tab.
 *
 * Renders inline (not a portal) on top of the page shell so the orb/canvas
 * never animate behind it.
 */
export function SessionTakeoverDialog({
  open,
  onTakeover,
  currentHolder,
  isTakingOver = false,
}: Props) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-takeover-title"
    >
      <div className="max-w-md w-full bg-card border border-border rounded-xl shadow-xl p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-warning/10 rounded-full flex items-center justify-center text-warning shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h1
              id="session-takeover-title"
              className="text-base font-bold text-foreground"
            >
              Interview already active in another tab
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This interview is already running in another browser tab or
              window. To continue here, take over the session — the other tab
              will be disconnected.
            </p>
            {currentHolder && (
              <p className="text-[10px] text-muted-foreground/70 pt-2 font-mono break-all">
                Active session: {currentHolder}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <Button
            type="button"
            onClick={onTakeover}
            disabled={isTakingOver}
            className="w-full"
          >
            {isTakingOver ? "Taking over…" : "Take over"}
          </Button>
        </div>
      </div>
    </div>
  );
}
