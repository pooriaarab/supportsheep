'use client';

import { cn } from '../utils';

type OverlaySize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface StatusOverlayProps {
  status?: string;
  size?: OverlaySize;
  children: React.ReactNode;
  className?: string;
}

export function StatusOverlay({ status, size = 'md', children, className }: StatusOverlayProps) {
  const normalizedStatus = status?.toLowerCase() ?? '';

  return (
    <div className={cn('relative inline-flex', className)}>
      {/* Apply filters to children */}
      <div className={cn(
        normalizedStatus === 'deleted' && 'opacity-40 grayscale',
      )}>
        {children}
      </div>

      {/* Active: subtle green pulse ring */}
      {normalizedStatus === 'active' && (
        <div className="absolute inset-0 rounded-full ring-2 ring-success/40 animate-status-pulse" />
      )}

      {/* Error: gentle shake indicator */}
      {normalizedStatus === 'error' && (
        <div className={cn(
          'absolute rounded-full bg-error animate-status-shake',
          size === 'xs' ? '-top-0.5 -right-0.5 size-1.5' :
          size === 'sm' ? '-top-0.5 -right-0.5 size-2' :
          size === 'xl' ? '-top-0.5 -right-0.5 size-3.5' :
          '-top-0.5 -right-0.5 size-2.5',
        )} />
      )}

      {/* Paused: zzz badge */}
      {normalizedStatus === 'paused' && size !== 'xs' && (
        <span className={cn(
          'absolute flex items-center justify-center rounded-full bg-warning/80 text-warning-foreground font-bold leading-none',
          size === 'sm' ? '-bottom-0.5 -right-1 text-[6px] px-0.5 h-3' :
          size === 'xl' ? '-bottom-0.5 -right-2 text-[9px] px-1.5 h-4.5' :
          '-bottom-0.5 -right-1.5 text-[7px] px-1 h-3.5',
        )}>
          zzz
        </span>
      )}

      {/* Idle: zzz badge (muted) */}
      {normalizedStatus === 'idle' && size !== 'xs' && (
        <span className={cn(
          'absolute flex items-center justify-center rounded-full bg-muted text-muted-foreground font-bold leading-none',
          size === 'sm' ? '-bottom-0.5 -right-1 text-[6px] px-0.5 h-3' :
          size === 'xl' ? '-bottom-0.5 -right-2 text-[9px] px-1.5 h-4.5' :
          '-bottom-0.5 -right-1.5 text-[7px] px-1 h-3.5',
        )}>
          zzz
        </span>
      )}
    </div>
  );
}
