// src/components/ProjectCard.tsx
"use client";

import Link from "next/link";
import { api } from "../trpc/react";
import TaskItem from "./TaskItem";
import { useState, useMemo } from "react";
import type { Project, Task } from "@prisma/client";

export default function ProjectCard({
  project,
  onFocus,
}: {
  project: Project;
  onFocus?: () => void;
}) {
  const utils = api.useUtils();

  const { data: tasks } = api.tasks.listByProject.useQuery({
    projectId: project.id,
  });

  const createTask = api.tasks.create.useMutation({
    onSuccess: () => utils.tasks.listByProject.invalidate(),
  });

  const archive = api.projects.setArchived.useMutation({
    onSuccess: () => utils.projects.list.invalidate(),
  });

  const setPinned = api.projects.setPinned.useMutation({
    onSuccess: () => utils.projects.list.invalidate(),
  });

  const deleteProject = api.projects.delete.useMutation({
    onSuccess: () => utils.projects.list.invalidate(),
  });

  const [newTitle, setNewTitle] = useState("");

  // In progress first, then todo, then done
  const sortedTasks = useMemo(() => {
    const arr = (tasks ?? []).slice();
    const rank = (s: Task["status"]) =>
      s === "IN_PROGRESS" ? 0 : s === "NOT_STARTED" ? 1 : 2;
    arr.sort((a, b) => {
      const dr = rank(a.status) - rank(b.status);
      if (dr !== 0) return dr;
      return +new Date(a.createdAt as any) - +new Date(b.createdAt as any);
    });
    return arr;
  }, [tasks]);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900/60">
      {/* Title + description on top, wrap naturally */}
      <div className="space-y-1 border-b p-3 dark:border-zinc-800">
        <div className="text-lg font-semibold">{project.title}</div>
        {project.description && (
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            {project.description}
          </div>
        )}
      </div>

      {/* Button row beneath title/description */}
      <div className="flex flex-wrap items-center gap-2 border-b p-3 dark:border-zinc-800">
        <button
          onClick={onFocus}
          className="rounded border px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          title="Focus view"
        >
          Focus
        </button>
        <button
          onClick={() =>
            setPinned.mutate({ id: project.id, pinned: !project.pinned })
          }
          className={`rounded border px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
            project.pinned ? "bg-yellow-100 dark:bg-yellow-300/20" : ""
          }`}
          title={project.pinned ? "Unpin project" : "Pin project"}
        >
          {project.pinned ? "Unpin" : "Pin"}
        </button>
        <Link
          href={`/projects/${project.id}/flow`}
          className="rounded border px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          title="Open program flow map"
        >
          Flow
        </Link>
        <button
          onClick={() =>
            archive.mutate({
              id: project.id,
              archived: project.status === "ACTIVE",
            })
          }
          className="rounded border px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
          title={project.status === "ACTIVE" ? "Archive project" : "Unarchive"}
        >
          {project.status === "ACTIVE" ? "Archive" : "Unarchive"}
        </button>
        <button
          onClick={() => {
            if (
              confirm(
                `Delete project "${project.title}"? This will remove all tasks and flow data.`,
              )
            ) {
              deleteProject.mutate({ id: project.id });
            }
          }}
          className="rounded border border-red-500 px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
          title="Delete project"
        >
          Delete
        </button>
      </div>

      <div className="space-y-2 p-3">
        {sortedTasks.map((t: Task) => (
          <TaskItem key={t.id} task={t} />
        ))}

        <div className="flex items-center gap-2 pt-2">
          <input
            className="flex-1 rounded border px-2 py-1 text-sm transition-colors bg-white text-zinc-900 placeholder-zinc-400 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500"
            placeholder="New task title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            title="Type a task title"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) {
                createTask.mutate({
                  projectId: project.id,
                  title: newTitle.trim(),
                });
                setNewTitle("");
              }
            }}
          />
          <button
            onClick={() => {
              if (!newTitle.trim()) return;
              createTask.mutate({
                projectId: project.id,
                title: newTitle.trim(),
              });
              setNewTitle("");
            }}
            className="rounded border px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            title="Add task"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}