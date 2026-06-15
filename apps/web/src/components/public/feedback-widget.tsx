"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function FeedbackWidget({ articleId: _articleId }: { articleId: string }) {
  const [feedback, setFeedback] = useState<"helpful" | "unhelpful" | null>(null);

  const handleFeedback = async (type: "helpful" | "unhelpful") => {
    setFeedback(type);
    
    // In a real application, we would ping an API route here:
    // await fetch('/api/v1/articles/' + articleId + '/feedback', { method: 'POST', body: JSON.stringify({ type }) })
  };

  if (feedback) {
    return (
      <div className="mt-12 p-6 bg-secondary/50 rounded-xl border border-border flex items-center gap-3 animate-in fade-in zoom-in duration-300">
        <div className="bg-primary/10 text-primary p-2 rounded-full">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <p className="font-medium text-foreground">Thanks for your feedback!</p>
          <p className="text-sm text-muted-foreground">Your input helps us improve our support content.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-12 p-6 bg-card rounded-xl border border-border">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Was this article helpful?</h3>
          <p className="text-sm text-muted-foreground mt-1">Let us know if this resolved your issue.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleFeedback("helpful")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md border font-medium text-sm transition-all",
              "border-border bg-background hover:bg-secondary text-foreground hover:text-foreground"
            )}
          >
            <ThumbsUp className="w-4 h-4" /> Yes
          </button>
          <button
            onClick={() => handleFeedback("unhelpful")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md border font-medium text-sm transition-all",
              "border-border bg-background hover:bg-secondary text-foreground hover:text-foreground"
            )}
          >
            <ThumbsDown className="w-4 h-4" /> No
          </button>
        </div>
      </div>
    </div>
  );
}
