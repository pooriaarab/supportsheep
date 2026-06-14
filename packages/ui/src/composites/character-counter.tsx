'use client';

import { cn } from '../utils';

interface CharacterCounterProps {
  current: number;
  max: number;
  className?: string;
}

export function CharacterCounter({ current, max, className }: CharacterCounterProps) {
  const ratio = current / max;

  if (ratio < 0.8) return null;

  const colorClass =
    ratio >= 1
      ? 'text-error'
      : ratio >= 0.9
        ? 'text-warning'
        : 'text-muted-foreground';

  return (
    <p className={cn('text-xs', colorClass, className)}>
      {current.toLocaleString()} / {max.toLocaleString()}
    </p>
  );
}
