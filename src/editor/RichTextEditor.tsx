// src/editor/RichTextEditor.tsx
import React, { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import CharacterCount from "@tiptap/extension-character-count";
import Placeholder from "@tiptap/extension-placeholder";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";

import { Toolbar } from "./Toolbar";
import { StatusBar } from "./StatusBar";
import { SegmentMark } from "./extensions/SegmentMark";
import { CommentMark } from "./extensions/CommentMark";
import { FontSize } from "./extensions/FontSize";

import "./editor.css";

type Props = {
  valueHtml: string;
  onChange: (payload: { html: string; text: string }) => void;
  placeholder?: string;
  onSaveLocal?: () => void;
  onLoadLocal?: () => void;
};

export function RichTextEditor({
  valueHtml,
  onChange,
  placeholder,
  onSaveLocal,
  onLoadLocal,
}: Props) {
  const extensions = useMemo(
    () => [
      // Αν το StarterKit στο δικό σου setup "κουβαλάει" underline,
      // αυτό το configure το απενεργοποιεί ώστε να μην διπλο-δηλώνεται.
      StarterKit.configure({ underline: false } as any),
      Underline,
      Highlight,
      TextStyle,
      Color,
      FontFamily.configure({
        types: ["textStyle"],
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Subscript,
      Superscript,
      FontSize,
      SegmentMark,
      CommentMark,
      CharacterCount,
      Placeholder.configure({
        placeholder: placeholder ?? "Start typing…",
      }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    extensions,
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

  const words = editor.storage.characterCount?.words?.() ?? 0;
  const chars = editor.storage.characterCount?.characters?.() ?? 0;

  return (
    <div className="rte-root">
      <Toolbar editor={editor} />
      <div className="rte-editor">
        <EditorContent editor={editor} />
      </div>
      <StatusBar
        words={words}
        chars={chars}
        onSaveLocal={onSaveLocal}
        onLoadLocal={onLoadLocal}
      />
    </div>
  );
}
