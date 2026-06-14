/**
 * Article Editor Page
 *
 * Server component that renders the full-page TipTap editor for a single article.
 */

import { EditorLayout } from "@/components/posts/editor/editor-layout";

interface EditPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ fromInterview?: string | string[] }>;
}

export default async function EditPostPage({ params, searchParams }: EditPageProps) {
  const { slug } = await params;
  const { fromInterview } = await searchParams;

  const interviewId = typeof fromInterview === "string" ? fromInterview : undefined;

  return (
    <EditorLayout
      slug={decodeURIComponent(slug)}
      fromInterview={interviewId}
    />
  );
}
