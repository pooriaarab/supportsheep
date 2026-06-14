/**
 * Status Badge Component
 *
 * Displays a status indicator with a colored dot and capitalized label.
 * Maps known statuses to predefined color schemes with a fallback for unknown values.
 *
 * Usage:
 * ```tsx
 * <StatusBadge status="active" />
 * <StatusBadge status="error" className="ml-2" />
 * ```
 */

import { cn } from '../utils';

export type StatusVariant = 'active' | 'paused' | 'error' | 'idle' | 'deleted' | 'scheduled';

interface StatusBadgeProps {
  /** Status string to display (known variants get colored styling, unknown values get a fallback) */
  status: string;

  /** Additional CSS classes */
  className?: string;
}

interface StatusStyle {
  dot: string;
  text: string;
  bg: string;
}

const statusStyles: Record<string, StatusStyle> = {
  active: {
    dot: 'bg-success',
    text: 'text-success-foreground',
    bg: 'bg-success-subtle',
  },
  paused: {
    dot: 'bg-warning',
    text: 'text-warning-foreground',
    bg: 'bg-warning-subtle',
  },
  error: {
    dot: 'bg-error',
    text: 'text-error-foreground',
    bg: 'bg-error-subtle',
  },
  idle: {
    dot: 'bg-muted-foreground/70',
    text: 'text-muted-foreground',
    bg: 'bg-muted/50',
  },
  deleted: {
    dot: 'bg-muted-foreground/70',
    text: 'text-muted-foreground',
    bg: 'bg-muted/50',
  },
  scheduled: {
    dot: 'bg-primary',
    text: 'text-primary',
    bg: 'bg-primary/10',
  },
};

const defaultStyle: StatusStyle = statusStyles.idle;

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status.toLowerCase()] ?? defaultStyle;
  const label = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        style.bg,
        style.text,
        className
      )}
    >
      <span className={cn('size-1.5 rounded-full', style.dot)} />
      {label}
    </span>
  );
}
