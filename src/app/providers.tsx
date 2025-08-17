// src/app/providers.tsx
"use client";

import React from "react";
import { TRPCReactProvider } from "../trpc/react";
import TooltipProvider from "../components/TooltipProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </TRPCReactProvider>
  );
}