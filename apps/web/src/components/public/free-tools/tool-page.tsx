"use client";

import type {
  FreeTool,
  FreeToolExecutionMode,
  FreeToolInputField,
} from "@repo/types";
import {
  Braces,
  Check,
  Copy,
  Download,
  Facebook,
  FileText,
  Instagram,
  Linkedin,
  Music2,
  Twitter,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { FaqAccordion } from "@/components/public/faq-accordion";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { trackAnalyticsEvent } from "@/lib/analytics/events";

type FreeToolResult =
  | {
      kind: "stats";
      summary: string;
      metrics: Record<string, number | string>;
    }
  | {
      kind: "text";
      summary: string;
      text: string;
    }
  | {
      kind: "json";
      summary: string;
      json: Record<string, unknown>;
    };

interface ToolPageProps {
  tool: FreeTool;
  inputs: FreeToolInputField[];
  executionMode: FreeToolExecutionMode;
}

export function ToolPage({ tool, inputs, executionMode }: ToolPageProps) {
  const initialValues = useMemo(() => {
    return inputs.reduce<Record<string, string | boolean>>((values, field) => {
      values[field.id] = field.type === "checkbox" ? false : "";
      return values;
    }, {});
  }, [inputs]);

  const [values, setValues] = useState(initialValues);
  const [result, setResult] = useState<FreeToolResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useMountEffect(() => {
    setIsHydrated(true);
  });

  const buttonLabel =
    tool.templateId === "word-counter"
      ? "Analyze text"
      : executionMode === "ai"
        ? "Generate"
        : "Run tool";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runTool();
  }

  async function handleRunButtonClick() {
    await runTool();
  }

  async function runTool() {
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    const input = inputs.reduce<Record<string, string | number | boolean>>(
      (payload, field) => {
        const value = values[field.id];
        if (field.type === "number") {
          const numericValue = String(value ?? "").trim();
          if (numericValue) {
            payload[field.id] = Number(numericValue);
          }
          return payload;
        }

        payload[field.id] = value;
        return payload;
      },
      {},
    );

    try {
      const response = await fetch(
        `/api/v1/free-tools/public/${tool.slug}/run`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input }),
        },
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || "Unable to run this tool");
      }
      setResult(json.data.result);
      trackAnalyticsEvent("free_tool_run", {
        tool_slug: tool.slug,
        execution_mode: executionMode,
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Unable to run this tool",
      );
      trackAnalyticsEvent("free_tool_error", {
        tool_slug: tool.slug,
        execution_mode: executionMode,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="max-w-3xl">
        <Link
          href="/tools"
          className="text-sm font-medium text-primary no-underline hover:underline"
        >
          Free Tools
        </Link>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          {tool.title}
        </h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">
          {tool.intro || tool.metaDescription}
        </p>
      </div>

      <div className="mt-10 space-y-6" data-tool-workspace="stacked">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-card p-4 text-card-foreground sm:p-6"
        >
          <div className="space-y-5">
            {inputs.map((field) => (
              <FieldControl
                key={field.id}
                tool={tool}
                field={field}
                value={values[field.id]}
                onChange={(value) =>
                  setValues((current) => ({ ...current, [field.id]: value }))
                }
              />
            ))}
          </div>
          <button
            type="button"
            disabled={!isHydrated || isSubmitting}
            onClick={handleRunButtonClick}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {isSubmitting ? "Running..." : buttonLabel}
          </button>
        </form>

        <section
          className="rounded-lg border border-border bg-muted/40 p-4 sm:p-5"
          data-tool-result-panel="true"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">Result</h2>
            {result ? (
              <span className="text-xs text-muted-foreground">
                Ready to use
              </span>
            ) : null}
          </div>
          <div className="min-h-40 rounded-md border border-border bg-background p-3 text-sm sm:p-4">
            {error ? (
              <p className="text-error">{error}</p>
            ) : result ? (
              <ResultView result={result} tool={tool} />
            ) : (
              <EmptyResultState />
            )}
          </div>
        </section>
      </div>

      {tool.faq.length > 0 ? (
        <section className="mt-12 max-w-3xl">
          <div className="mb-10 sm:mb-12">
            <p className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              FAQ
            </p>
            <h2 className="text-fluid-xl font-semibold tracking-tight sm:text-3xl">
              Frequently asked questions
            </h2>
          </div>
          <FaqAccordion items={tool.faq} />
        </section>
      ) : null}
    </div>
  );
}

function FieldControl({
  tool,
  field,
  value,
  onChange,
}: {
  tool: FreeTool;
  field: FreeToolInputField;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
}) {
  const fieldId = `tool-input-${field.id}`;
  const hintId = `${fieldId}-hint`;
  const decimalPattern = "[0-9]*(?:\\.[0-9]+)?";
  const fieldHint = getFieldUnitHint(tool, field);

  if (field.type === "checkbox") {
    return (
      <label
        className="flex items-center gap-2 text-sm font-medium"
        htmlFor={fieldId}
      >
        <input
          id={fieldId}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          className="size-4 rounded border-input"
        />
        {field.label}
      </label>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium" htmlFor={fieldId}>
          {field.label}
        </label>
        {fieldHint ? (
          <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
            Unit: {fieldHint.unit}
          </span>
        ) : null}
      </div>
      {field.type === "textarea" ? (
        <textarea
          id={fieldId}
          required={field.required}
          maxLength={field.maxLength}
          aria-describedby={fieldHint ? hintId : undefined}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          className="min-h-44 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      ) : field.type === "select" ? (
        <select
          id={fieldId}
          required={field.required}
          aria-describedby={fieldHint ? hintId : undefined}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <option value="">Select an option</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={fieldId}
          name={field.id}
          type="text"
          required={field.required}
          inputMode={field.type === "number" ? "decimal" : undefined}
          pattern={field.type === "number" ? decimalPattern : undefined}
          maxLength={field.maxLength}
          aria-describedby={fieldHint ? hintId : undefined}
          value={String(value ?? "")}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (
              field.type !== "number" ||
              /^(?:\d+(?:\.\d*)?|\.\d*)?$/.test(nextValue)
            ) {
              onChange(nextValue);
            }
          }}
          placeholder={field.placeholder}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
        />
      )}
      {fieldHint ? (
        <p id={hintId} className="text-xs leading-5 text-muted-foreground">
          {fieldHint.help}
        </p>
      ) : null}
    </div>
  );
}

function EmptyResultState() {
  return (
    <div className="flex min-h-32 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 p-6 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">
        Results appear here after the tool runs.
      </p>
    </div>
  );
}

export function ResultView({
  result,
  tool,
}: {
  result: FreeToolResult;
  tool: FreeTool;
}) {
  const actionPayload = buildActionPayload(tool, result);
  const resultKind = getResultKindLabel(tool, result);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {resultKind}
          </p>
          <h3 className="text-base font-semibold leading-6">
            <InlineMarkdown text={result.summary} />
          </h3>
        </div>
        <ResultActions payload={actionPayload} />
      </div>
      <ResultBody result={result} tool={tool} />
    </div>
  );
}

function ResultBody({
  result,
  tool,
}: {
  result: FreeToolResult;
  tool: FreeTool;
}) {
  if (result.kind === "stats") {
    return (
      <div className="space-y-3">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(result.metrics).map(([key, value]) => (
            <div
              key={key}
              className="rounded-md border border-border bg-muted/40 p-3"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {formatLabel(key)}
              </dt>
              <dd className="mt-1 text-lg font-semibold">
                {formatMetricValue(tool, key, value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  if (result.kind === "json") {
    return <JsonResultPreview json={result.json} />;
  }

  const renderableSvg = getRenderableSvg(tool, result.text);
  if (renderableSvg) {
    return <SvgResultPreview svg={renderableSvg} />;
  }

  const platform = getPlatformPreview(tool);
  if (platform) {
    return <SocialResultPreview platform={platform} text={result.text} />;
  }

  if (isLongformDraftTool(tool)) {
    return <LongformResultPreview text={result.text} />;
  }

  return <TextResultPreview text={result.text} />;
}

function ResultActions({ payload }: { payload: ResultActionPayload }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!payload.copyText) {
      return;
    }
    try {
      await navigator.clipboard.writeText(payload.copyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard write can fail when the document loses focus
    }
  }

  function handleDownload() {
    const blob = new Blob([payload.downloadText], { type: payload.mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = payload.filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        aria-label="Copy result"
        title="Copy result"
        onClick={handleCopy}
        className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {copied ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        aria-label="Download result"
        title="Download result"
        onClick={handleDownload}
        className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <Download className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function SvgResultPreview({ svg }: { svg: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center overflow-auto rounded-lg border border-border bg-muted/20 p-6">
      <div
        data-barcode-preview="true"
        role="img"
        aria-label="Barcode preview"
        className="[&_svg]:h-auto [&_svg]:max-h-64 [&_svg]:max-w-full [&_svg]:rounded-md [&_svg]:shadow-sm"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

function SocialResultPreview({
  platform,
  text,
}: {
  platform: PlatformPreview;
  text: string;
}) {
  const Icon = platform.Icon;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(280px,1.1fr)]">
      <div
        className={`rounded-lg border p-4 ${platform.borderClass} ${platform.surfaceClass}`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex size-10 items-center justify-center rounded-full ${platform.iconClass}`}
          >
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold">{platform.label}</p>
            <p className="text-xs text-muted-foreground">Draft preview</p>
          </div>
        </div>
        <div className="mt-4 rounded-md bg-background p-4 text-sm leading-6 shadow-sm">
          <RichText text={text} />
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{platform.primaryAction}</span>
          <span>{platform.secondaryAction}</span>
          <span>Share</span>
        </div>
      </div>
      <TextResultPreview text={text} compact />
    </div>
  );
}

function LongformResultPreview({ text }: { text: string }) {
  return (
    <article className="rounded-lg border border-border bg-background p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <FileText className="size-4" aria-hidden="true" />
        Draft
      </div>
      <div className="prose prose-sm max-w-none break-words text-foreground prose-headings:font-semibold prose-p:leading-7">
        <RichText text={text} />
      </div>
    </article>
  );
}

function TextResultPreview({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <FileText className="size-4" aria-hidden="true" />
        Text output
      </div>
      <div
        className={`overflow-auto break-words text-sm leading-6 ${
          compact ? "max-h-72" : "max-h-[32rem]"
        }`}
      >
        <RichText text={text} />
      </div>
    </div>
  );
}

function JsonResultPreview({ json }: { json: Record<string, unknown> }) {
  const entries = Object.entries(json);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.slice(0, 12).map(([key, value]) => (
          <JsonValueCard key={key} label={key} value={value} />
        ))}
      </div>
      <details className="rounded-lg border border-border bg-muted/20 p-3">
        <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Braces className="size-4" aria-hidden="true" />
          Raw JSON
        </summary>
        <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5">
          {JSON.stringify(json, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function JsonValueCard({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {formatLabel(label)}
      </p>
      <p className="mt-2 min-w-0 break-words text-sm font-medium">
        {formatJsonValue(value)}
      </p>
    </div>
  );
}

type ResultActionPayload = {
  copyText: string;
  downloadText: string;
  filename: string;
  mimeType: string;
};

function buildActionPayload(
  tool: FreeTool,
  result: FreeToolResult,
): ResultActionPayload {
  if (result.kind === "json") {
    return {
      copyText: JSON.stringify(result.json, null, 2),
      downloadText: JSON.stringify(result.json, null, 2),
      filename: `${safeFileName(tool.slug)}.json`,
      mimeType: "application/json;charset=utf-8",
    };
  }

  if (result.kind === "stats") {
    const text = JSON.stringify(result.metrics, null, 2);
    return {
      copyText: text,
      downloadText: text,
      filename: `${safeFileName(tool.slug)}-metrics.json`,
      mimeType: "application/json;charset=utf-8",
    };
  }

  const svg = extractSvg(result.text);
  if (svg) {
    return {
      copyText: svg,
      downloadText: svg,
      filename: `${safeFileName(tool.slug)}.svg`,
      mimeType: "image/svg+xml;charset=utf-8",
    };
  }

  return {
    copyText: result.text,
    downloadText: result.text,
    filename: `${safeFileName(tool.slug)}.txt`,
    mimeType: "text/plain;charset=utf-8",
  };
}

function getResultKindLabel(tool: FreeTool, result: FreeToolResult): string {
  if (getRenderableSvg(tool, result.kind === "text" ? result.text : "")) {
    return "Visual asset";
  }
  if (result.kind === "stats") {
    return "Metrics";
  }
  if (result.kind === "json") {
    return "Structured result";
  }
  if (getPlatformPreview(tool)) {
    return "Platform preview";
  }
  return "Generated result";
}

type PlatformPreview = {
  label: string;
  Icon: LucideIcon;
  borderClass: string;
  surfaceClass: string;
  iconClass: string;
  primaryAction: string;
  secondaryAction: string;
};

function getPlatformPreview(tool: FreeTool): PlatformPreview | null {
  const id = tool.templateId;

  if (id.includes("linkedin")) {
    return {
      label: "LinkedIn",
      Icon: Linkedin,
      borderClass: "border-info/30",
      surfaceClass: "bg-info-subtle",
      iconClass: "bg-info text-info-foreground",
      primaryAction: "Like",
      secondaryAction: "Comment",
    };
  }

  if (id.includes("instagram")) {
    return {
      label: "Instagram",
      Icon: Instagram,
      borderClass: "border-primary/30",
      surfaceClass: "bg-accent",
      iconClass: "bg-primary text-primary-foreground",
      primaryAction: "Like",
      secondaryAction: "Comment",
    };
  }

  if (id.includes("facebook")) {
    return {
      label: id.includes("ad") ? "Facebook ad" : "Facebook",
      Icon: Facebook,
      borderClass: "border-info/30",
      surfaceClass: "bg-info-subtle",
      iconClass: "bg-info text-info-foreground",
      primaryAction: id.includes("ad") ? "Sponsored" : "Like",
      secondaryAction: id.includes("ad") ? "Learn more" : "Comment",
    };
  }

  if (id.includes("twitter")) {
    return {
      label: "X",
      Icon: Twitter,
      borderClass: "border-foreground/20",
      surfaceClass: "bg-muted/30",
      iconClass: "bg-foreground text-background",
      primaryAction: "Reply",
      secondaryAction: "Repost",
    };
  }

  if (id.includes("youtube")) {
    return {
      label: "YouTube",
      Icon: Youtube,
      borderClass: "border-error/30",
      surfaceClass: "bg-error-subtle",
      iconClass: "bg-error text-error-foreground",
      primaryAction: "Like",
      secondaryAction: "Subscribe",
    };
  }

  if (id.includes("tiktok")) {
    return {
      label: "TikTok",
      Icon: Music2,
      borderClass: "border-foreground/20",
      surfaceClass: "bg-muted/30",
      iconClass: "bg-foreground text-background",
      primaryAction: "Like",
      secondaryAction: "Comment",
    };
  }

  return null;
}

function isLongformDraftTool(tool: FreeTool): boolean {
  return [
    "blog-post-generator",
    "newsletter-generator",
    "press-release-generator",
    "homepage-copy-generator",
    "landing-page-copy-generator",
    "about-us-generator",
  ].includes(tool.templateId);
}

function getRenderableSvg(tool: FreeTool, text: string): string | null {
  if (tool.templateId !== "barcode-generator") {
    return null;
  }
  return extractSvg(text);
}

function extractSvg(text: string): string | null {
  const trimmed = text.trim();
  if (/^<svg[\s>]/i.test(trimmed) && /<\/svg>$/i.test(trimmed)) {
    return sanitizeSvgMarkup(trimmed);
  }

  const match = trimmed.match(/data:image\/svg\+xml[^,]*,([^\s]+)/i);
  if (!match?.[1]) {
    return null;
  }

  try {
    return sanitizeSvgMarkup(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function sanitizeSvgMarkup(svg: string): string | null {
  const trimmed = svg.trim();
  if (!/^<svg[\s>]/i.test(trimmed) || !/<\/svg>$/i.test(trimmed)) {
    return null;
  }

  const blocked =
    "script|foreignObject|iframe|object|embed|link|style|use|a|animate|animateMotion|animateTransform|set";

  return trimmed
    .replace(
      new RegExp(`<\\s*(${blocked})\\b[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, "gi"),
      "",
    )
    .replace(new RegExp(`<\\s*(${blocked})\\b[^>]*\\/?>`, "gi"), "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(
      /\s+(href|xlink:href)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
      (attribute: string, name: string, rawValue: string) => {
        const value = rawValue.replace(/^["']|["']$/g, "");
        return value.startsWith("#") ? attribute : "";
      },
    );
}

type FieldUnitHint = {
  unit: string;
  help: string;
};

const currencyFieldKeys = new Set([
  "adspend",
  "averagemonthlyrevenue",
  "averagerevenue",
  "baserate",
  "budget",
  "cac",
  "cpc",
  "cpm",
  "cost",
  "contributionmargin",
  "currentcost",
  "fixedcosts",
  "handlingfee",
  "ltv",
  "marketcapitalization",
  "monthlycontribution",
  "monthlyrevenuelost",
  "newcost",
  "priceperunit",
  "principal",
  "projectedbalance",
  "rateperunit",
  "retailprice",
  "revenue",
  "salesmarketingspend",
  "shareprice",
  "subtotal",
  "tax",
  "total",
  "totalcontributions",
  "variablecostperunit",
  "wholesaleprice",
]);

const countFieldUnits: Record<string, string> = {
  characters: "characters",
  charactersnospaces: "characters",
  clicks: "clicks",
  columns: "columns",
  comments: "comments",
  conversions: "conversions",
  customers: "customers",
  delivered: "emails",
  detractors: "responses",
  followers: "followers",
  impressions: "impressions",
  interactions: "interactions",
  likes: "likes",
  lines: "lines",
  mentions: "mentions",
  newcustomers: "customers",
  opens: "opens",
  passives: "responses",
  periods: "periods",
  population: "people",
  promoters: "responses",
  reach: "people",
  saves: "saves",
  sentences: "sentences",
  shares: "shares",
  sharesoutstanding: "shares",
  totalresponses: "responses",
  units: "units",
  views: "views",
  visitors: "visitors",
  words: "words",
};

function getFieldUnitHint(
  tool: FreeTool,
  field: FreeToolInputField,
): FieldUnitHint | null {
  if (field.type !== "number") {
    return null;
  }

  const key = normalizeKey(field.id);
  const label = field.label.toLowerCase();
  const unit = inferUnit(tool, key, label);

  if (!unit) {
    return null;
  }

  return {
    unit,
    help: `Enter ${unit === "USD" ? "a dollar amount" : unit}.`,
  };
}

function formatMetricValue(
  tool: FreeTool,
  key: string,
  value: number | string,
): string {
  if (typeof value === "string") {
    return value;
  }

  const normalizedKey = normalizeKey(key);
  const lowerLabel = formatLabel(key).toLowerCase();
  const unit = inferUnit(tool, normalizedKey, lowerLabel);

  if (unit === "USD") {
    return currencyFormatter.format(value);
  }

  if (unit === "%") {
    return `${numberFormatter.format(value)}%`;
  }

  if (unit === "x") {
    return `${numberFormatter.format(value)}x`;
  }

  if (unit && unit !== "score") {
    return `${numberFormatter.format(value)} ${unit}`;
  }

  return numberFormatter.format(value);
}

function inferUnit(tool: FreeTool, normalizedKey: string, label: string) {
  if (
    normalizedKey.endsWith("percent") ||
    normalizedKey.endsWith("rate") ||
    label.includes("percent") ||
    label.includes("rate")
  ) {
    return "%";
  }

  if (normalizedKey === "roas") {
    return "x";
  }

  if (
    normalizedKey === "score" ||
    normalizedKey === "fit" ||
    normalizedKey === "intent" ||
    normalizedKey === "engagement" ||
    tool.templateId.includes("lead-scoring")
  ) {
    return "score";
  }

  if (
    currencyFieldKeys.has(normalizedKey) ||
    label.includes("budget") ||
    label.includes("cost") ||
    label.includes("price") ||
    label.includes("revenue") ||
    label.includes("spend")
  ) {
    return "USD";
  }

  if (
    normalizedKey === "width" ||
    normalizedKey === "height" ||
    normalizedKey === "gap" ||
    normalizedKey === "pixels" ||
    normalizedKey === "containerwidth" ||
    normalizedKey === "viewportwidth" ||
    normalizedKey === "viewportheight"
  ) {
    return "px";
  }

  if (normalizedKey === "inches") {
    return "in";
  }

  if (
    normalizedKey === "length" ||
    normalizedKey === "recommendedmin" ||
    normalizedKey === "recommendedmax"
  ) {
    return "characters";
  }

  if (normalizedKey === "readingtimeminutes") {
    return "minutes";
  }

  if (normalizedKey === "frequency") {
    return "times";
  }

  if (normalizedKey === "years") {
    return "years";
  }

  if (normalizedKey === "weight") {
    return "weight units";
  }

  return countFieldUnits[normalizedKey] ?? null;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function normalizeKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function uniqueContentKey(
  prefix: string,
  content: string,
  counts: Map<string, number>,
): string {
  const base = `${prefix}:${content}`;
  const count = counts.get(base) ?? 0;
  counts.set(base, count + 1);
  return count === 0 ? base : `${base}:${count}`;
}

type RichTextBlock =
  | { type: "paragraph"; text: string }
  | { type: "ordered"; items: string[] }
  | { type: "unordered"; items: string[] };

function RichText({ text }: { text: string }) {
  const blocks = parseRichTextBlocks(text);
  const keyCounts = new Map<string, number>();

  return (
    <div className="space-y-3 whitespace-normal">
      {blocks.map((block) => (
        <RichTextBlockView
          key={richTextBlockKey(block, keyCounts)}
          block={block}
        />
      ))}
    </div>
  );
}

function RichTextBlockView({ block }: { block: RichTextBlock }) {
  if (block.type === "ordered") {
    return (
      <ol className="list-decimal space-y-1 pl-5">
        <RichTextListItems items={block.items} />
      </ol>
    );
  }

  if (block.type === "unordered") {
    return (
      <ul className="list-disc space-y-1 pl-5">
        <RichTextListItems items={block.items} />
      </ul>
    );
  }

  return (
    <p className="whitespace-pre-wrap">
      <InlineMarkdown text={block.text} />
    </p>
  );
}

function RichTextListItems({ items }: { items: string[] }) {
  const keyCounts = new Map<string, number>();

  return items.map((item) => (
    <li key={uniqueContentKey("item", item, keyCounts)}>
      <InlineMarkdown text={item} />
    </li>
  ));
}

function richTextBlockKey(
  block: RichTextBlock,
  counts: Map<string, number>,
): string {
  const content =
    block.type === "paragraph" ? block.text : block.items.join("\n");
  return uniqueContentKey(block.type, content, counts);
}

function parseRichTextBlocks(text: string): RichTextBlock[] {
  const blocks: RichTextBlock[] = [];
  let paragraph: string[] = [];
  let orderedItems: string[] = [];
  let unorderedItems: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) {
      return;
    }
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  }

  function flushOrderedItems() {
    if (orderedItems.length === 0) {
      return;
    }
    blocks.push({ type: "ordered", items: orderedItems });
    orderedItems = [];
  }

  function flushUnorderedItems() {
    if (unorderedItems.length === 0) {
      return;
    }
    blocks.push({ type: "unordered", items: unorderedItems });
    unorderedItems = [];
  }

  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!line.trim()) {
      flushParagraph();
      flushOrderedItems();
      flushUnorderedItems();
      continue;
    }

    const orderedMatch = line.match(/^\s*\d+\.\s+(.+)$/);
    if (orderedMatch?.[1]) {
      flushParagraph();
      flushUnorderedItems();
      orderedItems.push(orderedMatch[1]);
      continue;
    }

    const unorderedMatch = line.match(/^\s*[-*]\s+(.+)$/);
    if (unorderedMatch?.[1]) {
      flushParagraph();
      flushOrderedItems();
      unorderedItems.push(unorderedMatch[1]);
      continue;
    }

    flushOrderedItems();
    flushUnorderedItems();
    paragraph.push(line);
  }

  flushParagraph();
  flushOrderedItems();
  flushUnorderedItems();

  return blocks.length > 0 ? blocks : [{ type: "paragraph", text }];
}

function InlineMarkdown({ text }: { text: string }) {
  return <>{parseInlineMarkdown(text)}</>;
}

function parseInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const keyCounts = new Map<string, number>();
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    nodes.push(
      <strong key={uniqueContentKey("bold", match[1], keyCounts)}>
        {match[1]}
      </strong>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function formatLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
    .replace(/\bCac\b/g, "CAC")
    .replace(/\bCpc\b/g, "CPC")
    .replace(/\bCpm\b/g, "CPM")
    .replace(/\bCss\b/g, "CSS")
    .replace(/\bCtr\b/g, "CTR")
    .replace(/\bHtml\b/g, "HTML")
    .replace(/\bIso\b/g, "ISO")
    .replace(/\bJson\b/g, "JSON")
    .replace(/\bNps\b/g, "NPS")
    .replace(/\bRoas\b/g, "ROAS")
    .replace(/\bUrl\b/g, "URL")
    .replace(/\bUtm\b/g, "UTM");
}

function formatJsonValue(value: unknown): string {
  if (value === null) {
    return "None";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function safeFileName(value: string): string {
  return (
    value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "") || "result"
  );
}
