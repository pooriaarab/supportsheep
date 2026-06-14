"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useDebouncedCallback } from "use-debounce";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { useMountEffect } from "@/hooks/use-mount-effect";

type AutosaveStatus = "idle" | "saving" | "saved" | "error";

const DEFAULT_DEBOUNCE_MS = 1000;
const SAVE_STATUS_RESET_MS = 2000;
const ERROR_STATUS_RESET_MS = 3000;

interface UseAutosaveOptions<T> {
  data: T;
  onSave: (data: T) => Promise<void>;
  enabled?: boolean;
  debounceMs?: number;
  isEqual?: (a: T, b: T) => boolean;
}

interface UseAutosaveReturn {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  retry: () => void;
}

function defaultIsEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useAutosave<T>({
  data,
  onSave,
  enabled = true,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  isEqual = defaultIsEqual,
}: UseAutosaveOptions<T>): UseAutosaveReturn {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const lastSavedDataRef = useRef<T>(data);
  const lastFailedDataRef = useRef<T | null>(null);
  const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(false);
  const prevEnabledRef = useRef(enabled);

  const clearStatusTimeout = useCallback(() => {
    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
      statusTimeoutRef.current = null;
    }
  }, []);

  const performSave = useCallback(
    async (saveData: T) => {
      setStatus("saving");
      clearStatusTimeout();
      try {
        await onSave(saveData);
        lastSavedDataRef.current = saveData;
        lastFailedDataRef.current = null;
        setLastSavedAt(new Date());
        setStatus("saved");
        statusTimeoutRef.current = setTimeout(() => {
          setStatus("idle");
        }, SAVE_STATUS_RESET_MS);
      } catch {
        lastFailedDataRef.current = saveData;
        setStatus("error");
        statusTimeoutRef.current = setTimeout(() => {
          setStatus("idle");
        }, ERROR_STATUS_RESET_MS);
      }
    },
    [onSave, clearStatusTimeout],
  );

  const debouncedSave = useDebouncedCallback((saveData: T) => {
    performSave(saveData);
  }, debounceMs);

  // eslint-disable-next-line no-restricted-syntax
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      lastSavedDataRef.current = data;
      prevEnabledRef.current = enabled;
      return;
    }

    if (enabled && !prevEnabledRef.current) {
      lastSavedDataRef.current = data;
    }
    prevEnabledRef.current = enabled;

    if (!enabled) return;
    if (isEqual(data, lastSavedDataRef.current)) return;

    debouncedSave(data);
  }, [data, enabled, isEqual, debouncedSave]);

  // Cleanup on unmount — flush any pending save and clear the status timer.
  // Use latest refs so the cleanup body sees current callbacks without
  // re-binding the effect on every render.
  const clearStatusTimeoutRef = useLatestRef(clearStatusTimeout);
  const debouncedSaveRef = useLatestRef(debouncedSave);
  useMountEffect(() => {
    return () => {
      clearStatusTimeoutRef.current();
      debouncedSaveRef.current.flush();
    };
  });

  const retry = useCallback(() => {
    if (lastFailedDataRef.current !== null) {
      performSave(lastFailedDataRef.current);
    }
  }, [performSave]);

  return { status, lastSavedAt, retry };
}
