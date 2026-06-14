import Image from "next/image";
import Link from "next/link";
import { ArticleCard } from "@/components/public/article-card";
import { buildAuthorJsonLd, getAuthorPath } from "@/lib/authors";
import type { ResolvedPublicArticleTheme } from "@/lib/public-article-theme";
import { stringifyJsonLdForScript } from "@/lib/public-site";
import type { Article, Author } from "@repo/types";

interface AuthorPageProps {
  author: Author;
  articles: (Article & { id: string })[];
  siteUrl: string;
  articleTheme?: ResolvedPublicArticleTheme;
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function AuthorPage({
  author,
  articles,
  siteUrl,
  articleTheme,
}: AuthorPageProps) {
  const personJsonLd = buildAuthorJsonLd(author, siteUrl);
  const articleCount = articles.length;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: stringifyJsonLdForScript(personJsonLd),
        }}
      />

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <nav className="mb-7 text-sm text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-foreground">
            Blog
          </Link>
          <span className="mx-2">/</span>
          <span>Authors</span>
          <span className="mx-2">/</span>
          <span className="text-foreground">{author.name}</span>
        </nav>

        <header className="mb-10 rounded-[2rem] border border-border bg-card px-6 py-8 shadow-[0_24px_80px_-52px_rgba(20,24,35,0.5)] sm:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {author.avatarUrl ? (
              <Image
                src={author.avatarUrl}
                alt={`${author.name} avatar`}
                width={96}
                height={96}
                unoptimized
                className="size-24 shrink-0 rounded-full border border-border object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <h1 className="font-[family:var(--font-plus-jakarta-sans)] text-3xl font-semibold text-foreground sm:text-4xl">
                {author.name}
              </h1>
              {author.jobTitle ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {author.jobTitle}
                </p>
              ) : null}
              {author.bio ? (
                <p className="mt-4 max-w-2xl whitespace-pre-line text-base leading-8 text-muted-foreground">
                  {author.bio}
                </p>
              ) : null}
              {author.sameAs && author.sameAs.length > 0 ? (
                <ul className="mt-5 flex flex-wrap gap-3 text-sm">
                  {author.sameAs.map((url) => (
                    <li key={url}>
                      <Link
                        href={url}
                        rel="me noopener noreferrer"
                        target="_blank"
                        className="text-primary hover:text-link-hover"
                      >
                        {getHostname(url)}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Author page: {siteUrl}
            {getAuthorPath(author.id)}
          </p>
        </header>

        <section>
          <h2 className="mb-6 font-[family:var(--font-plus-jakarta-sans)] text-2xl font-semibold text-foreground">
            {articleCount === 1 ? "1 article" : `${articleCount} articles`}
          </h2>

          {articles.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  articleTheme={articleTheme}
                />
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-muted-foreground">
              No articles published by this author yet.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
