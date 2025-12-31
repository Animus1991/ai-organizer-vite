import React, { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";

import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { SegmentMark } from "./extensions/SegmentMark";
import { CommentMark } from "./extensions/CommentMark";

import "./editor.css";

type Props = {
  valueHtml: string;
  onChange: (payload: { html: string; text: string }) => void;
  placeholder?: string;
};

export function RichTextEditor({ valueHtml, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      SegmentMark,
      CommentMark,
      CharacterCount,
      Placeholder.configure({
        placeholder: placeholder ?? "Start typing…",
      }),
    ],
    content: valueHtml || "<p></p>",
    editorProps: { attributes: { spellcheck: "false" } },
    onUpdate: ({ editor }) => {
      onChange({ html: editor.getHTML(), text: editor.getText() });
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (valueHtml !== current) {
      editor.commands.setContent(valueHtml || "<p></p>", false);
    }
  }, [valueHtml, editor]);

  if (!editor) return null;

  return (
    <div className="rte-root">
      <Toolbar editor={editor} />
      <div className="rte-editor">
        <EditorContent editor={editor} />
      </div>
      <StatusBar editor={editor} />
    </div>
  );
}
