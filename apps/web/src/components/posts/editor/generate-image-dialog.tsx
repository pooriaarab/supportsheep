"use client";

/**
 * GenerateImageDialog -- dialog for generating AI images with an editable prompt.
 * Used by ImagePicker (settings-tab) and the TipTap figure bubble menu.
 */

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@repo/ui/primitives/dialog";
import { Button } from "@repo/ui/primitives/button";
import { Textarea } from "@repo/ui/primitives/textarea";
import { Label } from "@repo/ui/primitives/label";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useMountEffect } from "@/hooks/use-mount-effect";

export interface GenerateImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug?: string;
  title?: string;
  excerpt?: string;
  category?: string;
  purpose: "featured-image" | "inline";
  onComplete: (result: { url: string; alt: string }) => void;
}

interface DialogBodyProps {
  slug?: string;
  title?: string;
  excerpt?: string;
  category?: string;
  purpose: "featured-image" | "inline";
  onComplete: (result: { url: string; alt: string }) => void;
  onOpenChange: (open: boolean) => void;
}

function DialogBody({
  slug,
  title,
  excerpt,
  category,
  purpose,
  onComplete,
  onOpenChange,
}: DialogBodyProps) {
  const [prompt, setPrompt] = useState("");
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [generating, setGenerating] = useState(false);

  useMountEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/v1/generate/image-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, title, excerpt, category }),
        });
        if (res.ok) {
          const data = (await res.json()) as { prompt: string };
          setPrompt(data.prompt);
        }
      } finally {
        setLoadingPrompt(false);
      }
    })();
  });

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/v1/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          slug,
          title,
          excerpt,
          category,
          customPrompt: prompt.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Generation failed");
      }
      const result = (await res.json()) as { url: string; alt: string };
      onComplete(result);
      onOpenChange(false);
      toast.success("Image generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [purpose, slug, title, excerpt, category, prompt, onComplete, onOpenChange]);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="size-4" />
          Generate Image with AI
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="generate-image-prompt" className="text-xs font-medium">
          Image prompt
        </Label>
        {loadingPrompt ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground h-20">
            <Loader2 className="size-3 animate-spin" />
            Generating prompt suggestion…
          </div>
        ) : (
          <Textarea
            id="generate-image-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the image, or leave blank to auto-generate from article context"
            className="text-xs min-h-[80px] resize-none"
            disabled={generating}
          />
        )}
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={generating}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={generating || loadingPrompt}
          className="gap-1.5"
        >
          {generating ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Sparkles className="size-3" />
          )}
          {generating ? "Generating…" : "Generate Image"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function GenerateImageDialog({
  open,
  onOpenChange,
  slug,
  title,
  excerpt,
  category,
  purpose,
  onComplete,
}: GenerateImageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {open && (
          <DialogBody
            slug={slug}
            title={title}
            excerpt={excerpt}
            category={category}
            purpose={purpose}
            onComplete={onComplete}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
