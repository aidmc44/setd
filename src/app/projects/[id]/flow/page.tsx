// src/app/projects/[id]/flow/page.tsx
"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import FlowEditor from "../../../../components/FlowEditor";

export default function FlowPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-zinc-50 dark:bg-zinc-950">
      <div className="flex shrink-0 items-center justify-between border-b p-2 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.back()}
            className="rounded border px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Back
          </button>
          <h1 className="text-sm text-zinc-500">Program Flow</h1>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <FlowEditor projectId={id} />
      </div>
    </div>
  );
}