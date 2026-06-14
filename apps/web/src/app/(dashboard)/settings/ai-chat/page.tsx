"use client";

/**
 * Settings > AI Chat page
 *
 * Displays recent AI chat conversations in a DataTable and provides
 * configuration controls for the AI assistant (system prompt, model,
 * temperature, max tokens). Clicking a row opens a slide-out detail panel.
 */

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { type ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/ui/layout/page-header";
import { DetailPanel } from "@/components/ui/layout/detail-panel";
import { DataTable } from "@/components/ui/data-display/data-table";
import { EmptyState } from "@repo/ui/composites/empty-state";
import { Badge } from "@repo/ui/primitives/badge";
import { Card } from "@repo/ui/primitives/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/primitives/tabs";
import { Bot, MessageCircle, Settings, Loader2 } from "lucide-react";
import { AiChatConfig } from "@/components/settings/ai-chat-config";
import {
  AiChatDetail,
  type ChatThreadDetail,
} from "@/components/settings/ai-chat-detail";
import { toast } from "sonner";

/* ---------- Types ---------- */

interface ThreadSummary {
  id: string;
  preview: string;
  messageCount: number;
  lastActive: string | null;
  status: "active" | "ended";
}

/* ---------- API helpers ---------- */

async function fetchThreads(): Promise<ThreadSummary[]> {
  const res = await fetch("/api/v1/ai/chat/threads");
  if (!res.ok) throw new Error("Failed to fetch threads");
  const json = await res.json();
  return json.data;
}

async function fetchThreadMessages(
  threadId: string,
): Promise<ChatThreadDetail["messages"]> {
  const res = await fetch(`/api/v1/ai/chat?threadId=${threadId}`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  const json = await res.json();
  return json.data;
}

async function deleteThread(threadId: string): Promise<void> {
  const res = await fetch("/api/v1/ai/chat/threads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId }),
  });
  if (!res.ok) throw new Error("Failed to delete thread");
}

/* ---------- Helpers ---------- */

function formatDate(dateString: string | null): string {
  if (!dateString) return "--";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/* ---------- Page ---------- */

export default function AiChatSettingsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ChatThreadDetail | null>(null);

  const { data: threads = [], isLoading } = useQuery({
    queryKey: queryKeys.aiChatThreads.lists(),
    queryFn: fetchThreads,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteThread,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiChatThreads.all });
      toast.success("Thread deleted");
    },
    onError: () => {
      toast.error("Failed to delete thread");
    },
  });

  const columns = useMemo<ColumnDef<ThreadSummary>[]>(
    () => [
      {
        accessorKey: "preview",
        header: "Conversation",
        cell: ({ row }) => (
          <span className="font-medium text-foreground line-clamp-1">
            {row.original.preview}
          </span>
        ),
      },
      {
        accessorKey: "messageCount",
        header: "Messages",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.original.messageCount}
          </span>
        ),
        size: 100,
      },
      {
        accessorKey: "lastActive",
        header: "Last Active",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDate(row.original.lastActive)}
          </span>
        ),
        size: 160,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "active" ? "default" : "secondary"}
            className="text-[10px]"
          >
            {row.original.status}
          </Badge>
        ),
        size: 100,
      },
    ],
    [],
  );

  const handleRowClick = useCallback(
    async (row: ThreadSummary) => {
      try {
        const messages = await fetchThreadMessages(row.id);
        setSelected({
          id: row.id,
          preview: row.preview,
          messageCount: row.messageCount,
          lastActive: row.lastActive ?? new Date().toISOString(),
          status: row.status,
          messages,
        });
      } catch {
        toast.error("Failed to load conversation");
      }
    },
    [],
  );

  const handleClosePanel = useCallback(() => {
    setSelected(null);
  }, []);

  const handleDelete = useCallback(
    (threadId: string) => {
      deleteMutation.mutate(threadId);
      if (selected?.id === threadId) setSelected(null);
    },
    [selected, deleteMutation],
  );

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "AI Chat" },
        ]}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Tabs defaultValue="config" className="space-y-4">
            <TabsList>
              <TabsTrigger value="config" className="gap-1.5">
                <Settings className="size-3.5" />
                Configuration
              </TabsTrigger>
              <TabsTrigger value="conversations" className="gap-1.5">
                <MessageCircle className="size-3.5" />
                Conversations
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config">
              <Card className="p-6">
                <div className="pb-4 border-b border-border mb-6">
                  <h3 className="text-fluid-lg font-medium text-foreground tracking-tight leading-tight">
                    AI Assistant Configuration
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                    Customize the behavior and capabilities of the AI chat
                    assistant
                  </p>
                </div>
                <AiChatConfig />
              </Card>
            </TabsContent>

            <TabsContent value="conversations">
              <Card className="overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">
                    Recent Conversations
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Browse past AI chat sessions
                  </p>
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <DataTable
                    data={threads}
                    columns={columns}
                    getRowId={(row) => row.id}
                    enableSorting
                    tableId="ai-chat-threads"
                    onRowClick={handleRowClick}
                    emptyState={
                      threads.length === 0 ? (
                        <EmptyState
                          icon={Bot}
                          title="No Conversations"
                          description="Start a chat with the AI assistant using the floating widget."
                        />
                      ) : undefined
                    }
                  />
                )}
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <DetailPanel
        open={selected !== null}
        onClose={handleClosePanel}
        title="Conversation"
      >
        {selected && (
          <AiChatDetail thread={selected} onDelete={handleDelete} />
        )}
      </DetailPanel>
    </div>
  );
}
