import type { Editor } from "@tiptap/react";

type Found = { from: number; to: number };

function findAllTextRanges(editor: Editor, query: string): Found[] {
  const ranges: Found[] = [];
  if (!query) return ranges;

  const { doc } = editor.state;

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    let idx = 0;

    while (true) {
      const foundAt = text.indexOf(query, idx);
      if (foundAt === -1) break;

      const from = pos + foundAt;
      const to = from + query.length;
      ranges.push({ from, to });
      idx = foundAt + Math.max(1, query.length);
    }
  });

  return ranges;
}

export function findNext(editor: Editor, query: string): Found | null {
  const ranges = findAllTextRanges(editor, query);
  if (!ranges.length) return null;

  const selFrom = editor.state.selection.from;
  const next = ranges.find((r) => r.from > selFrom) ?? ranges[0];

  editor.commands.setTextSelection({ from: next.from, to: next.to });
  editor.commands.focus();
  return next;
}

export function replaceCurrent(editor: Editor, replacement: string) {
  const { from, to } = editor.state.selection;
  if (from === to) return;
  editor.commands.insertContentAt({ from, to }, replacement);
}

export function replaceAll(editor: Editor, query: string, replacement: string) {
  const ranges = findAllTextRanges(editor, query);
  if (!ranges.length) return;

  for (let i = ranges.length - 1; i >= 0; i--) {
    const r = ranges[i];
    editor.commands.insertContentAt({ from: r.from, to: r.to }, replacement);
  }
}
