"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { Card } from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import { toast } from "sonner";
import { Loader2, Code } from "lucide-react";
import { useRouter } from "next/navigation";

export default function OpenAPIImportPage() {
  const [spec, setSpec] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const router = useRouter();

  const handleImport = async () => {
    if (!spec.trim()) {
      toast.error("Please paste an OpenAPI spec first.");
      return;
    }

    setIsImporting(true);

    try {
      const res = await fetch("/api/v1/import/openapi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ spec }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to import spec");
      }

      toast.success(data.message);
      router.push("/settings/import");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        breadcrumbs={[
          { label: "Settings", href: "/settings" },
          { label: "Import", href: "/settings/import" },
          { label: "OpenAPI Spec" },
        ]}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Import OpenAPI Spec
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Paste your OpenAPI specification (JSON or YAML) to generate draft API reference articles.
            </p>
          </div>

          <Card className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                <Code className="size-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  OpenAPI Definition
                </h3>
                <p className="text-xs text-muted-foreground">
                  Provide your schema definition content below.
                </p>
              </div>
            </div>

            <textarea
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              placeholder="Paste your JSON or YAML spec here..."
              className="w-full h-64 p-3 font-mono text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
              disabled={isImporting}
            />

            <div className="flex justify-end">
              <Button
                onClick={handleImport}
                disabled={isImporting || !spec.trim()}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import Articles"
                )}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
