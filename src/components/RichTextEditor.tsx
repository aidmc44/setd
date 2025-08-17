// src/components/RichTextEditor.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";

type Props = {
  value: any;
  onChange: (json: any) => void;
  className?: string;
  editable?: boolean;
};

const palette = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#0ea5e9",
  "#6366f1",
  "#a855f7",
  "#f43f5e",
  "#94a3b8",
];

export default function RichTextEditor({
  value,
  onChange,
  className,
  editable = true,
}: Props) {
  const [showColors, setShowColors] = useState(false);
  const [, force] = useState(0);

  const editor = useEditor({
    extensions: [StarterKit, Underline, TextStyle, Color, FontFamily],
    content: value || { type: "doc", content: [] },
    editorProps: {
      attributes: {
        class:
          "tiptap prose max-w-none focus:outline-none text-zinc-900 dark:text-zinc-100 dark:prose-invert",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    immediatelyRender: false,
    editable,
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    const rerender = () => force((x) => x + 1);
    editor.on("selectionUpdate", rerender);
    editor.on("transaction", rerender);
    return () => {
      editor.off("selectionUpdate", rerender);
      editor.off("transaction", rerender);
    };
  }, [editor]);

  const isBold = editor?.isActive("bold") ?? false;
  const isItalic = editor?.isActive("italic") ?? false;
  const colorAttr = editor?.getAttributes("textStyle")?.color as
    | string
    | undefined;
  const fontFamily = editor?.getAttributes("textStyle")?.fontFamily as
    | string
    | undefined;

  const btn =
    "rounded border px-2 py-1 text-sm transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700";
  const btnActive =
    "rounded border px-2 py-1 text-sm bg-zinc-200 dark:bg-zinc-600";

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
    [editor, isBold, isItalic, fontFamily, colorAttr],
  );

  if (!editor) {
    return (
      <div
        className={
          className ??
          "rounded border bg-white p-2 dark:border-zinc-700 dark:bg-zinc-900/40"
        }
      >
        <div className="border-b p-2 text-sm text-zinc-500 dark:text-zinc-400">
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
        "rounded border bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-100 transition-colors"
      }
    >
      <div className="relative flex flex-wrap items-center gap-2 border-b bg-zinc-50 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-900/30">
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
          <div className="absolute left-2 top-10 z-10 flex w-64 flex-wrap gap-2 rounded border bg-white p-2 shadow dark:border-zinc-700 dark:bg-zinc-800">
            {palette.map((c) => (
              <button
                key={c}
                onClick={() => {
                  editor.chain().focus().setColor(c).run();
                  setShowColors(false);
                }}
                className="h-6 w-6 rounded border"
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