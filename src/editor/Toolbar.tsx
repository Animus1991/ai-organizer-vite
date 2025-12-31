import React, { useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import { findNext, replaceAll, replaceCurrent } from "./utils/findReplace";
import { normalizePlainText, plainTextToHtml } from "./utils/text";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export function Toolbar({
  editor,
  onCleanup,
}: {
  editor: Editor;
  onCleanup?: () => void;
}) {
  const [findOpen, setFindOpen] = useState(false);
  const [q, setQ] = useState("");
  const [r, setR] = useState("");

  const canMarkSelection = useMemo(() => {
    const { from, to } = editor.state.selection;
    return from !== to;
  }, [editor.state.selection]);

  const applySegmentHighlight = () => {
    if (!canMarkSelection) return;
    const segmentId = uid("seg");
    editor.chain().focus().setMark("segmentMark", { segmentId }).run();
  };

  const applyComment = () => {
    if (!canMarkSelection) return;
    const commentId = uid("cmt");
    editor.chain().focus().setMark("commentMark", { commentId }).run();
  };

  const clearMarksInSelection = () => {
    editor.chain().focus().unsetMark("segmentMark").unsetMark("commentMark").run();
  };

  const doCleanup = () => {
    // normalize using plain text to remove weird linebreaks/spaces, then re-render as paragraphs
    const cleaned = normalizePlainText(editor.getText());
    editor.commands.setContent(plainTextToHtml(cleaned), false);
    editor.commands.focus();
    onCleanup?.();
  };

  return (
    <>
      <div className="rte-toolbar">
        <button className="rte-btn" aria-pressed={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} type="button">
          Bold
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} type="button">
          Italic
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} type="button">
          Underline
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} type="button">
          Strike
        </button>

        <span style={{ opacity: 0.5 }}>|</span>

        <button className="rte-btn" aria-pressed={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} type="button">
          H1
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} type="button">
          H2
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} type="button">
          H3
        </button>

        <span style={{ opacity: 0.5 }}>|</span>

        <button className="rte-btn" aria-pressed={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} type="button">
          • List
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} type="button">
          1. List
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} type="button">
          Quote
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} type="button">
          Code block
        </button>

        <span style={{ opacity: 0.5 }}>|</span>

        <button className="rte-btn" onClick={() => editor.chain().focus().undo().run()} type="button">
          Undo
        </button>
        <button className="rte-btn" onClick={() => editor.chain().focus().redo().run()} type="button">
          Redo
        </button>

        <span style={{ opacity: 0.5 }}>|</span>

        <button className="rte-btn" onClick={() => setFindOpen(true)} type="button">
          Find/Replace
        </button>

        <span style={{ opacity: 0.5 }}>|</span>

        <button className="rte-btn" disabled={!canMarkSelection} onClick={applySegmentHighlight} type="button">
          Segment mark
        </button>
        <button className="rte-btn" disabled={!canMarkSelection} onClick={applyComment} type="button">
          Comment mark
        </button>
        <button className="rte-btn" disabled={!canMarkSelection} onClick={clearMarksInSelection} type="button">
          Clear marks
        </button>

        <span style={{ opacity: 0.5 }}>|</span>

        <button className="rte-btn" onClick={doCleanup} type="button" title="Normalize whitespace / paragraphs">
          Cleanup
        </button>
      </div>

      {findOpen && (
        <div className="rte-modal-backdrop" onMouseDown={() => setFindOpen(false)}>
          <div className="rte-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 600 }}>Find / Replace</div>
              <button className="rte-btn" type="button" onClick={() => setFindOpen(false)}>
                Close
              </button>
            </div>

            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
              <input className="rte-field" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find…" />
              <input className="rte-field" value={r} onChange={(e) => setR(e.target.value)} placeholder="Replace with…" />

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="rte-btn" type="button" onClick={() => findNext(editor, q)}>
                  Find next
                </button>
                <button className="rte-btn" type="button" onClick={() => replaceCurrent(editor, r)}>
                  Replace current
                </button>
                <button className="rte-btn" type="button" onClick={() => replaceAll(editor, q, r)}>
                  Replace all
                </button>
              </div>

              <div style={{ opacity: 0.75, fontSize: 12 }}>
                Tip: “Replace current” δουλεύει όταν έχεις ήδη επιλεγμένο match (π.χ. μετά από “Find next”).
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
