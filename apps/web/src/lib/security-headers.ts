/**
 * Security headers for the application
 *
 * Provides Content Security Policy (CSP) and other security headers.
 * Customize the CSP directives for your specific needs.
 */

export interface SecurityHeader {
  key: string;
  value: string;
}

/**
 * Build the Content Security Policy for the application
 */
export function buildContentSecurityPolicy(isDev: boolean): string {
  const connectSrc = [
    "'self'",
    "https://*.sentry.io",
    "https://*.clarity.ms",
    // GA4 (gtag.js) sends pageview/event collection beacons to these origins.
    // Without them the browser CSP blocks every GA hit, so the per-blog
    // Google Analytics tag injected on public pages would load but record
    // nothing.
    "https://www.google-analytics.com",
    "https://*.google-analytics.com",
    "https://*.analytics.google.com",
    "https://www.googletagmanager.com",
    // OpenAI realtime WebRTC handshake (browser → OpenAI direct, with the
    // ephemeral client_secret as bearer). Without these the browser CSP
    // blocks the SDP exchange:
    //   "Connecting to 'https://api.openai.com/v1/realtime?model=...'
    //    violates the following Content Security Policy directive:
    //    \"connect-src 'self' ...\". The action has been blocked."
    // followed by `Failed to establish realtime WebRTC connection`.
    "https://api.openai.com",
    "wss://api.openai.com",
    // Tavus video provider connects to Daily.co signalling / STUN-TURN over
    // HTTPS and WSS. The browser opens these straight from our same-origin
    // page via the Daily JS SDK (custom call object); same pattern as the
    // OpenAI realtime block — without them the call never establishes.
    "https://*.tavus.io",
    "wss://*.tavus.io",
    "https://*.daily.co",
    "wss://*.daily.co",
    ...(isDev ? ["http://localhost:*", "ws://localhost:*"] : []),
  ];

  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://www.clarity.ms https://www.googletagmanager.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https://*.googleusercontent.com https://images.unsplash.com https://source.unsplash.com https://images.pexels.com",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connectSrc.join(" ")}`,
    // `media-src` covers <audio>/<video> sources.
    "media-src 'self' blob:",
    // Tavus renders the conversation inside an iframe that loads a Daily.co
    // room; both origins must be in frame-src for the video flow to work.
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://tally.so https://*.tally.so https://*.tavus.io https://tavusapi.com https://*.daily.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

/**
 * Get the default security headers for all responses
 */
export function getDefaultSecurityHeaders(isDev: boolean): SecurityHeader[] {
  return [
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      // Allowlist includes `self` plus Tavus and Daily.co — Tavus embeds the
      // call inside an iframe hosted on their domains and Daily.co handles
      // the underlying WebRTC media. Without explicit allow-list entries the
      // iframe inherits the parent document's policy, fires
      // `[permissions-policy-violation]` warnings, and `getUserMedia()`
      // resolves with `NotAllowedError: Permission denied` even though the
      // user has granted browser-level mic/camera permission. Geolocation
      // remains `(self)` because some third-party SDKs probe it during init.
      // `display-capture=()` is denied — the guest interview flow never
      // needs screen-share and an empty allowlist blocks accidental
      // capture by an embedded provider.
      value:
        'camera=(self "https://*.tavus.io" "https://*.daily.co"), microphone=(self "https://*.tavus.io" "https://*.daily.co"), geolocation=(self), display-capture=()',
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=31536000; includeSubDomains",
    },
    {
      key: "X-DNS-Prefetch-Control",
      value: "on",
    },
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(isDev),
    },
  ];
}
