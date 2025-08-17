// src/components/TooltipProvider.tsx
"use client";

import * as Tooltip from "@radix-ui/react-tooltip";

export default function TooltipProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Tooltip.Provider delayDuration={200} skipDelayDuration={0}>
      {children}
    </Tooltip.Provider>
  );
}