"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { Label } from "@repo/ui/primitives/label";

function CopyField({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success(`${label} copied`);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleCopy}
          title={`Copy ${label.toLowerCase()}`}
        >
          {copied ? (
            <Check className="size-4 text-success" />
          ) : (
            <Copy className="size-4" />
          )}
        </Button>
      </div>
      {warning ? <p className="text-xs text-warning">{warning}</p> : null}
    </div>
  );
}

export function WebhookCreationResult({
  endpointUrl,
  token,
  onDone,
}: {
  endpointUrl: string;
  token: string;
  onDone: () => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Webhook Created</h2>
        <p className="text-sm text-muted-foreground">
          Copy the webhook URL and access token below. The token is shown only
          once.
        </p>
      </div>
      <div className="space-y-4 py-2">
        <CopyField label="Webhook URL" value={endpointUrl} />
        <CopyField
          label="Access Token"
          value={token}
          warning="This token is shown only once. Save it securely."
        />
        <p className="text-xs text-muted-foreground">
          Configure your provider to send{" "}
          <code>Authorization: Bearer {token}</code>{" "}
          with every webhook request.
        </p>
      </div>
      <div className="flex justify-end">
        <Button onClick={onDone}>Close details</Button>
      </div>
    </>
  );
}
