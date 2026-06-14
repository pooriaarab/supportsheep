/**
 * Shared Utilities
 *
 * Framework-agnostic utility functions used across the monorepo.
 * Import from "@repo/shared".
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";

/* -------------------------------------------------------------------------- */
/* Collections                                                                 */
/* -------------------------------------------------------------------------- */

export { COLLECTIONS, type CollectionName } from "./collections";

/* -------------------------------------------------------------------------- */
/* Class Names (cn)                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Merge class names with Tailwind CSS class deduplication.
 * Re-export from the shared package for use in any package.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* -------------------------------------------------------------------------- */
/* Date Formatting                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Format a date string or Date object into a human-readable format.
 *
 * @param date - ISO string or Date object
 * @param options - Intl.DateTimeFormat options (default: medium date + short time)
 */
export function formatDate(
  date: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

/**
 * Format a date as a relative time string (e.g., "2 hours ago", "in 3 days").
 *
 * @param date - ISO string or Date object
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";

  const now = Date.now();
  const diffMs = now - d.getTime();
  const absDiff = Math.abs(diffMs);
  const isFuture = diffMs < 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  const format = (value: number, unit: string) => {
    const label = value === 1 ? unit : `${unit}s`;
    return isFuture ? `in ${value} ${label}` : `${value} ${label} ago`;
  };

  if (seconds < 60) return "just now";
  if (minutes < 60) return format(minutes, "minute");
  if (hours < 24) return format(hours, "hour");
  if (days < 7) return format(days, "day");
  if (weeks < 5) return format(weeks, "week");
  if (months < 12) return format(months, "month");
  return format(years, "year");
}

/* -------------------------------------------------------------------------- */
/* String Utilities                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Truncate a string to a maximum length, appending "..." if truncated.
 *
 * @param str - The string to truncate
 * @param maxLength - Maximum character length (default: 100)
 */
export function truncate(str: string, maxLength = 100): string {
  if (!str || str.length <= maxLength) return str ?? "";
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Convert a string to a URL-safe slug.
 *
 * @example slugify("Hello World!") => "hello-world"
 */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove non-word chars (except spaces and hyphens)
    .replace(/[\s_]+/g, "-") // Replace spaces and underscores with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Capitalize the first letter of a string.
 *
 * @example capitalize("hello world") => "Hello world"
 */
export function capitalize(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Get initials from a name for avatar display.
 * Returns 1-2 uppercase characters.
 *
 * @example getInitials("John Doe") => "JD"
 * @example getInitials("Alice") => "A"
 * @example getInitials("john.doe@example.com") => "JD"
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";

  // Handle email addresses
  const cleanName = name.includes("@") ? name.split("@")[0] : name;

  const parts = cleanName
    .replace(/[._-]/g, " ") // Replace dots, underscores, hyphens with spaces
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/* -------------------------------------------------------------------------- */
/* ID Generation                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Generate a unique ID using nanoid.
 *
 * @param size - Character length (default: 21)
 */
export function generateId(size?: number): string {
  return nanoid(size);
}

/**
 * Generate a short, URL-friendly ID (8 characters).
 * Suitable for slugs, short codes, or human-readable references.
 */
export function generateShortId(): string {
  return nanoid(8);
}

/* -------------------------------------------------------------------------- */
/* Number Utilities                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Format a number with compact notation (e.g., 1.2K, 3.4M).
 */
export function formatCompactNumber(num: number): string {
  return Intl.NumberFormat("en-US", { notation: "compact" }).format(num);
}

/**
 * Clamp a number between a minimum and maximum value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/* -------------------------------------------------------------------------- */
/* Object Utilities                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Remove undefined and null values from an object (shallow).
 * Useful for building API payloads where missing fields should be omitted.
 */
export function compactObject<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

/**
 * Type-safe Object.keys that returns the correct key type.
 */
export function typedKeys<T extends Record<string, unknown>>(
  obj: T,
): Array<keyof T & string> {
  return Object.keys(obj) as Array<keyof T & string>;
}
