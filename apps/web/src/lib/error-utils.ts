/**
 * Error utility helpers
 *
 * Extracts human-readable messages from unknown error types.
 * Used throughout the app for consistent error reporting.
 */

/**
 * Extract a string message from any caught error value.
 * Handles Error instances, string throws, and unknown objects.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "Unknown error";
}
