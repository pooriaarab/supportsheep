import Link from "next/link";

interface PublicPaginationProps {
  page: number;
  hasMore: boolean;
  basePath: string;
}

function getPageHref(basePath: string, page: number) {
  if (page <= 1) {
    return basePath;
  }

  return `${basePath}?page=${page}`;
}

export function PublicPagination({
  page,
  hasMore,
  basePath,
}: PublicPaginationProps) {
  if (page <= 1 && !hasMore) {
    return null;
  }

  return (
    <nav className="mt-12 flex items-center justify-center gap-3">
      {page > 1 ? (
        <Link
          href={getPageHref(basePath, page - 1)}
          className="inline-flex min-w-28 items-center justify-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
        >
          Previous
        </Link>
      ) : (
        <span className="inline-flex min-w-28 items-center justify-center rounded-full border border-border/60 px-4 py-2 text-sm text-muted-foreground">
          Previous
        </span>
      )}

      <span className="text-sm font-medium text-muted-foreground">
        Page {page}
      </span>

      {hasMore ? (
        <Link
          href={getPageHref(basePath, page + 1)}
          className="inline-flex min-w-28 items-center justify-center rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/30 hover:text-primary"
        >
          Next
        </Link>
      ) : (
        <span className="inline-flex min-w-28 items-center justify-center rounded-full border border-border/60 px-4 py-2 text-sm text-muted-foreground">
          Next
        </span>
      )}
    </nav>
  );
}
