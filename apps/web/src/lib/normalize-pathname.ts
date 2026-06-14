export function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) {
    return "/";
  }

  if (!trimmed.startsWith("/")) {
    return trimmed;
  }

  const withoutTrailingSlash = trimmed.replace(/\/+$/g, "");
  return withoutTrailingSlash || "/";
}
