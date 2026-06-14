"use client";

import { useState, useCallback, useRef } from "react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Card } from "@repo/ui/primitives/card";
import { Badge } from "@repo/ui/primitives/badge";
import { Button } from "@repo/ui/primitives/button";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Download,
  Ban,
} from "lucide-react";
import {
  useImportJobQuery,
  useWordPressImportMutation,
  useImportsQuery,
  useCancelImportMutation,
} from "./hooks/use-import-query";
import { toast } from "sonner";
import type { ImportJob } from "@repo/types";

function formatTimestamp(value: unknown): string {
  if (!value) return "";
  if (typeof value === "object" && value !== null && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  if (typeof value === "object" && value !== null && "_seconds" in value) {
    return new Date(
      (value as { _seconds: number })._seconds * 1000,
    ).toLocaleDateString();
  }
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

function ImportStatusBadge({ status }: { status: ImportJob["status"] }) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="text-success border-success/30">
          <CheckCircle2 className="size-3 mr-1" />
          Completed
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="outline" className="text-error border-error/30">
          <XCircle className="size-3 mr-1" />
          Failed
        </Badge>
      );
    case "running":
      return (
        <Badge variant="outline" className="text-info border-info/30">
          <Loader2 className="size-3 mr-1 animate-spin" />
          Running
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

function ProgressBar({ imported, total }: { imported: number; total: number }) {
  const percentage = total > 0 ? Math.round((imported / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {imported} of {total} posts imported
        </span>
        <span className="tabular-nums">{percentage}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ActiveImport({ importId }: { importId: string }) {
  const { data: job } = useImportJobQuery(importId);
  const cancelMutation = useCancelImportMutation();

  if (!job) {
    return (
      <div className="flex items-center gap-2 p-4">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Loading import status…
        </span>
      </div>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          Import in Progress
        </h3>
        <div className="flex items-center gap-2">
          {job.status === "running" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-error hover:text-error"
              disabled={cancelMutation.isPending}
              onClick={() => {
                cancelMutation.mutate(importId, {
                  onSuccess: () => toast.success("Import cancelled"),
                  onError: (err) =>
                    toast.error(
                      err instanceof Error
                        ? err.message
                        : "Failed to cancel import",
                    ),
                });
              }}
            >
              <Ban className="size-3 mr-1" />
              {cancelMutation.isPending ? "Cancelling…" : "Cancel"}
            </Button>
          )}
          <ImportStatusBadge status={job.status} />
        </div>
      </div>

      <ProgressBar imported={job.importedPosts} total={job.totalPosts} />

      {job.failedPosts && job.failedPosts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-error flex items-center gap-1">
            <AlertTriangle className="size-3" />
            {job.failedPosts.length} post(s) failed
          </p>
          <div className="max-h-32 overflow-y-auto text-xs space-y-1">
            {job.failedPosts.map((fp) => (
              <div
                key={`${fp.slug}-${fp.error}`}
                className="flex gap-2 text-muted-foreground"
              >
                <span className="font-mono shrink-0">{fp.slug}</span>
                <span className="text-error truncate">{fp.error}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {job.status === "completed" && (
        <p className="text-sm text-success">
          Successfully imported {job.importedPosts} of {job.totalPosts} posts.
        </p>
      )}
    </Card>
  );
}

function ImportHistory() {
  const { data: imports = [] } = useImportsQuery();

  if (imports.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-medium text-foreground">Import History</h3>
      </div>
      <div className="divide-y divide-border">
        {imports.map((job) => (
          <div key={job.id} className="flex items-center gap-4 p-4 text-sm">
            <FileText className="size-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-foreground">{job.source} import</span>
              <span className="text-muted-foreground ml-2">
                {job.importedPosts}/{job.totalPosts} posts
              </span>
            </div>
            <ImportStatusBadge status={job.status} />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatTimestamp(job.startedAt)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function ImportPage() {
  const [activeImportId, setActiveImportId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importMutation = useWordPressImportMutation();

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".xml")) {
        toast.error("Please upload a .xml file");
        return;
      }

      try {
        const result = await importMutation.mutateAsync(file);
        setActiveImportId(result.id);
        toast.success(result.message);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    },
    [importMutation],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Import" },
        ]}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Import Content
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Import existing content from WordPress or other platforms.
            </p>
          </div>

          {/* WordPress Import Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                <svg
                  className="size-6"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zM3.5 12c0-1.39.328-2.704.899-3.875l4.956 13.584A8.51 8.51 0 013.5 12zm8.5 8.5a8.476 8.476 0 01-2.854-.494l3.03-8.805 3.103 8.503c.02.05.044.096.07.14A8.476 8.476 0 0112 20.5zm1.17-12.476c.608-.032 1.155-.096 1.155-.096.544-.064.48-.864-.064-.832 0 0-1.637.128-2.693.128-1.024 0-2.755-.128-2.755-.128-.544-.032-.608.8-.064.832 0 0 .526.064 1.07.096l1.582 4.34-2.222 6.67-3.7-11.01c.608-.032 1.155-.096 1.155-.096.544-.064.48-.864-.064-.832 0 0-1.637.128-2.693.128-.19 0-.413-.005-.65-.014A8.466 8.466 0 0112 3.5c2.213 0 4.228.847 5.74 2.232-.037-.002-.072-.008-.11-.008-1.024 0-1.75.893-1.75 1.852 0 .864.504 1.589 1.04 2.453.4.704.873 1.606.873 2.912 0 .905-.348 1.956-.808 3.42l-1.055 3.528-3.26-9.865z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  WordPress
                </h3>
                <p className="text-xs text-muted-foreground">
                  Import posts from a WordPress XML export (WXR) file
                </p>
              </div>
            </div>

            {/* Upload zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${dragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}
              `}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  fileInputRef.current?.click();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml"
                className="hidden"
                onChange={handleInputChange}
              />

              {importMutation.isPending ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="size-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Parsing and importing…
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="size-8 text-muted-foreground" />
                  <p className="text-sm text-foreground">
                    Drop your WordPress export file here
                  </p>
                  <p className="text-xs text-muted-foreground">
                    or click to browse (.xml, max 50MB)
                  </p>
                </div>
              )}
            </div>

            {/* How to export from WordPress */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">
                How to export from WordPress:
              </p>
              <ol className="list-decimal list-inside space-y-0.5 pl-1">
                <li>In WordPress, go to Tools &rarr; Export</li>
                <li>Select &quot;Posts&quot; or &quot;All content&quot;</li>
                <li>Click &quot;Download Export File&quot;</li>
                <li>Upload the .xml file here</li>
              </ol>
            </div>
          </Card>

          {/* Active import progress */}
          {activeImportId && <ActiveImport importId={activeImportId} />}

          {/* Redirects download hint */}
          {activeImportId && (
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Download className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">Need redirects?</p>
                  <p className="text-xs text-muted-foreground">
                    If any slugs changed during import, set up redirects in your
                    hosting platform to preserve SEO value.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Import history */}
          <ImportHistory />
        </div>
      </div>
    </div>
  );
}
