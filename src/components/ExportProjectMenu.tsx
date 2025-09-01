// src/components/ExportProjectMenu.tsx
"use client";

import React, { useMemo, useState } from "react";
import { api } from "../trpc/react";
import type { Project } from "@prisma/client";

function jsonToPlainText(value: any): string {
  try {
    const walk = (n: any): string => {
      if (!n) return "";
      if (typeof n === "string") return n;
      if (Array.isArray(n)) return n.map(walk).join(" ");
      if (n.type === "text") return n.text || "";
      const parts: string[] = [];
      if (n.content) parts.push(walk(n.content));
      return parts.join(" ");
    };
    return walk(value).replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

function csvSafe(s: string): string {
  if (s == null) return "";
  const needQuote = /[",\n]/.test(s);
  const escaped = String(s).replace(/"/g, '""');
  return needQuote ? `"${escaped}"` : escaped;
}

function statusToHuman(s: string): string {
  return s === "IN_PROGRESS" ? "In progress" : s === "COMPLETED" ? "Done" : "Todo";
}

export default function ExportProjectMenu({ project }: { project: Project }) {
    const projectId = project?.id;
    const { data: tasks } = api.tasks.listByProject.useQuery(
    { projectId: projectId as string },
    {
        enabled: Boolean(projectId),
        refetchInterval: 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: true,
    },
    );

  const [open, setOpen] = useState(false);

  const tasksSafe = tasks ?? [];

  const filenameBase = useMemo(
    () => project.title.replace(/[^\w\-]+/g, "_").slice(0, 80) || "project",
    [project.title],
  );

  const doCSV = () => {
    const rows = [["Task Title", "Task Description", "Status"]];
    for (const t of tasksSafe) {
      const title = t.title || "";
      const desc = jsonToPlainText(t.notesJson);
      const status = statusToHuman(t.status);
      rows.push([title, desc, status]);
    }
    const csv = rows.map((r) => r.map(csvSafe).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filenameBase}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
    setOpen(false);
  };

  const doTXT = () => {
    let txt = `Project: ${project.title}\n`;
    if (project.description) txt += `Description: ${project.description}\n`;
    txt += `\nTasks:\n`;
    for (const t of tasksSafe) {
      const status = statusToHuman(t.status);
      const desc = jsonToPlainText(t.notesJson);
      txt += `- ${t.title} [${status}]\n`;
      if (desc) txt += `  ${desc}\n`;
    }
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${filenameBase}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
    setOpen(false);
  };

  const doCopyForLLM = async () => {
    const focus = tasksSafe.filter(
      (t) => t.status === "NOT_STARTED" || t.status === "IN_PROGRESS",
    );
    let out = `Context: Project "${project.title}"\n`;
    if (project.description) out += `Description: ${project.description}\n`;
    out += `\nCurrent tasks (actionable):\n`;
    for (const t of focus) {
      const status = t.status === "IN_PROGRESS" ? "IN_PROGRESS" : "TODO";
      const desc = jsonToPlainText(t.notesJson);
      out += `- title: ${t.title}\n  status: ${status}\n`;
      if (desc) out += `  notes: ${desc}\n`;
    }
    try {
      await navigator.clipboard.writeText(out);
    } catch {
      alert("Copied content:\n\n" + out);
    }
    setOpen(false);
  };

  if (!projectId) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((s) => !s)}
        className="rounded border px-2 py-1 text-sm hover:bg-zinc-800"
        title="Export project"
      >
        Export
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-48 rounded border bg-zinc-900 p-1 text-sm shadow">
          <button
            onClick={doCSV}
            className="block w-full rounded px-2 py-1 text-left hover:bg-zinc-800"
            title="Download CSV"
          >
            Download CSV
          </button>
          <button
            onClick={doTXT}
            className="block w-full rounded px-2 py-1 text-left hover:bg-zinc-800"
            title="Download TXT"
          >
            Download TXT
          </button>
          <button
            onClick={doCopyForLLM}
            className="block w-full rounded px-2 py-1 text-left hover:bg-zinc-800"
            title="Copy for LLM"
          >
            Copy for LLM
          </button>
        </div>
      )}
    </div>
  );
}