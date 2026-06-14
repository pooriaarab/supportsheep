import type { FreeToolCalloutConfig } from "@repo/types";

type BuildCalloutUrlInput = {
  baseUrl: string;
  toolSlug: string;
  utm: FreeToolCalloutConfig["utm"];
};

const UTM_KEYS = {
  source: "utm_source",
  medium: "utm_medium",
  campaign: "utm_campaign",
  content: "utm_content",
  term: "utm_term",
} as const;

export function buildCalloutUrl({
  baseUrl,
  toolSlug,
  utm,
}: BuildCalloutUrlInput): string {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:") {
    throw new Error("Callout URLs must use https://");
  }

  for (const [key, parameterName] of Object.entries(UTM_KEYS)) {
    const value = utm[key as keyof typeof UTM_KEYS]
      .replaceAll("{{toolSlug}}", toolSlug)
      .trim();
    if (value) {
      url.searchParams.set(parameterName, value);
    } else {
      url.searchParams.delete(parameterName);
    }
  }

  return url.toString();
}
