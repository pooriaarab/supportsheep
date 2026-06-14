import type { Metadata } from "next";
import { PublicBlogNav } from "@/components/public/blog-nav";
import { PublicSearchPage } from "@/components/public/search-page";
import { getBlogConfig } from "@/lib/blog-config";
import { resolvePublicArticleTheme } from "@/lib/public-article-theme";
import { getPublicCategories } from "@/lib/public-route-resolution";

export const metadata: Metadata = {
  title: "Search",
  description: "Search published BlogBat articles.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SearchPage() {
  const [categories, config] = await Promise.all([
    getPublicCategories(),
    getBlogConfig(),
  ]);
  const articleTheme = resolvePublicArticleTheme(
    config.publicAppearance?.article,
  );

  return (
    <>
      <PublicBlogNav categories={categories} />
      <PublicSearchPage articleTheme={articleTheme} />
    </>
  );
}
