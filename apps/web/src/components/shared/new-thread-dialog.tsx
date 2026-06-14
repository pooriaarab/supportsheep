"use client";

import { useState, useCallback, useRef } from "react";
import { ArrowUp, Paperclip, X } from "lucide-react";
import { Button } from "@repo/ui/primitives/button";
import { Badge } from "@repo/ui/primitives/badge";
import { Switch } from "@repo/ui/primitives/switch";
import { Separator } from "@repo/ui/primitives/separator";
import { Label } from "@repo/ui/primitives/label";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogTitle,
} from "@repo/ui/primitives/dialog";
import { useMountEffect } from "@/hooks/use-mount-effect";

const STORAGE_KEY = "new-thread-create-more";

interface NewThreadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (content: string, createMore: boolean) => void;
  appName?: string;
}

export function NewThreadDialog({
  open,
  onOpenChange,
  onSubmit,
  appName = "APP",
}: NewThreadDialogProps) {
  const [content, setContent] = useState("");
  const [createMore, setCreateMore] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useMountEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "true") setCreateMore(true);
    } catch {}
  });

  const handleCreateMoreChange = useCallback((checked: boolean) => {
    setCreateMore(checked);
    try {
      localStorage.setItem(STORAGE_KEY, String(checked));
    } catch {}
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSubmit(trimmed, createMore);
    setContent("");
    if (!createMore) {
      onOpenChange(false);
    } else {
      textareaRef.current?.focus();
    }
  }, [content, createMore, onSubmit, onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg gap-0 p-0">
        <DialogTitle className="sr-only">New thread</DialogTitle>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
            >
              {appName}
            </Badge>
            <span className="text-sm font-medium text-foreground">
              New thread
            </span>
          </div>
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>

        {/* Textarea */}
        <div className="px-4 pb-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you need help with... (type @ to mention an agent)"
            className="w-full min-h-[200px] resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {/* Action bar */}
        <div className="flex items-center gap-1 px-4 pb-3">
          <Button
            variant="ghost"
            size="sm"
            className="size-7 p-0 text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            + Agent
          </Button>
        </div>
        <Separator />
        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-4 py-3">
          <Label
            htmlFor="create-more-toggle"
            className="text-xs text-muted-foreground cursor-pointer"
          >
            Create more
          </Label>
          <Switch
            id="create-more-toggle"
            checked={createMore}
            onCheckedChange={handleCreateMoreChange}
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="size-8 rounded-full p-0"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
