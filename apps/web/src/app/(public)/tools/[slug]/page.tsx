import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolCallout } from "@/components/public/free-tools/tool-callout";
import { ToolPage } from "@/components/public/free-tools/tool-page";
import { resolvePublicFreeToolBySlug } from "@/lib/free-tools/repository";
import { getFreeToolTemplate } from "@/lib/free-tools/templates";
import {
  resolvePublicSiteUrl,
  stringifyJsonLdForScript,
} from "@/lib/public-site";

export const revalidate = 300;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tool = await resolvePublicFreeToolBySlug(slug);
  if (!tool) {
    return { title: "Tool Not Found" };
  }

  const siteUrl = resolvePublicSiteUrl();
  const canonicalUrl = `${siteUrl}/tools/${tool.slug}`;

  return {
    title: tool.metaTitle || tool.title,
    description: tool.metaDescription,
    openGraph: {
      title: tool.metaTitle || tool.title,
      description: tool.metaDescription,
      type: "website",
      url: canonicalUrl,
    },
    twitter: {
      card: "summary_large_image",
      title: tool.metaTitle || tool.title,
      description: tool.metaDescription,
    },
    alternates: {
      canonical: canonicalUrl,
    },
    robots: tool.seo.indexable ? undefined : { index: false, follow: false },
  };
}

export default async function PublicToolPage({ params }: Props) {
  const { slug } = await params;
  const tool = await resolvePublicFreeToolBySlug(slug);
  if (!tool) {
    notFound();
  }

  const template = getFreeToolTemplate(tool.templateId);
  if (!template) {
    notFound();
  }

  const siteUrl = resolvePublicSiteUrl();
  const toolUrl = `${siteUrl}/tools/${tool.slug}`;
  const webApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${toolUrl}#tool`,
    name: tool.title,
    description: tool.metaDescription,
    url: toolUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    isAccessibleForFree: true,
  };
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Free Tools",
        item: `${siteUrl}/tools`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: tool.title,
        item: toolUrl,
      },
    ],
  };
  const faqSchema =
    tool.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: tool.faq.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: item.answer,
            },
          })),
        }
      : null;
  const jsonLdSchemas = [
    { id: "web-application", schema: webApplicationSchema },
    { id: "breadcrumb", schema: breadcrumbSchema },
    ...(faqSchema ? [{ id: "faq", schema: faqSchema }] : []),
  ];

  return (
    <>
      {jsonLdSchemas.map(({ id, schema }) => (
        <script
          key={id}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: stringifyJsonLdForScript(schema),
          }}
        />
      ))}
      <ToolPage
        tool={tool}
        inputs={template.inputs}
        executionMode={template.executionMode}
      />
      <ToolCallout tool={tool} />
    </>
  );
}
