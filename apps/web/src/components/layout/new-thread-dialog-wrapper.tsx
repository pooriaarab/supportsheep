"use client";

import { useCallback } from "react";
import { useNewThread } from "./dashboard-layout-client";
import { NewThreadDialog } from "@/components/shared/new-thread-dialog";

export function NewThreadDialogWrapper() {
  const { open, setOpen } = useNewThread();

  const handleSubmit = useCallback(
    async (content: string, _createMore: boolean) => {
      const { toast } = await import("sonner");
      await fetch("/api/v1/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: content.slice(0, 100),
          body: content,
          status: "draft",
        }),
      });
      toast.success("Draft article created");
    },
    [],
  );

  return (
    <NewThreadDialog
      open={open}
      onOpenChange={setOpen}
      onSubmit={handleSubmit}
    />
  );
}
