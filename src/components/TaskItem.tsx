// src/components/TaskItem.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { api } from "../trpc/react";
import { TaskStatus, type Task } from "@prisma/client";
import dynamic from "next/dynamic";
import { useAutosave } from "../utils/autosave";
import { emitCrossTabSync } from "../trpc/react";

const RichTextEditor = dynamic(() => import("./RichTextEditor"), {
  ssr: false,
});

function statusBtnClasses(target: TaskStatus, current: TaskStatus): string {
  const active = current === target;
  const base =
    "rounded border px-3 h-8 min-w-[110px] inline-flex items-center justify-center text-xs whitespace-nowrap transition-colors";
  const map: Record<TaskStatus, { off: string; on: string }> = {
    NOT_STARTED: {
      off: "border-zinc-500 text-zinc-300 hover:bg-zinc-800",
      on: "bg-zinc-700 text-white border-zinc-700",
    },
    IN_PROGRESS: {
      off: "border-blue-500 text-blue-300 hover:bg-blue-950",
      on: "bg-blue-600 text-white border-blue-600",
    },
    COMPLETED: {
      off: "border-green-600 text-green-300 hover:bg-green-950",
      on: "bg-green-600 text-white border-green-600",
    },
  };
  const cfg = map[target] ?? map.NOT_STARTED;
  return `${base} ${active ? cfg.on : cfg.off}`;
}

export default function TaskItem({ task }: { task: Task }) {
  const utils = api.useUtils();

  // Local drafts
  const [titleDraft, setTitleDraft] = useState(task.title);
  const [notesDraft, setNotesDraft] = useState(task.notesJson as any);

  // Editing and saving flags
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

  // Dirty checks (draft vs latest server)
  const titleDirty = titleDraft !== task.title;
  const notesDirty =
    JSON.stringify(notesDraft ?? null) !== JSON.stringify(task.notesJson ?? null);

  // Render values: prefer draft while editing or saving or dirty
  const renderTitle =
    editingTitle || savingTitle || titleDirty ? titleDraft : task.title;
  const renderNotes =
    editingNotes || savingNotes || notesDirty ? notesDraft : (task.notesJson as any);

  // Keep drafts aligned with server only if not editing or saving
  useEffect(() => {
    if (!editingTitle && !savingTitle && titleDraft !== task.title) {
      setTitleDraft(task.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, task.title, task.updatedAt, editingTitle, savingTitle]);

  useEffect(() => {
    if (editingNotes || savingNotes) return;
    const incoming = JSON.stringify(task.notesJson ?? null);
    const local = JSON.stringify(notesDraft ?? null);
    if (incoming !== local) setNotesDraft(task.notesJson as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id, task.notesJson, task.updatedAt, editingNotes, savingNotes]);

  // Mutations with optimistic cache update
  const updateTitle = api.tasks.updateTitle.useMutation({
    onMutate: async (vars) => {
      await utils.tasks.listByProject.cancel({ projectId: task.projectId });
      const prev = utils.tasks.listByProject.getData({
        projectId: task.projectId,
      });
      utils.tasks.listByProject.setData({ projectId: task.projectId }, (old) =>
        (old ?? []).map((t) =>
          t.id === task.id ? { ...t, title: vars.title, updatedAt: new Date() as any } : t,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev)
        utils.tasks.listByProject.setData({ projectId: task.projectId }, ctx.prev);
    },
    onSettled: () => {
      utils.tasks.listByProject.invalidate({ projectId: task.projectId });
      emitCrossTabSync();
      setSavingTitle(false);
    },
  });

  const updateNotes = api.tasks.updateNotes.useMutation({
    onMutate: async (vars) => {
      await utils.tasks.listByProject.cancel({ projectId: task.projectId });
      const prev = utils.tasks.listByProject.getData({
        projectId: task.projectId,
      });
      utils.tasks.listByProject.setData({ projectId: task.projectId }, (old) =>
        (old ?? []).map((t) =>
          t.id === task.id
            ? { ...t, notesJson: vars.notesJson, updatedAt: new Date() as any }
            : t,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev)
        utils.tasks.listByProject.setData({ projectId: task.projectId }, ctx.prev);
    },
    onSettled: () => {
      utils.tasks.listByProject.invalidate({ projectId: task.projectId });
      emitCrossTabSync();
      setSavingNotes(false);
    },
  });

  const updateStatus = api.tasks.updateStatus.useMutation({
    onMutate: async (vars) => {
      await utils.tasks.listByProject.cancel({ projectId: task.projectId });
      const prev = utils.tasks.listByProject.getData({
        projectId: task.projectId,
      });
      utils.tasks.listByProject.setData({ projectId: task.projectId }, (old) =>
        (old ?? []).map((t) =>
          t.id === task.id ? { ...t, status: vars.to, updatedAt: new Date() as any } : t,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev)
        utils.tasks.listByProject.setData({ projectId: task.projectId }, ctx.prev);
    },
    onSettled: () =>
      utils.tasks.listByProject.invalidate({ projectId: task.projectId }),
  });

  // Autosave while typing (debounced)
  useAutosave(
    titleDraft,
    async (t) => {
      if (!editingTitle) return;
      if (t !== task.title) {
        setSavingTitle(true);
        await updateTitle.mutateAsync({ id: task.id, title: t });
      }
    },
    450,
  );

  useAutosave(
    notesDraft,
    async (n) => {
      if (!editingNotes) return;
      const incoming = JSON.stringify(task.notesJson ?? null);
      const local = JSON.stringify(n ?? null);
      if (incoming !== local) {
        setSavingNotes(true);
        await updateNotes.mutateAsync({ id: task.id, notesJson: n });
      }
    },
    700,
  );

  const done = task.status === TaskStatus.COMPLETED;

  // Auto-grow for title
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const autoGrow = () => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.max(el.scrollHeight, 36) + "px";
  };
  useEffect(() => autoGrow(), [renderTitle]);

  // Immediate commit on blur if draft is dirty
  const handleTitleBlur = async () => {
    if (titleDirty) {
      setSavingTitle(true);
      await updateTitle.mutateAsync({ id: task.id, title: titleDraft });
    }
    setEditingTitle(false);
  };

  const handleNotesBlur = async () => {
    if (notesDirty) {
      setSavingNotes(true);
      await updateNotes.mutateAsync({ id: task.id, notesJson: notesDraft });
    }
    setEditingNotes(false);
  };

  return (
    <div className="rounded border border-zinc-700 p-3">
      {/* Timestamps */}
      <div className="mb-2 grid grid-cols-2 gap-2 text-[11px] text-zinc-400">
        <span>Created: {new Date(task.createdAt).toLocaleString()}</span>
        <span className="text-right">
          Updated: {new Date(task.updatedAt).toLocaleString()}
        </span>
      </div>

      {/* Title */}
      <textarea
        ref={titleRef}
        className="w-full resize-none bg-transparent text-center text-[15px] font-semibold leading-5 outline-none text-zinc-100"
        value={renderTitle}
        onFocus={() => setEditingTitle(true)}
        onBlur={handleTitleBlur}
        onChange={(e) => setTitleDraft(e.target.value)}
        onInput={autoGrow}
        rows={1}
        placeholder="Task title"
        disabled={done}
      />

      {/* Status */}
      <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-1">
        {[TaskStatus.NOT_STARTED, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED].map(
          (s) => (
            <button
              key={s}
              onClick={() => updateStatus.mutate({ id: task.id, to: s })}
              className={statusBtnClasses(s, task.status)}
              aria-pressed={task.status === s}
              title={`Mark as ${
                s === TaskStatus.NOT_STARTED
                  ? "Todo"
                  : s === TaskStatus.IN_PROGRESS
                  ? "In progress"
                  : "Done"
              }`}
            >
              {s === TaskStatus.NOT_STARTED
                ? "Todo"
                : s === TaskStatus.IN_PROGRESS
                ? "In progress"
                : "Done"}
            </button>
          ),
        )}
      </div>

      {/* Notes */}
      <div
        className={`mt-2 ${done ? "opacity-70" : ""}`}
        onFocusCapture={() => setEditingNotes(true)}
        onBlurCapture={handleNotesBlur}
      >
        <RichTextEditor
          value={renderNotes}
          onChange={setNotesDraft}
          editable={!done}
        />
      </div>
    </div>
  );
}