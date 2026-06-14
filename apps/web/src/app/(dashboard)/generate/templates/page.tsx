"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Badge } from "@repo/ui/primitives/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/primitives/dialog";
import {
  FileText,
  List,
  BookOpen,
  Scale,
  Star,
  BookMarked,
  BookA,
  Target,
} from "lucide-react";
import { POST_TYPES, type PostType } from "@repo/types";
import {
  POST_TYPE_TEMPLATES,
  type PostTypeTemplate,
} from "@/lib/generation/templates";

/* ---------- Icon map ---------- */

const POST_TYPE_ICONS: Record<PostType, typeof FileText> = {
  blog_post: FileText,
  listicle: List,
  how_to: BookOpen,
  comparison: Scale,
  product_review: Star,
  pillar_page: BookMarked,
  glossary: BookA,
  landing_page: Target,
};

export default function TemplatesPage() {
  const [selected, setSelected] = useState<{
    type: PostType;
    template: PostTypeTemplate;
  } | null>(null);

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Generate", href: "/generate/keyword" },
          { label: "Templates" },
        ]}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {POST_TYPES.map((type) => {
              const template = POST_TYPE_TEMPLATES[type];
              const Icon = POST_TYPE_ICONS[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelected({ type, template })}
                  className="flex flex-col items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent/50"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">
                      {template.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {template.description}
                  </p>
                  <div className="flex items-center gap-2 mt-auto">
                    <Badge variant="secondary" className="text-[10px]">
                      {template.wordRange.min}-{template.wordRange.max} words
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    {template.structure}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Template Detail Dialog */}
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const Icon = POST_TYPE_ICONS[selected.type];
                    return <Icon className="size-4" />;
                  })()}
                  {selected.template.name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {selected.template.description}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    Structure
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selected.template.structure}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    Word Range
                  </p>
                  <Badge variant="secondary">
                    {selected.template.wordRange.min} -{" "}
                    {selected.template.wordRange.max} words
                  </Badge>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    System Prompt
                  </p>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted rounded-md p-3 max-h-60 overflow-y-auto">
                    {selected.template.systemPrompt}
                  </pre>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
