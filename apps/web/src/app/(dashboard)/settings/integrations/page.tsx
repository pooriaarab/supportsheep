"use client";

import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { useDisplaySettings } from "@/hooks/use-display-settings";
import { useDataTableDisplay } from "@/hooks/use-data-table-display";
import { BottomBulkActionsBar } from "@repo/ui/composites/bottom-bulk-actions-bar";
import { ConfirmDialog } from "@repo/ui/composites/confirm-dialog";
import {
  useIntegrationsQuery,
  useDisconnectIntegrationMutation,
  useDeleteIntegrationsMutation,
  type Integration,
} from "@/hooks/use-integrations-query";
import { useIntegrationColumns } from "@/components/settings/integrations-columns";
import {
  IntegrationsToolbar,
  type IntegrationStatusFilter,
  type IntegrationTypeFilter,
} from "@/components/settings/integrations-toolbar";
import { IntegrationsContent } from "@/components/settings/integrations-content";
import { AddIntegrationDialog } from "@/components/settings/add-integration-dialog";
import {
  INTEGRATION_DEFAULT_SETTINGS,
  INTEGRATION_DISPLAY_PROPERTIES,
} from "./constants";
import { toast } from "sonner";

export default function IntegrationsPage() {
  const { data: integrations = [], isLoading } = useIntegrationsQuery();
  const disconnectMutation = useDisconnectIntegrationMutation();
  const deleteMutation = useDeleteIntegrationsMutation();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<IntegrationStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<IntegrationTypeFilter>("all");
  const [selectedItems, setSelectedItems] = useState<Integration[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const [displaySettings, setDisplaySettings] = useDisplaySettings(
    "integrations-page",
    INTEGRATION_DEFAULT_SETTINGS,
  );

  const { sorting, columnVisibility, onSortingChange } = useDataTableDisplay(
    displaySettings,
    setDisplaySettings,
    INTEGRATION_DISPLAY_PROPERTIES,
  );

  const filteredIntegrations = useMemo(() => {
    let result = integrations;

    if (statusFilter !== "all") {
      result = result.filter((i) => i.status === statusFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter((i) => i.type === typeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q),
      );
    }

    return result;
  }, [integrations, statusFilter, typeFilter, searchQuery]);

  const handleDisconnect = useCallback(
    async (id: string) => {
      try {
        await disconnectMutation.mutateAsync(id);
        toast.success("Integration disconnected");
        setDisconnectingId(null);
      } catch {
        toast.error("Failed to disconnect integration");
      }
    },
    [disconnectMutation],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync([id]);
        toast.success("Integration deleted");
        setDeletingId(null);
      } catch {
        toast.error("Failed to delete integration");
      }
    },
    [deleteMutation],
  );

  const handleBulkDelete = useCallback(async () => {
    try {
      const ids = selectedItems.map((item) => item.id);
      await deleteMutation.mutateAsync(ids);
      toast.success(`${ids.length} integration${ids.length === 1 ? "" : "s"} deleted`);
      setSelectedItems([]);
      setDeleteConfirmOpen(false);
    } catch {
      toast.error("Failed to delete integrations");
    }
  }, [selectedItems, deleteMutation]);

  const columns = useIntegrationColumns({
    onDisconnect: setDisconnectingId,
    onDelete: setDeletingId,
  });

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Integrations" },
        ]}
      />

      <IntegrationsToolbar
        displaySettings={displaySettings}
        onDisplaySettingsChange={setDisplaySettings}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        onStatusFilterChange={setStatusFilter}
        onTypeFilterChange={setTypeFilter}
        onAddIntegration={() => setAddDialogOpen(true)}
      />

      <div className="flex-1 overflow-y-auto">
        <IntegrationsContent
          integrations={filteredIntegrations}
          loading={isLoading}
          columns={columns}
          sorting={sorting}
          onSortingChange={onSortingChange}
          columnVisibility={columnVisibility}
          onSelectionChange={setSelectedItems}
          view={displaySettings.view}
          onConnect={() => setAddDialogOpen(true)}
          onDisconnect={setDisconnectingId}
        />
      </div>

      {/* Bulk Actions */}
      <BottomBulkActionsBar
        count={selectedItems.length}
        onClear={() => setSelectedItems([])}
        onActionsClick={() => setDeleteConfirmOpen(true)}
        itemNameSingular="integration"
        itemNamePlural="integrations"
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete Integrations"
        description={`Are you sure you want to delete ${selectedItems.length} integration${selectedItems.length === 1 ? "" : "s"}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleBulkDelete}
        loading={deleteMutation.isPending}
      />

      {/* Single Delete Confirmation */}
      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => !open && setDeletingId(null)}
        title="Delete Integration"
        description="Are you sure you want to delete this integration? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => deletingId && handleDelete(deletingId)}
        loading={deleteMutation.isPending}
      />

      {/* Disconnect Confirmation */}
      <ConfirmDialog
        open={!!disconnectingId}
        onOpenChange={(open) => !open && setDisconnectingId(null)}
        title="Disconnect Integration"
        description="Are you sure you want to disconnect this integration? You can reconnect it later."
        confirmLabel="Disconnect"
        variant="destructive"
        onConfirm={() => disconnectingId && handleDisconnect(disconnectingId)}
        loading={disconnectMutation.isPending}
      />

      {/* Add Integration Dialog */}
      <AddIntegrationDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
      />
    </div>
  );
}
