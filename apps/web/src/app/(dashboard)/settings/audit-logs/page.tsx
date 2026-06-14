"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { type ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/ui/layout/page-header";
import { TableToolbar } from "@/components/shared/table-toolbar";
import { DataTable } from "@/components/ui/data-display/data-table";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { ExpandableSearch } from "@repo/ui/composites/expandable-search";
import { FileText, Loader2 } from "lucide-react";

interface AuditLogEntry {
  id: string;
  timestamp: string | null;
  actor: string;
  action: string;
  target: string;
  ip: string;
}

async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  const res = await fetch("/api/v1/audit-logs?limit=200");
  if (!res.ok) throw new Error("Failed to fetch audit logs");
  const json = await res.json();
  return json.data;
}

const actionColors: Record<string, string> = {
  create: "bg-success-subtle text-success-foreground",
  login: "bg-info-subtle text-info-foreground",
  update: "bg-warning-subtle text-warning-foreground",
  delete: "bg-error-subtle text-error-foreground",
  revoke: "bg-error-subtle text-error-foreground",
  connect: "bg-success-subtle text-success-foreground",
  invite: "bg-info-subtle text-info-foreground",
};

function getActionColor(action: string): string {
  const verb = action.split(".")[1] ?? action.split("_").pop() ?? "";
  return actionColors[verb] ?? "bg-muted text-muted-foreground";
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "--";
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AuditLogsPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: queryKeys.auditLogs.lists(),
    queryFn: fetchAuditLogs,
  });

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        log.actor.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.target.toLowerCase().includes(q),
    );
  }, [logs, searchQuery]);

  const columns = useMemo<ColumnDef<AuditLogEntry>[]>(
    () => [
      {
        accessorKey: "timestamp",
        header: "Timestamp",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {formatTimestamp(row.original.timestamp)}
          </span>
        ),
      },
      {
        accessorKey: "actor",
        header: "Actor",
        cell: ({ row }) => (
          <span className="text-sm font-medium text-foreground">
            {row.original.actor}
          </span>
        ),
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => (
          <span
            className={`px-2 py-0.5 rounded-md text-xs font-medium ${getActionColor(
              row.original.action,
            )}`}
          >
            {row.original.action}
          </span>
        ),
      },
      {
        accessorKey: "target",
        header: "Target",
        cell: ({ row }) => (
          <code className="text-xs font-mono text-muted-foreground">
            {row.original.target}
          </code>
        ),
      },
      {
        accessorKey: "ip",
        header: "IP Address",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums font-mono">
            {row.original.ip}
          </span>
        ),
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
            { label: "Audit Logs" },
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
          { label: "Audit Logs" },
        ]}
      />

      <TableToolbar
        left={null}
        right={
          <ExpandableSearch
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search logs..."
          />
        }
      />

      <div className="flex-1 overflow-y-auto">
        <DataTable
          data={filteredLogs}
          columns={columns}
          getRowId={(row) => row.id}
          enableSorting
          enableVirtualization
          estimatedRowHeight={48}
          tableId="audit-logs-table"
          emptyState={
            filteredLogs.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No Audit Logs"
                description="No activity has been recorded yet. Audit logs track all actions performed in the system."
              />
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
