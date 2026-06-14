"use client";

import { useCallback } from "react";
import { type ColumnDef, type SortingState } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-display/data-table";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { StatusBadge } from "@repo/ui/composites/status-badge";
import { Badge } from "@repo/ui/primitives/badge";
import { Button } from "@repo/ui/primitives/button";
import { Plug, Unplug } from "lucide-react";
import type { ViewType } from "@repo/ui/composites/display-popover";
import type { Integration } from "@/hooks/use-integrations-query";

const TYPE_LABELS: Record<string, string> = {
  oauth: "OAuth",
  api_key: "API Key",
  webhook: "Webhook",
};

const STATUS_MAP: Record<string, string> = {
  connected: "active",
  disconnected: "idle",
  error: "error",
};

interface IntegrationsContentProps {
  integrations: Integration[];
  loading: boolean;
  columns: ColumnDef<Integration>[];
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
  columnVisibility: Record<string, boolean>;
  onSelectionChange: (items: Integration[]) => void;
  view: ViewType;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}

function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
}: {
  integration: Integration;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}) {
  const isConnected = integration.status === "connected";

  return (
    <div className="rounded-lg border border-border bg-card p-4 hover:border-ring hover:shadow-sm transition-[border-color,box-shadow]">
      <div className="flex items-center gap-3 mb-3">
        <div className="size-9 rounded-md bg-muted flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-foreground">
            {integration.icon}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {integration.name}
          </h3>
          <Badge variant="outline" className="text-[10px] font-normal mt-0.5">
            {TYPE_LABELS[integration.type] ?? integration.type}
          </Badge>
        </div>
        <StatusBadge status={STATUS_MAP[integration.status] ?? "idle"} />
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
        {integration.description}
      </p>
      <Button
        size="sm"
        variant={isConnected ? "outline" : "default"}
        className="text-xs gap-1.5 w-full"
        onClick={() =>
          isConnected
            ? onDisconnect(integration.id)
            : onConnect(integration.id)
        }
      >
        {isConnected ? (
          <>
            <Unplug className="size-3" />
            Disconnect
          </>
        ) : (
          <>
            <Plug className="size-3" />
            Connect
          </>
        )}
      </Button>
    </div>
  );
}

export function IntegrationsContent({
  integrations,
  loading,
  columns,
  sorting,
  onSortingChange,
  columnVisibility,
  onSelectionChange,
  view,
  onConnect,
  onDisconnect,
}: IntegrationsContentProps) {
  const navigateToIntegration = useCallback((_row: Integration) => {
    // Navigate to integration detail if needed
  }, []);

  if (view === "board") {
    if (!loading && integrations.length === 0) {
      return (
        <div className="p-6">
          <EmptyState
            icon={Plug}
            title="No Integrations"
            description="Add your first integration to connect external services."
          />
        </div>
      );
    }

    return (
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {integrations.map((integration) => (
            <IntegrationCard
              key={integration.id}
              integration={integration}
              onConnect={onConnect}
              onDisconnect={onDisconnect}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <DataTable
      data={integrations}
      columns={columns}
      getRowId={(row) => row.id}
      enableSorting
      enableRowSelection
      enableVirtualization
      estimatedRowHeight={53}
      onRowClick={navigateToIntegration}
      onSelectionChange={onSelectionChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      tableId="integrations-table"
      initialSettings={{ columnVisibility }}
      emptyMessage={loading ? "Loading integrations..." : "No integrations found"}
      emptyState={
        !loading && integrations.length === 0 ? (
          <EmptyState
            icon={Plug}
            title="No Integrations"
            description="Add your first integration to connect external services."
          />
        ) : undefined
      }
    />
  );
}
