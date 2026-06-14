import type { Metadata } from "next";
import type { FreeTool, FreeToolCategory } from "@repo/types";
import { ToolIndex } from "@/components/public/free-tools/tool-index";
import { listEnabledPublicFreeTools } from "@/lib/free-tools/repository";
import { getFreeToolTemplate } from "@/lib/free-tools/templates";
import {
  resolvePublicSiteUrl,
  stringifyJsonLdForScript,
} from "@/lib/public-site";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = resolvePublicSiteUrl();
  const title = "Free Tools";
  const description =
    "Free SEO, writing, schema, and business tools for improving website content.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${siteUrl}/tools`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `${siteUrl}/tools`,
    },
  };
}

export default async function PublicToolsPage() {
  const tools = await listEnabledPublicFreeTools({ surface: "index" });
  const siteUrl = resolvePublicSiteUrl();
  const visibleTools = tools.map((tool) => ({
    id: tool.id,
    slug: tool.slug,
    title: tool.title,
    metaDescription: tool.metaDescription,
    templateId: tool.templateId,
    category: getToolCategory(tool),
  }));

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${siteUrl}/tools#itemlist`,
    url: `${siteUrl}/tools`,
    numberOfItems: visibleTools.length,
    itemListElement: visibleTools.map((tool, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${siteUrl}/tools/${tool.slug}`,
      name: tool.title,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: stringifyJsonLdForScript(itemListSchema),
        }}
      />
      <ToolIndex tools={visibleTools} />
    </>
  );
}

function getToolCategory(tool: FreeTool): FreeToolCategory {
  return getFreeToolTemplate(tool.templateId)?.category ?? "utility";
}
