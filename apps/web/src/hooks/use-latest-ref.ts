import { useInsertionEffect, useRef } from "react";

/**
 * Keep a ref always in sync with the latest value.
 *
 * Useful for callbacks passed to effects or event listeners: the effect
 * captures the ref (stable) while the ref always points at the freshest
 * callback, avoiding stale-closure bugs.
 *
 * Uses `useInsertionEffect` so the ref is updated synchronously before
 * any layout or passive effects read it.
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useInsertionEffect(() => {
    ref.current = value;
  });
  return ref;
}
