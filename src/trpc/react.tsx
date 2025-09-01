"use client";

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import superjson from "superjson";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import React from "react";
import type { AppRouter } from "../server/api/root";

export const api = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return "http://localhost:3000";
}

// Cross-tab sync key
const SYNC_KEY = "setd-sync";

export function emitCrossTabSync() {
  try {
    localStorage.setItem(SYNC_KEY, String(Date.now()));
    // Optional cleanup to keep storage tidy
    localStorage.removeItem(SYNC_KEY);
  } catch {}
}

export function TRPCReactProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Strong live updates
            refetchInterval: 1000,
            refetchOnMount: true,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            staleTime: 0,
            retry: 2,
            // Prefer replacing arrays so lists re-render with fresh rows
            structuralSharing: false,
          },
          mutations: { retry: 2 },
        },
      }),
  );

  // Cross-tab cache sync via storage events
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key === SYNC_KEY && e.newValue) {
        // Invalidate everything; it's cheap because queries are small
        queryClient.invalidateQueries();
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [queryClient]);

  const [trpcClient] = React.useState(() =>
    api.createClient({
      links: [
        loggerLink({
          enabled: () =>
            process.env.NODE_ENV === "development" &&
            typeof window !== "undefined",
        }),
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
        }),
      ],
    }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {children}
      </api.Provider>
    </QueryClientProvider>
  );
}