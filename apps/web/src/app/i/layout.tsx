/**
 * Layout for guest interview pages (`/i/[token]/consent`, `/i/[token]/live`,
 * `/i/[token]/live/video`, `/i/[token]/async`).
 *
 * These pages are dedicated, distraction-free interview surfaces. They
 * intentionally live OUTSIDE the `(public)/` route group so they don't
 * inherit the public `PublicShell` (top banner + blog header/footer nav).
 * Next.js layouts nest rather than replace,
 * so the earlier attempt to suppress the shell with a layout inside
 * `(public)/i/` only added a nested div underneath PublicShell.
 *
 * The in-call surface (`InCallLayoutDesktop`) renders its own sticky
 * header with the Supportsheep wordmark + "Interview" label, so we deliberately
 * leave the layout chrome-less here — no extra top bar, no announcement
 * banner. The page body takes the full viewport.
 */
export default function InterviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
