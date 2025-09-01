// src/components/ProjectCard.tsx
"use client";

import Link from "next/link";
import { api } from "../trpc/react";
import TaskItem from "./TaskItem";
import ExportProjectMenu from "./ExportProjectMenu";
import { useState, useMemo, useEffect } from "react";
import type { Project, Task } from "@prisma/client";

export default function ProjectCard({
  project,
  onFocus,
}: {
  project: Project;
  onFocus?: () => void;
}) {
  const utils = api.useUtils();
  const projectId = project.id; // must be a real id

  // Poll tasks every second for this exact project
  const tasksQuery = api.tasks.listByProject.useQuery(
    { projectId },
    {
      enabled: Boolean(projectId),
      refetchInterval: 1000,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    },
  );
  const { data: tasks } = tasksQuery;

  const createTask = api.tasks.create.useMutation({
    onSuccess: async () => {
      await utils.tasks.listByProject.invalidate({ projectId });
      await utils.tasks.listByProject.refetch({ projectId });
    },
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

  // Order: In progress → Todo → Done, then by createdAt
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

  // Temporary debug: log and show count so we can verify the non-empty card
  useEffect(() => {
    if (tasks) {
      console.log("ProjectCard", projectId, "tasks:", tasks.length);
    }
  }, [projectId, tasks]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 shadow-sm">
      {/* Title + description */}
      <div className="space-y-1 border-b border-zinc-800 p-3">
        <div className="text-lg font-semibold text-zinc-100">{project.title}</div>
        {project.description && (
          <div className="text-sm text-zinc-300">{project.description}</div>
        )}

        {/* TEMP DEBUG LINE — remove after verification */}
        <div className="text-[11px] text-zinc-500">
          id: {projectId} • tasks: {tasks?.length ?? 0}{" "}
          <button
            onClick={() => tasksQuery.refetch()}
            className="ml-2 rounded border px-1 text-[11px] hover:bg-zinc-800"
            title="Force refetch this card"
          >
            refetch
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 p-3">
        <button
          onClick={onFocus}
          className="rounded border px-2 py-1 text-sm hover:bg-zinc-800"
          title="Focus view"
        >
          Focus
        </button>
        <button
          onClick={() =>
            setPinned.mutate({ id: project.id, pinned: !project.pinned })
          }
          className={`rounded border px-2 py-1 text-sm hover:bg-zinc-800 ${
            project.pinned ? "bg-yellow-300/20" : ""
          }`}
          title={project.pinned ? "Unpin project" : "Pin project"}
        >
          {project.pinned ? "Unpin" : "Pin"}
        </button>
        <Link
          href={`/projects/${project.id}/flow`}
          className="rounded border px-2 py-1 text-sm hover:bg-zinc-800"
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
          className="rounded border px-2 py-1 text-sm hover:bg-zinc-800"
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
          className="rounded border border-red-500 px-2 py-1 text-sm text-red-400 hover:bg-red-950"
          title="Delete project"
        >
          Delete
        </button>

        <div className="ml-auto">
          <ExportProjectMenu project={project} />
        </div>
      </div>

      {/* Tasks */}
      <div className="space-y-2 p-3">
        {sortedTasks.map((t) => (
          // STABLE key so inputs keep focus and don't remount on updates
          <TaskItem key={t.id} task={t} />
        ))}

        <div className="flex items-center gap-2 pt-2">
          <input
            className="flex-1 rounded border border-zinc-800 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 placeholder-zinc-500"
            placeholder="New task title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            title="Type a task title"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newTitle.trim()) {
                createTask.mutate({
                  projectId,
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
                projectId,
                title: newTitle.trim(),
              });
              setNewTitle("");
            }}
            className="rounded border px-2 py-1 text-sm hover:bg-zinc-800"
            title="Add task"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}