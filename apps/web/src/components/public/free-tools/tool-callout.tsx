import type { FreeTool } from "@repo/types";
import Link from "next/link";
import { buildCalloutUrl } from "@/lib/free-tools/callout";

interface ToolCalloutProps {
  tool: FreeTool;
}

export function ToolCallout({ tool }: ToolCalloutProps) {
  if (!tool.callout.enabled || !tool.callout.primaryUrl) {
    return null;
  }

  let primaryHref: string;
  try {
    primaryHref = buildCalloutUrl({
      baseUrl: tool.callout.primaryUrl,
      toolSlug: tool.slug,
      utm: tool.callout.utm,
    });
  } catch {
    return null;
  }

  return (
    <section className="border-t border-border bg-muted/40">
      <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold tracking-tight">
            {tool.callout.heading}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {tool.callout.body}
          </p>
        </div>
        <Link
          href={primaryHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground no-underline transition-colors hover:bg-primary/90"
        >
          {tool.callout.primaryLabel}
        </Link>
      </div>
    </section>
  );
}
