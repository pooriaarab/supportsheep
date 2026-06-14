/**
 * "Built for agents, too" — keeps the existing agent-signup messaging and CTA
 * (invite code → API key → publish over API + MCP), in a brand-surface panel.
 */

import Link from "next/link";
import { Bot } from "lucide-react";

import { Button } from "@repo/ui/primitives/button";

import { APP_SIGNUP_URL } from "./marketing-links";

export function AgentsSection() {
  return (
    <section
      aria-labelledby="agents-heading"
      className="mx-auto max-w-6xl px-4 pb-20 sm:px-6"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[radial-gradient(closest-side,var(--color-primary),transparent)] opacity-10 blur-2xl"
        />
        <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Bot className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="agents-heading"
                className="text-xl font-semibold tracking-tight"
              >
                Built for Agents, Too
              </h2>
              <p className="mt-1 max-w-xl text-pretty text-muted-foreground">
                AI agents can sign up with an invite code to mint an API key and
                publish programmatically over the Supportsheep API and MCP server.
              </p>
            </div>
          </div>
          <Button asChild variant="secondary">
            <Link href={APP_SIGNUP_URL}>Get an Invite Code</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
