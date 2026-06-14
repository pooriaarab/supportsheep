"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui/primitives/tabs";
import { PageHeader } from "./page-header";

interface Tab {
  value: string;
  label: string;
  content: React.ReactNode;
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface DetailLayoutProps {
  backHref: string;
  backLabel?: string;
  /** Breadcrumb items for the sticky page header. When provided, renders a
   *  breadcrumb trail (e.g. "Items > Website Redesign"). When omitted, falls
   *  back to a single breadcrumb using `backLabel`. */
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  subtitle?: string;
  tabs: Tab[];
  defaultTab?: string;
  actions?: React.ReactNode;
}

export function DetailLayout({
  backHref,
  backLabel = "Back",
  breadcrumbs,
  title,
  subtitle,
  tabs,
  defaultTab,
  actions,
}: DetailLayoutProps) {
  const headerBreadcrumbs: BreadcrumbItem[] = breadcrumbs ?? [
    { label: backLabel, href: backHref },
    { label: title },
  ];

  return (
    <div className="h-full flex flex-col">
      <PageHeader breadcrumbs={headerBreadcrumbs} />
      <div className="border-b bg-background px-4 sm:px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          {actions && <div className="ml-4 shrink-0">{actions}</div>}
        </div>
      </div>
      <Tabs
        defaultValue={defaultTab || tabs[0]?.value}
        className="flex-1 flex flex-col"
      >
        <div className="border-b bg-background px-4 sm:px-6">
          <TabsList className="bg-transparent h-auto p-0 gap-4">
            {tabs.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none px-0 pb-3 pt-3 text-sm font-medium"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabs.map((tab) => (
          <TabsContent
            key={tab.value}
            value={tab.value}
            className="flex-1 overflow-y-auto p-4 sm:p-6 mt-0"
          >
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
