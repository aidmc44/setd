// src/components/ExportProjectButton.tsx
"use client";

import { api } from "../trpc/react";

function jsonToPlainText(value: any): string {
  // Very simple flattening of TipTap JSON into plaintext
  try {
    const walk = (n: any): string => {
      if (!n) return "";
      if (typeof n === "string") return n;
      if (Array.isArray(n)) return n.map(walk).join(" ");
      if (n.type === "text") return n.text || "";
      const parts = [];
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

export default function ExportProjectButton({
  projectId,
  filename = "project.csv",
}: {
  projectId: string;
  filename?: string;
}) {
  const { data: tasks } = api.tasks.listByProject.useQuery({ projectId });

  const handleExport = () => {
    const rows = [["Task Title", "Task Description", "Status"]];
    for (const t of tasks ?? []) {
      const title = t.title || "";
      const desc = jsonToPlainText(t.notesJson);
      const status =
        t.status === "IN_PROGRESS"
          ? "In progress"
          : t.status === "COMPLETED"
          ? "Done"
          : "Todo";
      rows.push([title, desc, status]);
    }
    const csv = rows.map((r) => r.map(csvSafe).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      className="rounded border px-2 py-1 text-sm hover:bg-zinc-800"
      title="Export tasks as CSV"
    >
      Export CSV
    </button>
  );
}