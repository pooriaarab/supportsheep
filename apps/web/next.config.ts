import path from "node:path";
import type { NextConfig } from "next";
import { buildAgentDiscoveryLinkHeader } from "./src/lib/agent-discovery";
import { getDefaultSecurityHeaders } from "./src/lib/security-headers";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const isDev = process.env.NODE_ENV === "development";
const skipNextBuildTypecheck = process.env.SKIP_NEXT_BUILD_TYPECHECK === "true";

// With bun workspaces, packages are hoisted to the monorepo root
const workspaceRoot = path.resolve(__dirname, "../..");

/**
 * Force a single physical copy of each prosemirror-* package across the
 * bundle. Without this, code that imports via `@tiptap/pm/model` and code
 * that resolves `prosemirror-model` through a different node_modules path
 * (e.g. a nested TipTap extension whose hoisted copy lives in a sibling
 * directory) can end up with two distinct module instances at runtime --
 * which throws "Can not convert <> to a Fragment (looks like multiple
 * versions of prosemirror-model were loaded)" the moment Enter is pressed.
 *
 * Dedupe is enforced via:
 *   1. `overrides` + `resolutions` in the root package.json -- pins every
 *      prosemirror-* package to a single version across the workspace.
 *   2. Listing each prosemirror-* package in `transpilePackages` here --
 *      Next.js routes them through the app's own bundler config, which
 *      yields a single bundled copy regardless of where they were resolved
 *      from on disk. This works for both Webpack and Turbopack and avoids
 *      Turbopack's restriction that `resolveAlias` entries must be bare
 *      package specifiers (absolute paths are rejected as "server relative
 *      imports").
 */
const PROSEMIRROR_PACKAGES = [
  "prosemirror-model",
  "prosemirror-state",
  "prosemirror-view",
  "prosemirror-transform",
  "prosemirror-commands",
  "prosemirror-keymap",
  "prosemirror-schema-list",
  "prosemirror-tables",
  "prosemirror-history",
  "prosemirror-dropcursor",
  "prosemirror-gapcursor",
  "prosemirror-changeset",
];

const nextConfig: NextConfig = {
  // React Compiler auto-memoizes components and hooks (no manual useMemo/useCallback needed)
  reactCompiler: true,
  ...(skipNextBuildTypecheck
    ? {
        typescript: {
          // CI runs `bun run typecheck`; skip Next's duplicate deploy typecheck to avoid build-time OOMs.
          ignoreBuildErrors: true,
        },
      }
    : {}),
  // Enforce no-trailing-slash canonical URLs (default today; explicit for intent)
  trailingSlash: false,
  transpilePackages: ["@repo/ui", ...PROSEMIRROR_PACKAGES],
  turbopack: {
    root: workspaceRoot,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Link",
            value: buildAgentDiscoveryLinkHeader(),
          },
        ],
      },
      {
        source: "/(.*)",
        headers: getDefaultSecurityHeaders(isDev),
      },
    ];
  },
  async rewrites() {
    return {
      afterFiles: [
        {
          source: "/:indexNowKey.txt",
          destination: "/api/indexnow/:indexNowKey",
        },
      ],
    };
  },
  // `@google-cloud/logging` ships Node-only transitive deps (gRPC, protobufs).
  // Listing it here keeps Turbopack from trying to bundle it — the Cloud
  // Logging transport (apps/web/src/lib/logger/transports/gcp-cloud-logging.ts)
  // loads it via `createRequire(import.meta.url)` at runtime when
  // LOG_TRANSPORT=gcp.
  serverExternalPackages: [
    "@anthropic-ai/sdk",
    "shiki",
    "@google-cloud/logging",
  ],
  experimental: {
    // Allow large file uploads (e.g. WordPress XML imports up to 50MB)
    proxyClientMaxBodySize: 50 * 1024 * 1024,
    // Optimize barrel-file imports for faster builds and smaller bundles
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "date-fns",
      "@tanstack/react-query",
      "@tanstack/react-table",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-label",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "t0.gstatic.com",
        pathname: "/faviconV2/**",
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/pooriaarab-supportsheep.firebasestorage.app/**",
      },
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/pooriaarab-supportsheep.firebasestorage.app/**",
      },
    ],
  },
};

export default nextConfig;
