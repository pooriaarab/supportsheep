/**
 * Stat Grid Component
 *
 * Responsive grid wrapper for StatCard components.
 * Adapts from 1 column on mobile to the specified column count on larger screens.
 *
 * Usage:
 * ```tsx
 * <StatGrid columns={4}>
 *   <StatCard ... />
 *   <StatCard ... />
 *   <StatCard ... />
 *   <StatCard ... />
 * </StatGrid>
 * ```
 */

import { cn } from "@repo/ui/utils";

interface StatGridProps {
  /** Grid items */
  children: React.ReactNode;

  /** Number of columns at full width (default: 4) */
  columns?: 2 | 3 | 4;
}

const columnClasses: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
};

export function StatGrid({ children, columns = 4 }: StatGridProps) {
  return (
    <div className={cn("grid gap-4", columnClasses[columns])}>{children}</div>
  );
}
