/**
 * SVG ring overlay showing an agent's XP level progress around an avatar.
 *
 * Lives in primitives/ — imports only from lib/ utilities.
 */

'use client';

import { cn } from '../utils';

interface LevelRingProps {
  /** Agent level (1-10) */
  level: number;
  /** XP progress within current level (0-1) */
  xpProgress: number;
  /** Size must match the avatar it wraps */
  size: number;
  children: React.ReactNode;
  className?: string;
}

function getRingStyle(level: number) {
  if (level <= 3) return { width: 2, colorClass: 'stroke-muted-foreground/50' };
  if (level <= 6) return { width: 2.5, colorClass: 'stroke-info' };
  if (level <= 8) return { width: 3, colorClass: 'stroke-warning' };
  return { width: 3.5, colorClass: 'stroke-chart-1' };
}

export function LevelRing({ level, xpProgress, size, children, className }: LevelRingProps) {
  const clampedProgress = Math.max(0, Math.min(1, xpProgress));
  const ring = getRingStyle(level);
  const padding = ring.width + 2;
  const outerSize = size + padding * 2;
  const center = outerSize / 2;
  const radius = size / 2 + ring.width / 2 + 1;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference * (1 - clampedProgress);

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: outerSize, height: outerSize }}>
      <svg
        width={outerSize}
        height={outerSize}
        className="absolute inset-0"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={ring.width}
          className="stroke-muted/50"
        />
        {/* Progress ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={ring.width}
          className={ring.colorClass}
          strokeDasharray={circumference}
          strokeDashoffset={progressOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
        />
      </svg>
      {/* High level shimmer effect (levels 9-10) */}
      {level >= 9 && (
        <svg
          width={outerSize}
          height={outerSize}
          className="absolute inset-0 animate-level-shimmer"
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            strokeWidth={ring.width}
            className="stroke-chart-1/30"
            strokeDasharray={`${circumference * 0.15} ${circumference * 0.85}`}
            strokeLinecap="round"
          />
        </svg>
      )}
      {/* Avatar content */}
      <div className="relative">{children}</div>
    </div>
  );
}
