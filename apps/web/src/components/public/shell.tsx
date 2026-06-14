import { PublicHeader } from "@/components/public/header";
import { PublicFooter } from "@/components/public/footer";
import { PublicTopBanner } from "@/components/public/top-banner";
import { GoogleAnalytics } from "@/components/public/google-analytics";
import {
  buildPublicSiteSchema,
  resolvePublicSiteUrl,
  stringifyJsonLdForScript,
} from "@/lib/public-site";
import { hasEnabledPublicFreeTools } from "@/lib/free-tools/repository";
import { getConnectedGoogleAnalyticsMeasurementId } from "@/lib/integrations/google-sync-config";
import { resolvePublicMeasurementId } from "@/lib/analytics/measurement-tags";
import { SupportVoiceWidget } from "@/components/public/support-voice-widget";
import { SupportChatWidget } from "@/components/public/support-chat-widget";
import { getBlogConfig } from "@/lib/blog-config";
import { getRequestBlogId } from "@/lib/tenancy/request-blog";
import type { BlogConfig } from "@repo/types";

interface PublicShellProps {
  config: BlogConfig;
  children: React.ReactNode;
  isHomepage?: boolean;
}

const PUBLIC_THEME_STYLES = {
  light: {
    "--background": "#fbfbfd",
    "--foreground": "#1d2433",
    "--card": "#ffffff",
    "--card-foreground": "#1d2433",
    "--popover": "#ffffff",
    "--popover-foreground": "#1d2433",
    "--primary": "#6d4aff",
    "--primary-foreground": "#ffffff",
    "--secondary": "#f4f1ff",
    "--secondary-foreground": "#3b2c86",
    "--muted": "#f3f4f8",
    "--muted-foreground": "#697085",
    "--accent": "#f4f1ff",
    "--accent-foreground": "#3b2c86",
    "--border": "#e5e7ef",
    "--input": "#e5e7ef",
    "--ring": "#6d4aff",
    "--link": "#6d4aff",
    "--link-hover": "#5232d4",
    colorScheme: "light",
  },
  dark: {
    "--background": "#141126",
    "--foreground": "#f7f6fb",
    "--card": "#1b1730",
    "--card-foreground": "#f7f6fb",
    "--popover": "#1b1730",
    "--popover-foreground": "#f7f6fb",
    "--primary": "#8f72ff",
    "--primary-foreground": "#ffffff",
    "--secondary": "#241f3f",
    "--secondary-foreground": "#ece9ff",
    "--muted": "#231d39",
    "--muted-foreground": "#b6b0ce",
    "--accent": "#241f3f",
    "--accent-foreground": "#ece9ff",
    "--border": "#352e56",
    "--input": "#352e56",
    "--ring": "#8f72ff",
    "--link": "#a68fff",
    "--link-hover": "#cabdff",
    colorScheme: "dark",
  },
} as const;

export async function PublicShell({
  config,
  children,
  isHomepage = false,
}: PublicShellProps) {
  const themeMode = config.publicAppearance?.themeMode ?? "light";
  const siteUrl = resolvePublicSiteUrl();
  const siteSchema = buildPublicSiteSchema(config, siteUrl);
  // Resolve the GA4 tag from the HOST-RESOLVED blog config so blog A's public
  // pages only ever carry blog A's Measurement ID. `getRequestBlogId` and
  // `getBlogConfig` both degrade safely (never throw, fall back to the default
  // blog / no-tag) so a resolver/DB hiccup or a static prerender without a
  // Cloudflare context can never 500 the public site.
  const requestBlogId = await getRequestBlogId();
  const [showToolsLink, connectedMeasurementId, hostBlogConfig] =
    await Promise.all([
      hasEnabledPublicFreeTools(),
      getConnectedGoogleAnalyticsMeasurementId(),
      getBlogConfig(requestBlogId),
    ]);
  const measurementId = resolvePublicMeasurementId(
    hostBlogConfig.analytics?.gaMeasurementId,
    connectedMeasurementId,
  );

  return (
    <div
      className="min-h-screen bg-background font-[family:var(--font-ibm-plex-sans)] text-foreground"
      style={PUBLIC_THEME_STYLES[themeMode]}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: stringifyJsonLdForScript(siteSchema),
        }}
      />
      {measurementId ? (
        <GoogleAnalytics measurementId={measurementId} />
      ) : null}
      <div className="flex min-h-screen flex-col">
        <PublicTopBanner
          topBanner={config.publicAppearance?.topBanner}
          isHomepage={isHomepage}
        />
        <PublicHeader config={config} />
        <main className="flex-1">{children}</main>
        <PublicFooter config={config} showToolsLink={showToolsLink} />
        {config.support?.enableVoice && <SupportVoiceWidget />}
        {config.support?.enableChatbot && <SupportChatWidget />}
      </div>
    </div>
  );
}
