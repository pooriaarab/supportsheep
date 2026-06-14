"use client";

import { PageHeader } from "./page-header";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageShellProps {
  breadcrumbs: BreadcrumbItem[];
  actions?: React.ReactNode;
  isLoading?: boolean;
  children: React.ReactNode;
}

export function PageShell({
  breadcrumbs,
  actions,
  isLoading,
  children,
}: PageShellProps) {
  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={breadcrumbs}
        actions={actions}
        isLoading={isLoading}
      />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
    </div>
  );
}
