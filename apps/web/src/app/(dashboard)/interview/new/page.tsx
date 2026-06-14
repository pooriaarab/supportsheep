"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/ui/layout/page-shell";
import { Card } from "@repo/ui/primitives/card";
import { Input } from "@repo/ui/primitives/input";
import { Button } from "@repo/ui/primitives/button";
import { Label } from "@repo/ui/primitives/label";
import { Badge } from "@repo/ui/primitives/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/primitives/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NewInterviewPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("smart");
  const [maxDurationSec, setMaxDurationSec] = useState(300);
  const [loading, setLoading] = useState(false);

  const durationMin = Math.round(maxDurationSec / 60);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      toast.error("Topic is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          self: true,
          style,
          topic,
          maxDurationSec,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create interview");
      }

      const { interviewId } = await res.json();
      router.push(`/interview/${interviewId}/live`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "An unexpected error occurred";
      toast.error(errMsg);
      setLoading(false);
    }
  };

  return (
    <PageShell breadcrumbs={[{ label: "Start an interview" }]}>
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Start an interview
            </h1>
            <p className="text-muted-foreground text-sm">
              Define the topic and settings for your AI-led interview.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="topic">Interview Topic</Label>
              <Input
                id="topic"
                placeholder="e.g. Impact of Artificial Intelligence in Medicine"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="space-y-2 flex flex-col">
              <Label htmlFor="style">Interview Style</Label>
              <Select
                value={style}
                onValueChange={setStyle}
                disabled={loading}
              >
                <SelectTrigger id="style" className="w-full">
                  <SelectValue placeholder="Select a style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="smart">Brainstorming (Smart)</SelectItem>
                  <SelectItem value="testimonial">Testimonial</SelectItem>
                  <SelectItem value="eeat">EEAT</SelectItem>
                  <SelectItem value="case_study">Case Study</SelectItem>
                  <SelectItem value="qa">Q&A Post</SelectItem>
                  <SelectItem value="launch">Launch Story</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                The interview style influences the line of questioning and summary structure.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="duration">Max Duration</Label>
                <Badge variant="outline" className="text-xs font-semibold py-1">
                  {durationMin} min
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                <input
                  id="duration"
                  type="range"
                  min="60"
                  max="1800"
                  step="60"
                  value={maxDurationSec}
                  onChange={(e) => setMaxDurationSec(Number(e.target.value))}
                  disabled={loading}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-muted accent-primary"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                From 1 to 30 minutes. Default is 5 min (300 sec).
              </p>
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  "Start Interview"
                )}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </PageShell>
  );
}
