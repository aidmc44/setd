// src/components/TaskItem.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { api } from "../trpc/react";
import { TaskStatus, type Task } from "@prisma/client";
import dynamic from "next/dynamic";
import { useAutosave } from "../utils/autosave";

const RichTextEditor = dynamic(() => import("./RichTextEditor"), {
  ssr: false,
});

function statusBtnClasses(
  target: TaskStatus,
  current: TaskStatus,
): string {
  const active = current === target;
  const base =
    "rounded border px-3 h-8 min-w-[110px] inline-flex items-center justify-center text-xs whitespace-nowrap transition-colors";
  const map: Record<TaskStatus, { off: string; on: string }> = {
    NOT_STARTED: {
      off: "border-zinc-400 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
      on: "bg-zinc-700 text-white border-zinc-700",
    },
    IN_PROGRESS: {
      off: "border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950",
      on: "bg-blue-600 text-white border-blue-600",
    },
    COMPLETED: {
      off: "border-green-600 text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-950",
      on: "bg-green-600 text-white border-green-600",
    },
  };
  const cfg = map[target] ?? map.NOT_STARTED;
  return `${base} ${active ? cfg.on : cfg.off}`;
}

export default function TaskItem({ task }: { task: Task }) {
  const utils = api.useUtils();

  const updateTitle = api.tasks.updateTitle.useMutation({
    onSuccess: () => utils.tasks.listByProject.invalidate(),
  });
  const updateNotes = api.tasks.updateNotes.useMutation({
    onSuccess: () => utils.tasks.listByProject.invalidate(),
  });
  const updateStatus = api.tasks.updateStatus.useMutation({
    onSuccess: () => utils.tasks.listByProject.invalidate(),
  });

  const done = task.status === TaskStatus.COMPLETED;

  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notesJson as any);

  // Auto-grow title textarea
  const titleRef = useRef<HTMLTextAreaElement | null>(null);
  const autoGrow = () => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = Math.max(el.scrollHeight, 36) + "px";
  };
  useEffect(() => {
    autoGrow();
  }, [title]);

  useAutosave(title, (t) => updateTitle.mutateAsync({ id: task.id, title: t }), 500);
  useAutosave(notes, (n) => updateNotes.mutateAsync({ id: task.id, notesJson: n }), 800);

  return (
    <div className="rounded border p-3 transition-colors dark:border-zinc-700">
      {/* Title above buttons; larger font; centered; wraps; no bg */}
      <textarea
        ref={titleRef}
        className="w-full resize-none bg-transparent text-center text-[15px] font-semibold leading-5 outline-none text-zinc-900 dark:text-zinc-100 transition-colors"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onInput={autoGrow}
        rows={1}
        placeholder="Task title"
        disabled={done}
        title="Task title"
      />

      {/* Status buttons centered horizontally; always enabled */}
      <div className="mt-2 flex w-full flex-wrap items-center justify-center gap-1">
        {[
          { s: TaskStatus.NOT_STARTED, label: "Todo" },
          { s: TaskStatus.IN_PROGRESS, label: "In progress" },
          { s: TaskStatus.COMPLETED, label: "Done" },
        ].map((o) => (
          <button
            key={o.s}
            onClick={() => updateStatus.mutate({ id: task.id, to: o.s })}
            className={statusBtnClasses(o.s, task.status)}
            aria-pressed={task.status === o.s}
            title={`Mark as ${o.label}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* Notes editor becomes read-only when done */}
      <div className={`mt-2 ${done ? "opacity-70" : ""}`}>
        <RichTextEditor value={notes} onChange={setNotes} editable={!done} />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-500 dark:text-zinc-400 transition-colors">
        <span title="Created timestamp">
          Created: {new Date(task.createdAt).toLocaleString()}
        </span>
        <span title="Last updated timestamp">
          Updated: {new Date(task.updatedAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
}