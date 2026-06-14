import { useEffect } from "react";

/**
 * Wrapper around useEffect that runs once on mount and optionally cleans up on unmount.
 * This is the ONLY place direct useEffect is allowed -- all other effects are banned.
 *
 * Use for: DOM integration, third-party widget init, browser API subscriptions, analytics.
 * Do NOT use for: derived state (compute inline), data fetching (use TanStack Query),
 * or responding to user actions (use event handlers).
 *
 * @see https://react.dev/learn/you-might-not-need-an-effect
 */

export function useMountEffect(effect: () => void | (() => void)) {
  // eslint-disable-next-line no-restricted-syntax, react-hooks/exhaustive-deps
  useEffect(effect, []);
}
