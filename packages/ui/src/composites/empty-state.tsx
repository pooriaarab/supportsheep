import { cn } from '../utils';
import { type LucideIcon, BarChart3, AlertCircle, Inbox, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../primitives/button';

type EmptyStateVariant = 'default' | 'error' | 'info';
type EmptyStateSize = 'default' | 'sm';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  variant?: EmptyStateVariant;
  size?: EmptyStateSize;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  className?: string;
}

const variantDefaults: Record<EmptyStateVariant, { icon: LucideIcon; iconClass: string }> = {
  default: { icon: BarChart3, iconClass: 'text-muted-foreground/50' },
  error: { icon: AlertCircle, iconClass: 'text-error' },
  info: { icon: Inbox, iconClass: 'text-info' },
};

export function EmptyState({
  icon,
  title,
  description,
  variant = 'default',
  size = 'default',
  action,
  className,
}: EmptyStateProps) {
  const defaults = variantDefaults[variant];
  const Icon = icon ?? defaults.icon;
  const sm = size === 'sm';

  return (
    <div className={cn('flex flex-col items-center justify-center text-center', sm ? 'py-10' : 'p-12', className)}>
      <Icon className={cn(sm ? 'size-5 mb-2' : 'size-12 mb-4', sm ? 'text-muted-foreground/40' : defaults.iconClass)} aria-hidden="true" />
      <h3 className={cn(sm ? 'text-sm font-medium text-muted-foreground' : 'text-lg font-semibold')}>{title}</h3>
      <p className={cn('text-muted-foreground max-w-md', sm ? 'text-xs mt-1 opacity-70' : 'text-sm mt-2')}>{description}</p>
      {action && (
        action.href && !action.onClick ? (
          <Button asChild className="mt-4" variant="outline">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button className="mt-4" variant="outline" onClick={action.onClick}>
            {action.label}
          </Button>
        )
      )}
    </div>
  );
}

export function NoDataEmptyState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      title="No data available"
      description="No data for the selected time range. Try adjusting filters or date range."
      action={onRefresh ? { label: 'Refresh', onClick: onRefresh } : undefined}
    />
  );
}

export function ErrorEmptyState({ errorMessage, onRetry }: { errorMessage: string; onRetry?: () => void }) {
  return (
    <EmptyState
      title="Failed to load data"
      description={`Error loading this chart: ${errorMessage}`}
      variant="error"
      action={onRetry ? { label: 'Try Again', onClick: onRetry } : undefined}
    />
  );
}

export function NoAdoptionEmptyState({ featureName }: { featureName: string }) {
  return (
    <EmptyState
      title={`No ${featureName} data yet`}
      description="This feature hasn't been adopted yet. Check back later."
      icon={TrendingUp}
      variant="info"
    />
  );
}

export function InsufficientDataEmptyState({ minRequired }: { minRequired: string }) {
  return (
    <EmptyState
      title="Insufficient data"
      description={`This chart requires ${minRequired} to display meaningful insights.`}
      variant="info"
    />
  );
}
