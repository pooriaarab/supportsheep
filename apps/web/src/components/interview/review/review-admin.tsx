"use client";

import React, { useState } from "react";
import {
  Calendar,
  Globe,
  Loader2,
  MoreVertical,
  Pencil,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/primitives/dropdown-menu";
import { toast } from "sonner";
import { ArticleBodyRenderer } from "@/components/public/article-body-renderer";

import type { Article } from "@repo/types";

interface ReviewAdminProps {
  _interview: Record<string, unknown>;
  article: Article & { id: string };
  interviewId: string;
}

export function ReviewAdmin({ _interview, article, interviewId }: ReviewAdminProps) {
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState<string>(() => article.status);
  const [scheduling, setScheduling] = useState(false);
  const [showScheduleInput, setShowScheduleInput] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");

  const handlePublishNow = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/v1/articles/${encodeURIComponent(article.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server responded with ${res.status}`);
      }

      toast.success("Article published successfully!");
      setStatus("published");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to publish article";
      toast.error(errorMsg);
    } finally {
      setPublishing(false);
    }
  };

  const handleScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDate) {
      toast.error("Please select a date and time");
      return;
    }

    setScheduling(true);
    try {
      const res = await fetch(`/api/v1/articles/${encodeURIComponent(article.slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "schedule",
          scheduledAt: new Date(scheduledDate).toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server responded with ${res.status}`);
      }

      toast.success("Article scheduled successfully!");
      setStatus("scheduled");
      setShowScheduleInput(false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to schedule article";
      toast.error(errorMsg);
    } finally {
      setScheduling(false);
    }
  };

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/posts/${article.slug}`;
    void navigator.clipboard.writeText(shareUrl);
    toast.success("Article link copied to clipboard!");
  };

  const isPublished = status === "published";
  const isScheduled = status === "scheduled";

  return (
    <div className="min-h-screen bg-background py-12 px-6 flex flex-col items-center justify-center">
      <div className="max-w-2xl w-full space-y-8">
        {/* Admin Dashboard Controls */}
        <Card className="p-8 border border-border bg-card shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground font-sans">Review Interview Draft</h1>
                <p className="text-xs text-muted-foreground">
                  Logged in as Administrator. Actions will affect live public content.
                </p>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="w-4 h-4 text-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border border-border">
                <DropdownMenuItem onClick={copyShareLink} className="text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer">
                  Copy article link
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer">
                  <a href={`/interview/sessions/${interviewId}`} target="_blank" rel="noopener noreferrer">
                    View original session
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Button asChild variant="outline" className="flex-1 text-xs">
              <a href={`/posts/${article.slug}/edit?fromInterview=${interviewId}`}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit in TipTap
              </a>
            </Button>

            <Button
              onClick={() => setShowScheduleInput(!showScheduleInput)}
              variant="outline"
              disabled={isPublished || isScheduled}
              className="flex-1 text-xs"
            >
              <Calendar className="w-3.5 h-3.5 mr-1.5 text-primary" />
              {isScheduled ? "Scheduled" : "Schedule"}
            </Button>

            <Button
              onClick={handlePublishNow}
              disabled={publishing || isPublished}
              className="flex-1 text-xs font-semibold"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Publishing...
                </>
              ) : isPublished ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-success" />
                  Published Live
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5 mr-1.5 text-primary-foreground" />
                  Publish now
                </>
              )}
            </Button>
          </div>

          {/* Inline Schedule Form */}
          {showScheduleInput && (
            <form onSubmit={handleScheduleSubmit} className="pt-4 border-t border-border flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <label htmlFor="scheduled-date" className="text-[10px] font-bold uppercase text-muted-foreground">
                  Publish Date & Time
                </label>
                <input
                  id="scheduled-date"
                  type="datetime-local"
                  required
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full text-xs rounded-md border border-input bg-background px-3 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <Button type="submit" disabled={scheduling} className="text-xs shrink-0 py-1.5 h-8">
                {scheduling ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
              </Button>
            </form>
          )}
        </Card>

        {/* Read-only Draft Preview — uses the same ArticleBodyRenderer
            as the public /[postId] page so the compiled draft renders
            with identical typography, heading-id anchors, and sanitize
            pipeline. Pixel parity between this preview and the
            published article means the user is never surprised by what
            lands on the knowledge base. */}
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
