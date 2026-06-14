import React from "react";
import { AlertCircle, FileX, Hourglass } from "lucide-react";
import { Card } from "@repo/ui/primitives/card";

interface ReviewErrorProps {
  reason: "not_found" | "article_missing" | "pending" | "error";
}

const REASON_COPY: Record<ReviewErrorProps["reason"], { title: string; body: string }> = {
  not_found: {
    title: "Interview Not Found",
    body:
      "We couldn't find the interview session you are looking for. It may have been deleted or the URL is incorrect.",
  },
  article_missing: {
    title: "Draft Article Missing",
    body:
      "The draft article associated with this interview session could not be found or has not been compiled yet.",
  },
  pending: {
    title: "Your Article is Being Finalized",
    body:
      "We're still compiling the draft from your interview. Refresh this page in a few seconds.",
  },
  error: {
    title: "Something Went Wrong",
    body:
      "We hit an unexpected error loading this review page. Refresh the page or come back in a moment.",
  },
};

export function ReviewError({ reason }: ReviewErrorProps) {
  const copy = REASON_COPY[reason];

  let Icon: typeof AlertCircle;
  if (reason === "not_found") {
    Icon = FileX;
  } else if (reason === "pending") {
    Icon = Hourglass;
  } else {
    Icon = AlertCircle;
  }

  const isPending = reason === "pending";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <Card
        className={`max-w-md p-8 ${
          isPending ? "border border-border" : "border border-destructive/20"
        } bg-card shadow-xl space-y-6`}
      >
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
            isPending ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
          }`}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">{copy.title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{copy.body}</p>
        </div>
      </Card>
    </div>
  );
}
