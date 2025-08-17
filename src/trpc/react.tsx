// src/trpc/react.ts
"use client";

import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, loggerLink } from "@trpc/client";
import superjson from "superjson";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { AppRouter } from "../server/api/root";

export const api = createTRPCReact<AppRouter>();

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return "http://localhost:3000";
}

export function TRPCReactProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 5_000 } },
      }),
  );

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