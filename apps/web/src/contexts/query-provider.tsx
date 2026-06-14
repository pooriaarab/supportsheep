"use client";

/**
 * TanStack Query Provider for React Query
 *
 * Wraps the application with QueryClientProvider to enable data fetching,
 * caching, and state management via TanStack Query (React Query).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // Create a client instance per component instance
  // This ensures that data is not shared between different users and requests
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for admin dashboard
            refetchOnWindowFocus: false,
            // Cache data for 5 minutes
            staleTime: 5 * 60 * 1000,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
