"use client";

import React, { useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@repo/ui/composites/responsive-dialog";
import { Label } from "@repo/ui/primitives/label";
import { Input } from "@repo/ui/primitives/input";
import { Button } from "@repo/ui/primitives/button";
import { useCreateShareLink } from "@/hooks/use-share-links-query";
import { useBlogConfigQuery } from "@/hooks/use-blog-config-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ShareLinkSuccessPanel } from "./share-link-success-panel";

interface QuickCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMoreOptions: (topic: string) => void;
}

export function QuickCreateDialog({
  open,
  onOpenChange,
  onMoreOptions,
}: QuickCreateDialogProps) {
  const [topic, setTopic] = useState("");
  const [createdData, setCreatedData] = useState<{
    id: string;
    token: string;
    topic: string | null;
  } | null>(null);
  const createLink = useCreateShareLink();
  const { data: blogConfig } = useBlogConfigQuery();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Topic is required");
      return;
    }

    try {
      const res = await createLink.mutateAsync({
        type: "link",
        // V2.3 async mode made `mode` a required field on
        // ShareLinkCreateInput. Quick create stays on the default live
        // (audio-realtime) flow; async needs explicit opt-in via the full
        // create dialog.
        mode: "live",
        topic,
        style: blogConfig?.interview?.defaultStyle ?? "smart",
        recordingConfig:
          (blogConfig?.interview?.defaultRecording === "video"
            ? "transcript"
            : blogConfig?.interview?.defaultRecording) ?? "transcript",
        authMode: "email",
        maxDurationSec: blogConfig?.interview?.defaultDurationSec ?? 300,
        maxUses: null,
        language: blogConfig?.interview?.defaultLanguage ?? "en",
      });
      setCreatedData({ ...res, topic });
    } catch {
      // Error handled by query hook
    }
  };

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTopic("");
      setCreatedData(null);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <ResponsiveDialogContent className="sm:max-w-[480px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {createdData ? "Share link created!" : "Quick create share link"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {createdData
              ? "Your invite link is ready. Send it to your guest to start the interview."
              : "Enter a topic to instantly generate an AI interview link with default settings."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {createdData ? (
          <div className="space-y-4 py-2">
            <ShareLinkSuccessPanel
              token={createdData.token}
              topic={createdData.topic}
            />
            <ResponsiveDialogFooter className="pt-2 sm:justify-end">
              <Button onClick={() => handleClose(false)}>Done</Button>
            </ResponsiveDialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="topic">Topic</Label>
              <Input
                id="topic"
                placeholder="Why you switched from Notion to Supportsheep"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={500}
                autoFocus
              />
              <div className="text-[11px] text-muted-foreground">
                Maximum 500 characters.
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  handleClose(false);
                  onMoreOptions(topic);
                }}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                More options
              </button>
            </div>

            <ResponsiveDialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleClose(false)}
                disabled={createLink.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createLink.isPending}
                className="flex gap-2"
              >
                {createLink.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Create
              </Button>
            </ResponsiveDialogFooter>
          </form>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
