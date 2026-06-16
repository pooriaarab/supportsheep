"use client";

import React, { use, useState, useMemo, useRef } from "react";
import { PageShell } from "@/components/ui/layout/page-shell";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import { useShareLinksQuery } from "@/hooks/use-share-links-query";
import { useAuth } from "@/contexts/auth-context";
import { useUserQuery } from "@/hooks/use-users-query";
import { useRouter } from "next/navigation";
import { Mic, Square, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { createLogger } from "@/lib/logger";
import { QuestionAudio } from "./components/question-audio";

const logger = createLogger("admin-questions");

interface PageProps {
  params: Promise<{ id: string }>;
}

interface AsyncQuestion {
  id: string;
  text: string;
  audioStoragePath: string;
}

interface LocalShareLink {
  id: string;
  mode?: "live" | "async";
  topic?: string;
  asyncQuestions?: AsyncQuestion[];
}

export default function AdminQuestionsPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { data: userProfile } = useUserQuery(currentUser?.uid ?? "");

  const { data: shareLinks = [], isLoading, refetch } = useShareLinksQuery();
  const link = useMemo(() => (shareLinks.find((l) => l.id === id) as unknown) as LocalShareLink | undefined, [shareLinks, id]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useMountEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  });

  const canEdit = useMemo(() => {
    if (!userProfile) return false;
    const role = userProfile.role;
    // Owner is a superset of admin.
    return role === "admin" || role === "owner";
  }, [userProfile]);

  if (isLoading) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Loading share link...
      </div>
    );
  }

  if (!link) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Share link not found.
      </div>
    );
  }

  if (link.mode !== "async") {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 text-center space-y-4">
        <AlertCircle className="mx-auto h-12 w-12 text-warning" />
        <h1 className="text-xl font-bold">Not an Async Link</h1>
        <p className="text-muted-foreground text-sm">
          This share link is configured for live interactive interviews. Pre-recorded questions can only be added to links created in pre-recorded async mode.
        </p>
        <Button onClick={() => router.push(`/interview/links/${id}`)}>
          Back to Detail
        </Button>
      </div>
    );
  }

  const startRecording = async () => {
    audioChunksRef.current = [];
    setRecordingDuration(0);
    setRecordedBlob(null);
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
      setRecordedBlobUrl(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordedBlob(audioBlob);
        setRecordedBlobUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      logger.error("Failed to access microphone:", err instanceof Error ? { error: err.message } : { error: String(err) });
      toast.error("Microphone access is required to record questions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleUpload = async () => {
    if (!recordedBlob) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", recordedBlob, "question.webm");

      const res = await fetch(`/api/v1/interviews/share-links/${id}/questions`, {
        method: "Article",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload question");
      }

      toast.success("Question recorded and transcribed successfully!");
      setRecordedBlob(null);
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
        setRecordedBlobUrl(null);
      }
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload question.");
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const questions = link.asyncQuestions || [];

  const breadcrumbs = [
    { label: "Share Links", href: "/interview/links" },
    { label: link.topic || "Link Details", href: `/interview/links/${id}` },
    { label: "Questions" },
  ];

  return (
    <PageShell breadcrumbs={breadcrumbs}>
      <div className="flex flex-col space-y-2 mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Pre-recorded Questions</h1>
        <p className="text-sm text-muted-foreground">
          Record up to 20 audio questions for guests to answer on their own time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left/Middle Column: Recorded Questions List */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 bg-card border border-border">
            <h3 className="text-sm font-semibold mb-4 text-foreground">Recorded Questions ({questions.length})</h3>
            
            {questions.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-border/60 rounded-lg bg-muted/20">
                <Mic className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                <p className="text-sm font-semibold text-foreground">No questions recorded</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use the recording panel on the right to add your first pre-recorded question.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {questions.map((q: AsyncQuestion, idx: number) => (
                  <div key={q.id} className="p-4 rounded-lg bg-muted/40 border border-border/40 flex flex-col sm:flex-row gap-4 justify-between items-start">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">
                          Question {idx + 1}
                        </span>
                      </div>
                      <p className="text-foreground text-sm font-medium leading-relaxed italic">
                        &ldquo;{q.text}&rdquo;
                      </p>
                      <QuestionAudio shareLinkId={id} questionId={q.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Record Question Panel */}
        <div className="space-y-6">
          <Card className="p-6 bg-card border border-border space-y-6">
            <h3 className="text-sm font-semibold text-foreground">Record New Question</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Record yourself speaking a question. Once recorded, our AI interviewer will automatically transcribe it and prepare it for guests.
            </p>

            {isRecording ? (
              <div className="p-6 rounded-lg bg-destructive/5 border border-destructive/20 flex flex-col items-center gap-3 animate-pulse">
                <span className="w-3 h-3 rounded-full bg-destructive" />
                <p className="text-destructive font-bold text-sm">Recording Question... {formatTime(recordingDuration)}</p>
                <Button onClick={stopRecording} variant="destructive" size="lg" className="w-full mt-2">
                  <Square className="h-4 w-4 mr-2" /> Stop Recording
                </Button>
              </div>
            ) : recordedUrl ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-success-subtle border border-success-subtle/30 space-y-3">
                  <p className="text-xs font-semibold text-success flex items-center gap-1">
                    ✓ Question Recorded Successfully
                  </p>
                  <audio src={recordedUrl} controls className="w-full h-8" />
                </div>
                <div className="flex gap-2">
                  <Button onClick={startRecording} variant="outline" className="flex-1" disabled={uploading}>
                    Re-record
                  </Button>
                  <Button onClick={handleUpload} className="flex-1 bg-primary text-primary-foreground" disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading...
                      </>
                    ) : (
                      "Save Question"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={startRecording} size="lg" className="w-full py-6 text-base font-semibold" disabled={!canEdit}>
                <Mic className="h-5 w-5 mr-2" /> Record Question
              </Button>
            )}

            {!canEdit && (
              <p className="text-[10px] text-destructive font-medium text-center">
                Only workspace administrators, owners, or editors can modify questions.
              </p>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
