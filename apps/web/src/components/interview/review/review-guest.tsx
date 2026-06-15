import React from "react";
import { CheckCircle2, Clock, Eye } from "lucide-react";
import { Card } from "@repo/ui/primitives/card";
import { ArticleBodyRenderer } from "@/components/public/article-body-renderer";

interface ReviewGuestProps {
  _interview: Record<string, unknown>;
  article: {
    id: string;
    title?: string;
    body?: string;
    draftBody?: string;
  };
}

export function ReviewGuest({ _interview, article }: ReviewGuestProps) {
  // Estimated publish date: typically 24-48 hours from now
  const estDate = new Date();
  estDate.setHours(estDate.getHours() + 48);
  const formattedEstDate = estDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="min-h-screen bg-background py-12 px-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full space-y-8">
        {/* Thank You Header Card */}
        <Card className="p-8 border border-border bg-card shadow-xl space-y-6 text-center">
          <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center text-success mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Thank You for Your Session!</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Your expertise has been successfully captured and compiled into an article draft by our AI writer.
              The host of the knowledge base has been notified and will review the draft before publishing.
            </p>
          </div>

          <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Estimated Publish: <strong>{formattedEstDate}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              <span>Status: <strong className="text-warning">Pending Host Review</strong></span>
            </div>
          </div>
        </Card>

        {/* Read-only Draft Preview — uses the same ArticleBodyRenderer
            as the public /[postId] page so the compiled draft renders
            with identical typography and sanitize pipeline. */}
        <Card className="p-8 border border-border bg-card shadow-lg space-y-6">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-primary">Compiled Draft Preview</span>
            <h2 className="text-xl font-bold text-foreground">{article?.title || "Untitled Article"}</h2>
          </div>

          <div className="border-t border-border pt-4 max-h-[300px] overflow-y-auto pr-2">
            <ArticleBodyRenderer
              articleId={article.id}
              htmlBody={article?.body || article?.draftBody || ""}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}
