'use client';

import { Check, Loader2, AlertCircle, RotateCcw } from 'lucide-react';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  onRetry?: () => void;
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const minutes = Math.floor(seconds / 60);

  if (seconds < 60) return 'just now';
  if (minutes === 1) return '1 min ago';
  if (minutes < 60) return `${minutes} min ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AutosaveIndicator({
  status,
  lastSavedAt,
  onRetry,
}: AutosaveIndicatorProps) {
  if (status === 'idle' && !lastSavedAt) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {status === 'saving' && (
        <>
          <Loader2 className="size-3 animate-spin text-muted-foreground/70" />
          <span className="text-muted-foreground">Saving…</span>
        </>
      )}
      {status === 'saved' && (
        <>
          <Check className="size-3 text-success" />
          <span className="text-muted-foreground">
            Saved {lastSavedAt ? formatTimeAgo(lastSavedAt) : ''}
          </span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="size-3 text-error" />
          <span className="text-error">Save failed</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-0.5 text-error hover:text-error underline"
            >
              <RotateCcw className="size-3" />
              Retry
            </button>
          )}
        </>
      )}
      {status === 'idle' && lastSavedAt && (
        <>
          <Check className="size-3 text-muted-foreground/50" />
          <span className="text-muted-foreground/70">
            Saved {formatTimeAgo(lastSavedAt)}
          </span>
        </>
      )}
    </div>
  );
}
