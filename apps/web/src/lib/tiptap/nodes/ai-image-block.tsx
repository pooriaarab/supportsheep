"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/core";
import { useState, useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { toast } from "sonner";

function AIImageBlockView({ node, editor, getPos }: NodeViewProps) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/v1/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: "inline",
          customPrompt: prompt.trim() || undefined,
          title: node.attrs.articleTitle as string | undefined,
          excerpt: node.attrs.articleExcerpt as string | undefined,
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = (await res.json()) as { url: string; alt: string };

      const pos = typeof getPos === "function" ? getPos() : null;
      if (pos != null && editor) {
        editor
          .chain()
          .focus()
          .deleteRange({ from: pos, to: pos + node.nodeSize })
          .insertContentAt(pos, {
            type: "figure",
            attrs: { src: data.url, alt: data.alt },
          })
          .run();
      }
      toast.success("Image inserted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
      setGenerating(false);
    }
  }, [generating, prompt, node.attrs.articleTitle, node.attrs.articleExcerpt, node.nodeSize, editor, getPos]);

  return (
    <NodeViewWrapper>
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 my-2">
        <Sparkles className="size-4 text-muted-foreground shrink-0" />
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void generate();
            }
          }}
          placeholder="Describe the image to generate…"
          className="h-7 text-xs flex-1"
          disabled={generating}
        />
        <Button
          size="sm"
          className="h-7 text-xs gap-1 shrink-0"
          onClick={() => void generate()}
          disabled={generating}
        >
          {generating ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            "Generate"
          )}
        </Button>
      </div>
    </NodeViewWrapper>
  );
}

export const AIImageBlock = Node.create({
  name: "aiImageBlock",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      articleTitle: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-article-title") || null,
      },
      articleExcerpt: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-article-excerpt") || null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="ai-image-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-type": "ai-image-block",
        "data-article-title": node.attrs.articleTitle ?? "",
        "data-article-excerpt": node.attrs.articleExcerpt ?? "",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AIImageBlockView);
  },
});
