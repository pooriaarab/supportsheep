import type { PublicTopBannerConfig } from "@repo/types";

interface PublicTopBannerProps {
  topBanner?: PublicTopBannerConfig;
  isHomepage?: boolean;
}

export function PublicTopBanner({
  topBanner,
  isHomepage = false,
}: PublicTopBannerProps) {
  if (!topBanner?.enabled) {
    return null;
  }

  if (topBanner.scope === "homepage" && !isHomepage) {
    return null;
  }

  return (
    <div
      className="px-4 py-2 text-center text-sm leading-6"
      style={{
        backgroundColor: topBanner.backgroundColor,
        color: topBanner.textColor,
      }}
    >
      <p className="mx-auto max-w-6xl">{topBanner.message}</p>
    </div>
  );
}
