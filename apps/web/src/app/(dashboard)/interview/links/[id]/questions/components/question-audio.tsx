"use client";

import { useState } from "react";
import { Button } from "@repo/ui/primitives/button";
import { Loader2, Play } from "lucide-react";
import { createLogger } from "@/lib/logger";

const logger = createLogger("admin-question-audio");

interface Props {
  shareLinkId: string;
  questionId: string;
}

/**
 * Plays back a private interview question recording by minting a fresh
 * signed URL on click. URLs expire in 15 min; re-clicking re-mints. The URL
 * is held in component state only — it is never persisted or logged.
 */
export function QuestionAudio({ shareLinkId, questionId }: Props) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadUrl = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/interviews/share-links/${shareLinkId}/recording-url?questionId=${encodeURIComponent(questionId)}`,
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `Failed (${res.status})`);
      }
      const data = (await res.json()) as { url: string };
      setAudioUrl(data.url);
    } catch (err) {
      logger.error("Failed to load question audio URL", {
        error: err instanceof Error ? err.message : String(err),
      });
      setError("Could not load audio");
    } finally {
      setLoading(false);
    }
  };

  if (audioUrl) {
    return (
      <audio src={audioUrl} controls className="w-full h-8 pt-1" />
    );
  }

  return (
    <div className="flex items-center gap-2 pt-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={loadUrl}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 mr-2 animate-spin" />
        ) : (
          <Play className="h-3 w-3 mr-2" />
        )}
        Load audio
      </Button>
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
