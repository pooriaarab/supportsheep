"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@repo/ui/primitives/breadcrumb";
import { Skeleton } from "@repo/ui/primitives/skeleton";

interface BreadcrumbItemType {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  breadcrumbs: BreadcrumbItemType[];
  actions?: React.ReactNode;
  isLoading?: boolean;
}

function PageHeaderSkeleton() {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between h-10 px-4 sm:px-6 border-b bg-background">
      <Skeleton className="h-4 w-48" />
    </div>
  );
}

export function PageHeader({
  breadcrumbs,
  actions,
  isLoading = false,
}: PageHeaderProps) {
  if (isLoading) {
    return <PageHeaderSkeleton />;
  }

  return (
    <div className="sticky top-0 z-10 flex items-center justify-between h-10 px-4 sm:px-6 border-b bg-background">
      <nav aria-label="Breadcrumb">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <div
                  key={`${crumb.href ?? "current"}-${crumb.label}`}
                  className="flex items-center"
                >
                  {index > 0 && (
                    <BreadcrumbSeparator>
                      <ChevronRight className="size-4" />
                    </BreadcrumbSeparator>
                  )}
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage className="font-medium text-sm">
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : crumb.href ? (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href} className="text-sm">
                          {crumb.label}
                        </Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="text-sm">
                        {crumb.label}
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </div>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </nav>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  );
}
