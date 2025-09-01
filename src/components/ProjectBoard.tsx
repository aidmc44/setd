// src/components/ProjectBoard.tsx
"use client";

import React, { useEffect, useMemo, useState, useCallback, Fragment } from "react";
import { api } from "../trpc/react";
import ProjectCard from "./ProjectCard";
import ProjectFocusModal from "./ProjectFocusModal";
import type { Project } from "@prisma/client";

export default function ProjectBoard() {
  const [includeArchived, setIncludeArchived] = useState(false);
  const [q, setQ] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);

  const utils = api.useUtils();
  const { data: projects } = api.projects.list.useQuery(
    { includeArchived, q },
    {
      refetchInterval: 1000,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    },
  );

  // Keep local list in sync with server results (so polling refreshes the UI)
  const [local, setLocal] = useState<Project[]>([]);
  useEffect(() => setLocal(projects ?? []), [projects]);

  // Drag reorder (unchanged behavior, but uses local that rehydrates from server)
  const reorder = api.projects.reorder.useMutation({
    onSuccess: () => utils.projects.list.invalidate(),
  });

  const onDragStart = useCallback(
    (idx: number) =>
      (e: React.DragEvent<HTMLDivElement>) =>
        e.dataTransfer.setData("text/plain", String(idx)),
    [],
  );

  const onDrop = useCallback(
    (idx: number) =>
      (e: React.DragEvent<HTMLDivElement>) => {
        const from = Number(e.dataTransfer.getData("text/plain"));
        const copy = [...local];
        const [moved] = copy.splice(from, 1);
        if (!moved) return;
        copy.splice(idx, 0, moved);
        setLocal(copy);
        reorder.mutate(copy.map((p, i) => ({ id: p.id, position: i + 1 })));
      },
    [local, reorder],
  );

  const items: Project[] = useMemo(() => local, [local]);
  const focusProject = items.find((p) => p.id === focusId);

  // Create project (optional quick creator at top)
  const createProject = api.projects.create.useMutation({
    onSuccess: () => utils.projects.list.invalidate(),
  });
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const handleCreate = () => {
    const title = newTitle.trim();
    if (!title) return;
    createProject.mutate({
      title,
      description: newDesc.trim() || undefined,
    });
    setNewTitle("");
    setNewDesc("");
  };

  return (
    <Fragment>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <input
              className="min-w-64 rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-sm text-zinc-100 placeholder-zinc-500"
              placeholder="Search projects..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              title="Search by title or description"
            />
            <label className="flex items-center gap-2 text-sm" title="Toggle archived">
              <input
                type="checkbox"
                checked={includeArchived}
                onChange={(e) => setIncludeArchived(e.target.checked)}
              />
              Show archived
            </label>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
              className="rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-sm text-zinc-100 placeholder-zinc-500"
              placeholder="Project title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <input
              className="w-72 rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-sm text-zinc-100 placeholder-zinc-500"
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || createProject.isPending}
              className="rounded border px-3 py-1 text-sm hover:bg-zinc-800 disabled:opacity-50"
              title="Add project"
            >
              {createProject.isPending ? "Adding..." : "Add Project"}
            </button>
          </div>
        </div>

        {/* Masonry layout (optional). Replace with grid if you prefer. */}
        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {items.map((p, i) => (
            <div
              key={p.id}
              className="mb-4 break-inside-avoid"
              draggable
              onDragStart={onDragStart(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop(i)}
              title="Drag to reorder"
            >
              <ProjectCard project={p} onFocus={() => setFocusId(p.id)} />
            </div>
          ))}
        </div>
      </div>

      {/* Fullscreen focus modal (guarded) */}
      {focusId && focusProject && (
        <ProjectFocusModal project={focusProject} onClose={() => setFocusId(null)} />
      )}
    </Fragment>
  );
}