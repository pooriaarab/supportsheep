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
import { Button } from "@repo/ui/primitives/button";
import { Loader2 } from "lucide-react";
import { useRegenerateShareLink } from "@/hooks/use-share-links-query";
import { ShareLinkSuccessPanel } from "./share-link-success-panel";

interface RegenerateShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ID of the share link to regenerate, or null when the dialog is hidden. */
  shareLinkId: string | null;
  /** Optional topic, surfaced in the success panel's share copy. */
  topic?: string | null;
}

export function RegenerateShareLinkDialog({
  open,
  onOpenChange,
  shareLinkId,
  topic,
}: RegenerateShareLinkDialogProps) {
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const regenerate = useRegenerateShareLink();

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) setCreatedToken(null);
  };

  const handleRegenerate = async () => {
    if (!shareLinkId) return;
    try {
      const res = await regenerate.mutateAsync(shareLinkId);
      setCreatedToken(res.token);
    } catch {
      // Toast already shown by hook
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <ResponsiveDialogContent className="sm:max-w-[520px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {createdToken ? "New share link ready" : "Regenerate share link?"}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {createdToken
              ? "Copy or share the new URL now — it won't be visible again."
              : "This rotates the share link's secret token, invalidating the old URL immediately. Anyone using the previous link will see an error. Use this if the old URL leaked or you misplaced it."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {createdToken ? (
          <div className="space-y-4 py-2">
            <ShareLinkSuccessPanel token={createdToken} topic={topic} />
            <ResponsiveDialogFooter className="pt-2 sm:justify-end">
              <Button onClick={() => handleClose(false)}>Done</Button>
            </ResponsiveDialogFooter>
          </div>
        ) : (
          <ResponsiveDialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleClose(false)}
              disabled={regenerate.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRegenerate}
              disabled={regenerate.isPending}
              className="gap-2"
            >
              {regenerate.isPending && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Regenerate link
            </Button>
          </ResponsiveDialogFooter>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
