"use client";

import { useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Card } from "@repo/ui/primitives/card";
import { Badge } from "@repo/ui/primitives/badge";
import { Button } from "@repo/ui/primitives/button";
import {
  Play,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Zap,
} from "lucide-react";
import {
  useFunctionsQuery,
  useTriggerFunctionMutation,
  type CloudFunction,
} from "./hooks/use-functions-query";
import { toast } from "sonner";

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "success":
      return (
        <Badge variant="outline" className="text-success border-success/30">
          <CheckCircle2 className="size-3 mr-1" />
          Success
        </Badge>
      );
    case "warning":
      return (
        <Badge variant="outline" className="text-warning border-warning/30">
          <AlertTriangle className="size-3 mr-1" />
          Warning
        </Badge>
      );
    case "manual_trigger_requested":
      return (
        <Badge variant="outline" className="text-info border-info/30">
          <Play className="size-3 mr-1" />
          Triggered
        </Badge>
      );
    case "never_run":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Clock className="size-3 mr-1" />
          Never run
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {status}
        </Badge>
      );
  }
}

function formatTimestamp(ts: unknown): string {
  if (!ts) return "Never";
  // Handle Firestore Timestamp objects
  if (typeof ts === "object" && ts !== null && "_seconds" in ts) {
    const seconds = (ts as { _seconds: number })._seconds;
    return new Date(seconds * 1000).toLocaleString();
  }
  if (typeof ts === "string") {
    return new Date(ts).toLocaleString();
  }
  return "Unknown";
}

function FunctionRow({ fn }: { fn: CloudFunction }) {
  const [expanded, setExpanded] = useState(false);
  const triggerMutation = useTriggerFunctionMutation();

  const handleTrigger = useCallback(async () => {
    try {
      await triggerMutation.mutateAsync(fn.name);
      toast.success(`Manual trigger requested for ${fn.name}`);
    } catch {
      toast.error(`Failed to trigger ${fn.name}`);
    }
  }, [fn.name, triggerMutation]);

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Main row */}
      <div className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-primary shrink-0" />
            <span className="font-medium text-sm text-foreground truncate">
              {fn.name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fn.description}
          </p>
        </div>

        <div className="hidden sm:block text-xs text-muted-foreground whitespace-nowrap">
          <Clock className="size-3 inline mr-1" />
          {fn.schedule}
        </div>

        <div className="hidden md:block text-xs text-muted-foreground whitespace-nowrap min-w-[140px] text-right">
          {formatTimestamp(fn.lastRunAt)}
        </div>

        <StatusBadge status={fn.lastStatus} />

        <Button
          variant="outline"
          size="sm"
          onClick={handleTrigger}
          disabled={triggerMutation.isPending}
          className="shrink-0"
        >
          {triggerMutation.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Play className="size-3" />
          )}
          <span className="ml-1 hidden sm:inline">Run</span>
        </Button>
      </div>

      {/* Expanded logs */}
      {expanded && (
        <div className="px-4 pb-4 pl-12">
          <h4 className="text-xs font-medium text-muted-foreground mb-2">
            Recent Logs
          </h4>
          {fn.recentLogs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No logs yet</p>
          ) : (
            <div className="space-y-1">
              {fn.recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-3 text-xs py-1.5 px-2 rounded bg-muted/30"
                >
                  <StatusBadge status={log.status} />
                  <span className="text-muted-foreground flex-1">
                    {formatTimestamp(log.executedAt)}
                  </span>
                  <span className="text-muted-foreground font-mono">
                    {formatLogDetails(log)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatLogDetails(log: Record<string, unknown>): string {
  // Show relevant numeric details from the log
  const parts: string[] = [];
  if (typeof log.publishedCount === "number") {
    parts.push(`published: ${log.publishedCount}`);
  }
  if (typeof log.postsMarked === "number") {
    parts.push(`marked: ${log.postsMarked}`);
  }
  if (typeof log.brokenLinkCount === "number") {
    parts.push(`broken: ${log.brokenLinkCount}`);
  }
  if (typeof log.articlesChecked === "number") {
    parts.push(`checked: ${log.articlesChecked}`);
  }
  return parts.join(", ");
}

export default function FunctionsPage() {
  const { data: functions = [], isLoading } = useFunctionsQuery();

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Functions" },
        ]}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Cloud Functions
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor scheduled Cloud Functions, view execution logs, and
              trigger manual runs.
            </p>
          </div>

          {/* Functions list */}
          <Card className="divide-y-0 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading functions…
                </span>
              </div>
            ) : functions.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No functions configured
              </div>
            ) : (
              functions.map((fn) => <FunctionRow key={fn.name} fn={fn} />)
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
