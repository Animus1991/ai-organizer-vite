import React from "react";
import type { Editor } from "@tiptap/react";

export function StatusBar({ editor }: { editor: Editor }) {
  const chars = editor.storage.characterCount?.characters?.() ?? 0;
  const words = editor.storage.characterCount?.words?.() ?? 0;

  return (
    <div className="rte-status">
      <div>Words: {words}</div>
      <div>Characters: {chars}</div>
    </div>
  );
}
