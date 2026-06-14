"use client";

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { type ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/ui/layout/page-header";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { DataTable } from "@/components/ui/data-display/data-table";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { ConfirmDialog } from "@repo/ui/composites/confirm-dialog";
import { Button } from "@repo/ui/primitives/button";
import { Badge } from "@repo/ui/primitives/badge";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/primitives/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/primitives/dropdown-menu";
import {
  Plus,
  KeyRound,
  MoreVertical,
  Trash2,
  Copy,
  Loader2,
} from "lucide-react";
import { ExpandableSearch } from "@repo/ui/composites/expandable-search";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  keyPreview: string;
  scopes: string[];
  createdAt: string | number | null;
  lastUsed: string | number | null;
}

async function fetchApiKeys(): Promise<ApiKey[]> {
  const res = await fetch("/api/v1/api-keys");
  if (!res.ok) throw new Error("Failed to fetch API keys");
  const json = await res.json();
  return json.data;
}

async function createApiKey(data: {
  name: string;
  scopes: string[];
}): Promise<{ key: string; id: string; name: string }> {
  const res = await fetch("/api/v1/api-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create API key");
  return res.json();
}

async function revokeApiKeys(ids: string[]): Promise<void> {
  const res = await fetch("/api/v1/api-keys", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error("Failed to revoke API key");
}

function formatDate(value: string | number | null): string {
  if (!value) return "Never";
  const d = typeof value === "number" ? new Date(value) : new Date(value);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ApiKeysPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: queryKeys.apiKeys.lists(),
    queryFn: fetchApiKeys,
  });

  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
      toast.success(`API key "${data.name}" created. Key: ${data.key}`);
      setNewKeyName("");
      setCreateOpen(false);
    },
    onError: () => {
      toast.error("Failed to create API key");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeApiKeys,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.apiKeys.all });
      toast.success("API key revoked");
      setRevokeId(null);
    },
    onError: () => {
      toast.error("Failed to revoke API key");
    },
  });

  const filteredKeys = useMemo(() => {
    if (!searchQuery) return keys;
    const q = searchQuery.toLowerCase();
    return keys.filter(
      (k) =>
        k.name.toLowerCase().includes(q) ||
        k.scopes.some((s) => s.includes(q)),
    );
  }, [keys, searchQuery]);

  const handleCreate = useCallback(() => {
    if (!newKeyName.trim()) return;
    createMutation.mutate({ name: newKeyName.trim(), scopes: ["read", "write"] });
  }, [newKeyName, createMutation]);

  const handleRevoke = useCallback(() => {
    if (!revokeId) return;
    revokeMutation.mutate([revokeId]);
  }, [revokeId, revokeMutation]);

  const columns = useMemo<ColumnDef<ApiKey>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.name}
          </span>
        ),
      },
      {
        accessorKey: "keyPreview",
        header: "Key",
        cell: ({ row }) => (
          <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
            {row.original.keyPreview}
          </code>
        ),
      },
      {
        accessorKey: "scopes",
        header: "Scopes",
        cell: ({ row }) => (
          <div className="flex gap-1">
            {row.original.scopes.map((scope) => (
              <Badge key={scope} variant="secondary" className="text-[10px]">
                {scope}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDate(row.original.createdAt)}
          </span>
        ),
      },
      {
        accessorKey: "lastUsed",
        header: "Last Used",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDate(row.original.lastUsed)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="sm" className="size-8 p-0">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  navigator.clipboard.writeText(row.original.keyPreview);
                  toast.success("Key preview copied to clipboard");
                }}
              >
                <Copy className="size-3.5 mr-2" />
                Copy Key
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setRevokeId(row.original.id)}
                className="text-error focus:text-error"
              >
                <Trash2 className="size-3.5 mr-2" />
                Revoke
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        enableSorting: false,
        size: 48,
      },
    ],
    [],
  );

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <PageHeader
          breadcrumbs={[
            { label: "Settings", href: "/settings" },
            { label: "API Keys" },
          ]}
        />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "API Keys" },
        ]}
      />

      <TableToolbar
        left={null}
        right={
          <>
            <ExpandableSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search keys..."
            />
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-3.5" />
              Create Key
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <DataTable
          data={filteredKeys}
          columns={columns}
          getRowId={(row) => row.id}
          enableSorting
          tableId="api-keys-table"
          emptyState={
            filteredKeys.length === 0 ? (
              <EmptyState
                icon={KeyRound}
                title="No API Keys"
                description="Create an API key to authenticate programmatic access to your account."
                action={{ label: "Create Key", onClick: () => setCreateOpen(true) }}
              />
            ) : undefined
          }
        />
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Give your API key a descriptive name so you can identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                placeholder="e.g., Production API"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newKeyName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirmation */}
      <ConfirmDialog
        open={!!revokeId}
        onOpenChange={(open) => !open && setRevokeId(null)}
        title="Revoke API Key"
        description="Revoking this key will immediately disable all API requests using it. This action cannot be undone."
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={handleRevoke}
      />
    </div>
  );
}
