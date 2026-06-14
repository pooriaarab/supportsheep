"use client";

import * as React from "react";
import { X, ArrowLeft } from "lucide-react";
import { cn } from "@repo/ui/utils";
import { Button } from "@repo/ui/primitives/button";

interface DetailPanelProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function DetailPanel({
  open,
  onClose,
  title,
  children,
  className,
}: DetailPanelProps) {
  const closePanel = React.useEffectEvent(onClose);

  // Reactive on `open`: subscribe to Escape only while the panel is visible.
  // useEffectEvent keeps the latest `onClose` callable without re-subscribing.
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePanel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full bg-background border-l shadow-lg",
          "transform transition-transform duration-200 ease-out",
          "w-full md:w-[400px]",
          open ? "translate-x-0" : "translate-x-full",
          className,
        )}
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 md:hidden"
            onClick={onClose}
            aria-label="Close panel"
          >
            <ArrowLeft className="size-4" />
          </Button>
          {title && (
            <h3 className="flex-1 text-sm font-medium truncate">{title}</h3>
          )}
          {!title && <div className="flex-1" />}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 hidden md:flex"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-49px)] p-4">
          {children}
        </div>
      </div>
    </>
  );
}
