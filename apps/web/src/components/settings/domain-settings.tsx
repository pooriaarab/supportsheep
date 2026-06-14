"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Globe,
  HelpCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@repo/ui/primitives/badge";
import { Button } from "@repo/ui/primitives/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/primitives/card";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/primitives/table";
import { ConfirmDialog } from "@repo/ui/composites/confirm-dialog";

import { useBlogsQuery } from "@/hooks/use-blogs-query";
import {
  useDomainQuery,
  useRemoveDomainMutation,
  useSetDomainMutation,
  type DomainState,
  type DomainStatus,
} from "@/hooks/use-domain-query";

const HELP_URL = "/docs#custom-domains";

function StatusBadge({ status }: { status: DomainStatus }) {
  if (status === "active") {
    return <Badge variant="success">Verified</Badge>;
  }
  if (status === "failed") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  return <Badge variant="warning">Pending</Badge>;
}

/** A single DNS record row in the records table, with copy + per-record state. */
interface DnsRecordRow {
  type: string;
  name: string;
  value: string;
  /** Whether this record is verified (active) vs still pending. */
  verified: boolean;
}

function CopyButton({ value }: { value: string }) {
  const copy = useCallback(() => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  }, [value]);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="size-7 shrink-0 p-0"
      onClick={copy}
      aria-label="Copy value"
    >
      <Copy className="size-3.5" />
    </Button>
  );
}

/** Type / Name / Value table with copy + per-record verified/pending state. */
function DnsRecordsTable({ rows }: { rows: DnsRecordRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Type</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="w-28 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.type}-${r.name}`}>
                <TableCell className="font-mono text-xs">{r.type}</TableCell>
                <TableCell>
                  <code className="break-all font-mono text-xs">{r.name}</code>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <code className="break-all font-mono text-xs">
                      {r.value}
                    </code>
                    <CopyButton value={r.value} />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {r.verified ? (
                    <span className="text-xs text-success">✅ Verified</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      ⌛ Pending
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        The <span className="font-medium text-foreground">Name</span> column is
        the full record name. Many DNS providers (name.com, Namecheap, GoDaddy)
        automatically append your domain to the &ldquo;Host&rdquo;/&ldquo;Name&rdquo;
        field — if yours does, enter only the part{" "}
        <span className="font-medium text-foreground">before</span> your domain.
        Don&rsquo;t repeat your domain, or you&rsquo;ll create a doubled record
        that never verifies.
      </p>
    </div>
  );
}

function HelpLink() {
  return (
    <a
      href={HELP_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      <HelpCircle className="size-3.5" />
      Common domain problems
    </a>
  );
}

/** Build the DNS record rows the owner must add from the current domain state. */
function buildRecordRows(domain: DomainState): DnsRecordRow[] {
  if (!domain.domain) return [];
  const verified = domain.status === "active";
  const rows: DnsRecordRow[] = [];
  if (domain.cnameTarget) {
    rows.push({
      type: "CNAME",
      name: domain.domain,
      value: domain.cnameTarget,
      verified,
    });
  }
  if (domain.ownershipVerification) {
    rows.push({
      type: domain.ownershipVerification.type.toUpperCase(),
      name: domain.ownershipVerification.name,
      value: domain.ownershipVerification.value,
      verified,
    });
  }
  return rows;
}

export function DomainSettings() {
  const { data: blogsData } = useBlogsQuery();
  const blogId = blogsData?.activeBlogId ?? null;

  const { data: domain, isLoading, isFetching, refetch } =
    useDomainQuery(blogId);
  const setMutation = useSetDomainMutation(blogId);
  const removeMutation = useRemoveDomainMutation(blogId);

  const [input, setInput] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const status = domain?.status ?? null;
  const hasDomain = !!domain?.domain;

  const setResult = setMutation.data;
  // Prefer the freshly-provisioned result (it carries the CNAME) over the cached
  // query, which only includes the CNAME after a refresh.
  const pendingView: DomainState | null = useMemo(() => {
    if (setResult) {
      return {
        domain: setResult.domain,
        status: setResult.status,
        cnameTarget: setResult.cnameTarget,
        ownershipVerification: setResult.ownershipVerification,
        apexNote: setResult.apexNote,
        instructions: setResult.instructions,
      };
    }
    return domain ?? null;
  }, [setResult, domain]);

  const recordRows = useMemo(
    () => (pendingView ? buildRecordRows(pendingView) : []),
    [pendingView],
  );

  const handleAdd = useCallback(() => {
    const value = input.trim();
    if (!value) return;
    setMutation.mutate(value, {
      onSuccess: () => {
        toast.success("Domain added. Add the records below to verify it.");
        setInput("");
      },
      onError: (err) => toast.error(err.message),
    });
  }, [input, setMutation]);

  const handleRefresh = useCallback(() => {
    refetch().then((res) => {
      if (res.data?.status === "active") {
        toast.success("Domain verified");
      }
    });
  }, [refetch]);

  const handleRemove = useCallback(() => {
    removeMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Custom domain removed");
        setConfirmRemove(false);
      },
      onError: (err) => toast.error(err.message),
    });
  }, [removeMutation]);

  if (isLoading || !blogId) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const guidance = domain?.guidance ?? null;
  const sslStatus = domain?.sslStatus ?? null;
  const apexNote = pendingView?.apexNote ?? domain?.apexNote ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Globe className="size-4 text-muted-foreground" />
                Custom domain
              </CardTitle>
              <CardDescription>
                Serve your blog from your own domain instead of a blogbat.com
                subdomain.
              </CardDescription>
            </div>
            {status && <StatusBadge status={status} />}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* No domain — add form */}
          {!hasDomain && !setResult && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="domain-input">Domain</Label>
                <Input
                  id="domain-input"
                  placeholder="blog.example.com"
                  value={input}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                  }}
                />
              </div>
              <Button
                onClick={handleAdd}
                disabled={!input.trim() || setMutation.isPending}
              >
                {setMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  "Add domain"
                )}
              </Button>
              <div>
                <HelpLink />
              </div>
            </div>
          )}

          {/* Active — verified */}
          {hasDomain && status === "active" && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-border bg-success/10 p-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <div className="text-sm">
                  <span className="font-medium text-foreground">Verified</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — your blog is live at{" "}
                  </span>
                  <a
                    href={`https://${domain?.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    {domain?.domain}
                  </a>
                </div>
              </div>
              <Button variant="outline" onClick={() => setConfirmRemove(true)}>
                Remove domain
              </Button>
            </div>
          )}

          {/* Pending or failed — show records table + status + actions */}
          {hasDomain && status !== "active" && pendingView && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">
                  {pendingView.domain}
                </span>
                {status === "pending" && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" />
                    Checking…
                  </span>
                )}
              </div>

              {/* Mapped guidance (failure reason / pending explanation + fix). */}
              {guidance && (
                <div
                  className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                    status === "failed"
                      ? "border-error/40 bg-error/10"
                      : "border-border bg-muted/40"
                  }`}
                >
                  {status === "failed" ? (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-error" />
                  ) : (
                    <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-muted-foreground" />
                  )}
                  <div className="space-y-1">
                    <p className="text-foreground">{guidance.userMessage}</p>
                    {guidance.fixHint && (
                      <p className="text-muted-foreground">{guidance.fixHint}</p>
                    )}
                  </div>
                </div>
              )}

              {/* SSL status, distinct from hostname status. */}
              {sslStatus && (
                <div className="text-xs text-muted-foreground">
                  Certificate:{" "}
                  <span className="font-medium text-foreground">
                    {sslStatus.replace(/_/g, " ")}
                  </span>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Add the following records at your DNS provider. Validation can
                take a few minutes.
              </p>
              <DnsRecordsTable rows={recordRows} />

              {apexNote && (
                <p className="text-xs text-muted-foreground">{apexNote}</p>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleRefresh}
                    disabled={isFetching}
                  >
                    <RefreshCw
                      className={`size-4 ${isFetching ? "animate-spin" : ""}`}
                    />
                    Recheck
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmRemove(true)}
                    className="text-error hover:text-error"
                  >
                    Remove
                  </Button>
                </div>
                <HelpLink />
              </div>
            </div>
          )}

          {/* Freshly added (cache not yet showing domain) */}
          {!hasDomain && setResult && pendingView && (
            <div className="space-y-4">
              <div className="text-sm">
                <span className="font-medium text-foreground">
                  {pendingView.domain}
                </span>
                <span className="text-muted-foreground"> — pending</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Add the following records at your DNS provider, then they will
                verify automatically.
              </p>
              <DnsRecordsTable rows={recordRows} />
              {apexNote && (
                <p className="text-xs text-muted-foreground">{apexNote}</p>
              )}
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={handleRefresh}
                  disabled={isFetching}
                >
                  <RefreshCw
                    className={`size-4 ${isFetching ? "animate-spin" : ""}`}
                  />
                  Recheck
                </Button>
                <HelpLink />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title="Remove custom domain"
        description="Your blog will stop serving from this domain. You can add it again later."
        confirmLabel="Remove"
        variant="destructive"
        loading={removeMutation.isPending}
        onConfirm={handleRemove}
      />
    </div>
  );
}
