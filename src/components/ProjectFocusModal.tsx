// src/components/ProjectFocusModal.tsx
"use client";

import React, { useEffect } from "react";
import ProjectCard from "./ProjectCard";
import type { Project } from "@prisma/client";

export default function ProjectFocusModal({
  project,
  onClose,
}: {
  project: Project | undefined; // allow undefined
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  if (!project) return null; // guard

  return (
    <div className="fixed inset-0 z-50 ...">
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="h-[92vh] w-[min(1100px,100%)] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950/60 p-3 backdrop-blur">
          <h2 className="text-sm text-zinc-300">Focused project</h2>
          <button
            onClick={onClose}
            className="rounded border px-2 py-1 text-sm hover:bg-zinc-800"
          >
            Exit
          </button>
        </div>
        <div className="p-4">
          <ProjectCard project={project} />
        </div>
      </div>
    </div>
    <div className="p-4">
        <ProjectCard project={project} />
      </div>
    </div>
  );
}