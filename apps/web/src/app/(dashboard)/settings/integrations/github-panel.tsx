"use client";

import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@repo/ui/primitives/card";
import { Button } from "@repo/ui/primitives/button";
import { Input } from "@repo/ui/primitives/input";
import { CopyIcon, CheckIcon } from "lucide-react";

export function GithubPanel() {
  const [copied, setCopied] = useState(false);
  const webhookUrl = "https://api.supportsheep.com/api/v1/integrations/github/webhook";

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>GitHub Integration (Auto-Docs)</CardTitle>
        <CardDescription>
          Configure a webhook in your GitHub repository to automatically generate documentation when code changes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <h4 className="text-sm font-medium">1. Go to your GitHub Repository Settings</h4>
          <p className="text-sm text-muted-foreground">
            Navigate to <strong>Settings</strong> {'>'} <strong>Webhooks</strong> and click <strong>Add webhook</strong>.
          </p>
        </div>
        
        <div className="space-y-2">
          <h4 className="text-sm font-medium">2. Set the Payload URL</h4>
          <div className="flex items-center space-x-2">
            <Input 
              readOnly 
              value={webhookUrl} 
              className="flex-1"
            />
            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">3. Configure Content Type</h4>
          <p className="text-sm text-muted-foreground">
            Select <code className="bg-muted px-1.5 py-0.5 rounded text-xs">application/json</code> as the content type.
          </p>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">4. Select Events</h4>
          <p className="text-sm text-muted-foreground">
            Choose <strong>Let me select individual events</strong> and check <strong>Push</strong> events.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
