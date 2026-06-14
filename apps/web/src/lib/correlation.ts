/**
 * Correlation ID propagation via AsyncLocalStorage.
 * Generate at API entry, propagate through entire request chain.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { nanoid } from "nanoid";
import { registerCorrelationIdGetter } from "./logger";

interface CorrelationStore {
  correlationId: string;
}

const store = new AsyncLocalStorage<CorrelationStore>();

export function generateCorrelationId(): string {
  return nanoid(12);
}

export function withCorrelationId<T>(correlationId: string, fn: () => T): T {
  return store.run({ correlationId }, fn);
}

export function getCorrelationId(): string | undefined {
  return store.getStore()?.correlationId;
}

// Auto-register the getter so the logger can access correlation IDs
// without importing this module directly (avoids client-side breakage).
registerCorrelationIdGetter(getCorrelationId);
