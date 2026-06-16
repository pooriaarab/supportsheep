"use client";

import { useState, useRef } from "react";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { createLogger } from "@/lib/logger";

const logger = createLogger("async-interview-client");

interface Question {
  id: string;
  text: string;
  audioUrl: string;
}

interface ResponseState {
  audioUrl?: string;
  transcript?: string;
  uploading: boolean;
  error?: string;
  success: boolean;
}

interface Props {
  questions: Question[];
  interviewId: string;
  token: string;
}

export function AsyncInterviewClient({ questions, interviewId, token }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [responses, setResponses] = useState<Record<string, ResponseState>>({});
  const [completed, setIsCompleted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentQuestion = questions[currentIndex];

  useMountEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  });

  if (questions.length === 0) {
    return (
      <div className="max-w-lg mx-auto mt-12 px-4">
        <Card className="p-8 shadow-md border border-border text-center">
          <h1 className="text-xl font-bold mb-4">No questions configured</h1>
          <p className="text-muted-foreground mb-6">
            The administrator has not recorded any questions for this interview yet.
          </p>
        </Card>
      </div>
    );
  }

  const startRecording = async () => {
    audioChunksRef.current = [];
    setRecordingDuration(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await uploadResponse(currentQuestion.id, audioBlob);
        
        // Stop all tracks in the stream to release the mic
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      logger.error("Microphone access denied:", err instanceof Error ? { error: err.message } : { error: String(err) });
      alert("Microphone access is required to record your response. Please grant permission and try again.");
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

  const uploadResponse = async (questionId: string, blob: Blob) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: { uploading: true, success: false },
    }));

    try {
      const formData = new FormData();
      formData.append("file", blob, "response.webm");
      formData.append("questionId", questionId);

      const res = await fetch(`/api/v1/interviews/${interviewId}/async-response`, {
        method: "Article",
        credentials: "same-origin",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload answer");
      }

      const responseData = await res.json() as { audioStoragePath: string; transcript: string };

      setResponses((prev) => ({
        ...prev,
        [questionId]: {
          uploading: false,
          success: true,
          transcript: responseData.transcript,
          audioUrl: URL.createObjectURL(blob),
        },
      }));
    } catch (err) {
      setResponses((prev) => ({
        ...prev,
        [questionId]: {
          uploading: false,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }));
    }
  };

  const onNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const onPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const onComplete = async () => {
    setCompleting(true);
    setCompleteError(null);
    try {
      const res = await fetch(`/api/v1/interviews/${interviewId}/end`, {
        method: "Article",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to finalize interview");
      }

      setIsCompleted(true);
    } catch (err) {
      setCompleteError(err instanceof Error ? err.message : String(err));
      setCompleting(false);
    }
  };

  if (completed) {
    return (
      <div className="max-w-lg mx-auto mt-12 px-4">
        <Card className="p-8 shadow-md border border-border text-center space-y-4 bg-card">
          <div className="mx-auto w-12 h-12 rounded-full bg-success-subtle flex items-center justify-center text-success mb-2">
            ✓
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Interview Complete!</h1>
          <p className="text-muted-foreground text-sm">
            Thank you so much for your time. Your pre-recorded answers have been saved, and our AI editor is currently compiling your responses into a high-quality article draft.
          </p>
          <div className="pt-4">
            <Button onClick={() => window.location.href = `/i/${token}`} variant="outline" className="w-full">
              Back to Start
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const currentResponse = responses[currentQuestion.id];
  const isLastQuestion = currentIndex === questions.length - 1;
  const hasAnswered = currentResponse?.success;

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-xl mx-auto mt-12 px-4 pb-20">
      <Card className="p-8 shadow-md border border-border bg-card space-y-6">
        {/* Progress header */}
        <div className="flex justify-between items-center text-xs text-muted-foreground border-b border-border pb-4">
          <span className="font-semibold uppercase tracking-wider text-primary">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="bg-muted px-2 py-1 rounded-md font-mono">
            {Math.round(((currentIndex) / questions.length) * 100)}% Complete
          </span>
        </div>

        {/* Question Area */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">Listen to the question</h2>
          
          <div className="p-4 rounded-lg bg-muted/30 border border-border/40 flex flex-col gap-3">
            <audio src={currentQuestion.audioUrl} controls className="w-full focus:outline-none" />
            <p className="text-foreground text-base italic font-medium leading-relaxed pt-2">
              &ldquo;{currentQuestion.text}&rdquo;
            </p>
          </div>
        </div>

        {/* Recording Section */}
        <div className="space-y-4 border-t border-border pt-6">
          <h2 className="text-sm font-semibold text-muted-foreground">Your Response</h2>

          {isRecording ? (
            <div className="p-6 rounded-lg bg-destructive/5 border border-destructive/20 flex flex-col items-center gap-3 animate-pulse">
              <span className="w-3 h-3 rounded-full bg-destructive" />
              <p className="text-destructive font-bold text-sm">Recording Answer... {formatTime(recordingDuration)}</p>
              <Button onClick={stopRecording} variant="destructive" size="lg" className="px-8 mt-2">
                Stop Recording
              </Button>
            </div>
          ) : currentResponse?.uploading ? (
            <div className="p-6 rounded-lg bg-primary/5 border border-primary/20 flex flex-col items-center gap-3">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-primary font-medium text-sm">Transcribing and saving your reply...</p>
            </div>
          ) : currentResponse?.success ? (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-success-subtle border border-success-subtle/30 text-success text-sm space-y-2">
                <p className="font-semibold flex items-center gap-1.5">
                  ✓ Response Saved
                </p>
                {currentResponse.transcript && (
                  <p className="text-muted-foreground italic font-medium leading-relaxed pl-5 bg-card/40 p-2.5 rounded border border-border/30 mt-2">
                    &ldquo;{currentResponse.transcript}&rdquo;
                  </p>
                )}
                {currentResponse.audioUrl && (
                  <div className="pt-2 pl-5">
                    <audio src={currentResponse.audioUrl} controls className="w-full h-8" />
                  </div>
                )}
              </div>
              
              <Button onClick={startRecording} variant="outline" className="w-full text-muted-foreground">
                Re-record response
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {currentResponse?.error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20">
                  Failed to save response: {currentResponse.error}
                </div>
              )}
              <Button onClick={startRecording} size="lg" className="w-full py-6 text-base font-semibold bg-primary text-primary-foreground">
                🎤 Record Answer
              </Button>
            </div>
          )}
        </div>

        {/* Navigation / Completion Controls */}
        {completeError && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm font-medium border border-destructive/20 mt-4">
            Failed to complete: {completeError}
          </div>
        )}

        <div className="flex justify-between gap-3 border-t border-border pt-6 mt-4">
          <Button onClick={onPrev} variant="outline" disabled={currentIndex === 0 || isRecording || currentResponse?.uploading}>
            Previous
          </Button>

          {isLastQuestion ? (
            <Button onClick={onComplete} disabled={!hasAnswered || isRecording || currentResponse?.uploading || completing} className="px-8">
              {completing ? "Submitting..." : "Submit & Complete"}
            </Button>
          ) : (
            <Button onClick={onNext} disabled={!hasAnswered || isRecording || currentResponse?.uploading}>
              Next Question
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
