// src/components/RichTextEditor.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Strike from "@tiptap/extension-strike";

type Props = {
  value: any;
  onChange: (json: any) => void;
  className?: string;
  editable?: boolean;
};

const palette = [
  "#ef4444", // red-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#0ea5e9", // sky-500
  "#6366f1", // indigo-500
  "#a855f7", // purple-500
  "#f43f5e", // rose-500
  "#94a3b8", // slate-400
];

export default function RichTextEditor({
  value,
  onChange,
  className,
  editable = true,
}: Props) {
  const [forceRerender, setForceRerender] = useState(0);
  const [showColors, setShowColors] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, Color, FontFamily, Strike],
    content: value || { type: "doc", content: [] },
    editorProps: {
      attributes: {
        class:
          "tiptap prose max-w-none focus:outline-none text-zinc-100 dark:prose-invert",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    immediatelyRender: false,
    editable,
  });

  // Keep editable in sync
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  // Controlled: set editor content when external value changes
  useEffect(() => {
    if (!editor) return;
    const current = editor.getJSON();
    const incoming = value || { type: "doc", content: [] };
    // Only set when actually different to avoid stealing focus
    if (JSON.stringify(current) !== JSON.stringify(incoming)) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, value]);

  // Keep toolbar active states live
  useEffect(() => {
    if (!editor) return;
    const rerender = () => setForceRerender((x) => x + 1);
    editor.on("selectionUpdate", rerender);
    editor.on("transaction", rerender);
    return () => {
      editor.off("selectionUpdate", rerender);
      editor.off("transaction", rerender);
    };
  }, [editor]);

  const isBold = editor?.isActive("bold") ?? false;
  const isItalic = editor?.isActive("italic") ?? false;
  const isStrike = editor?.isActive("strike") ?? false;
  const colorAttr = editor?.getAttributes("textStyle")?.color as
    | string
    | undefined;
  const fontFamily = editor?.getAttributes("textStyle")?.fontFamily as
    | string
    | undefined;

  const btn =
    "rounded border border-zinc-700 px-2 py-1 text-sm transition-colors hover:bg-zinc-800";
  const btnActive =
    "rounded border border-zinc-700 px-2 py-1 text-sm bg-zinc-700";

  const buttons = useMemo(
    () => [
      {
        onClick: () => editor?.chain().focus().toggleBold().run(),
        label: "Bold",
        active: isBold,
      },
      {
        onClick: () => editor?.chain().focus().toggleItalic().run(),
        label: "Italic",
        active: isItalic,
      },
      {
        onClick: () => editor?.chain().focus().toggleStrike().run(),
        label: "Strike",
        active: isStrike,
      },
      {
        onClick: () => editor?.chain().focus().setFontFamily("Inter").run(),
        label: "Inter",
        active: fontFamily === "Inter",
      },
      {
        onClick: () => editor?.chain().focus().setFontFamily("monospace").run(),
        label: "Mono",
        active: fontFamily === "monospace",
      },
      {
        onClick: () => setShowColors((s) => !s),
        label: "Color",
        active: Boolean(colorAttr),
      },
      {
        onClick: () => editor?.chain().focus().unsetColor().run(),
        label: "Clear",
        active: false,
      },
    ],
    [editor, isBold, isItalic, isStrike, fontFamily, colorAttr],
  );

  if (!editor) {
    return (
      <div
        className={
          className ??
          "rounded border border-zinc-700 bg-zinc-900/40 p-2 text-zinc-100"
        }
      >
        <div className="border-b border-zinc-700 p-2 text-sm text-zinc-400">
          Loading editor…
        </div>
        <div className="min-h-[4rem] p-2" />
      </div>
    );
  }

  return (
    <div
      className={
        className ??
        "rounded border border-zinc-700 bg-zinc-900/40 text-zinc-100"
      }
    >
      <div className="relative flex flex-wrap items-center gap-2 border-b border-zinc-700 p-2 text-sm">
        {buttons.map((b, i) => (
          <button
            key={i}
            onClick={b.onClick}
            className={b.active ? btnActive : btn}
            title={b.label}
            aria-pressed={b.active}
            disabled={!editable}
          >
            {b.label}
          </button>
        ))}

        {showColors && editable && (
          <div className="absolute left-2 top-10 z-10 flex w-64 flex-wrap gap-2 rounded border border-zinc-700 bg-zinc-900 p-2 shadow">
            {palette.map((c) => (
              <button
                key={c}
                onClick={() => {
                  editor.chain().focus().setColor(c).run();
                  setShowColors(false);
                }}
                className="h-6 w-6 rounded border border-zinc-700"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-2">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}