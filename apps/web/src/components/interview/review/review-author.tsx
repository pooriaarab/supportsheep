"use client";

import React, { useState } from "react";
import { CheckCircle2, Pencil, Loader2, Sparkles } from "lucide-react";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import { toast } from "sonner";
import { ArticleBodyRenderer } from "@/components/public/article-body-renderer";

import type { Article } from "@repo/types";

interface ReviewAuthorProps {
  _interview: Record<string, unknown>;
  article: Article & { id: string };
  interviewId: string;
}

export function ReviewAuthor({ _interview, article, interviewId }: ReviewAuthorProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmitForReview = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/articles/${article.id}/submit-for-review`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server responded with ${res.status}`);
      }

      toast.success("Draft submitted for review!");
      setSubmitted(true);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to submit draft for review";
      toast.error(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const isPendingReview = article.status === "pending_review" || submitted;

  return (
    <div className="min-h-screen bg-background py-12 px-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full space-y-8">
        {/* Header/Control Card */}
        <Card className="p-8 border border-border bg-card shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Interview Session Draft Ready!</h1>
              <p className="text-xs text-muted-foreground">
                Review your compiled article and submit it to the editorial team.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Button asChild variant="outline" className="flex-1 text-xs">
              <a href={`/posts/${article.slug}/edit?fromInterview=${interviewId}`}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit in TipTap
              </a>
            </Button>

            <Button
              onClick={handleSubmitForReview}
              disabled={submitting || isPendingReview}
              className="flex-1 text-xs font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Submitting...
                </>
              ) : isPendingReview ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-success" />
                  Pending Review
                </>
              ) : (
                "Submit for review"
              )}
            </Button>
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

          <div className="border-t border-border pt-4 max-h-[400px] overflow-y-auto pr-2">
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
