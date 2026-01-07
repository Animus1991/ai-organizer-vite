// C:\Users\anast\PycharmProjects\AI_ORGANIZER_VITE\src\editor\Toolbar.tsx
import { useEffect, useMemo, useState } from "react";
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

  const [selTick, setSelTick] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const bump = () => setSelTick((t) => t + 1);
    editor.on("selectionUpdate", bump);
    editor.on("transaction", bump);
    return () => {
      editor.off("selectionUpdate", bump);
      editor.off("transaction", bump);
    };
  }, [editor]);

  const hasSelection = useMemo(() => {
    const { from, to } = editor.state.selection;
    return from !== to;
  }, [editor.state.selection, selTick]);

  const applySegmentHighlight = () => {
    if (!hasSelection) return;
    const segmentId = uid("seg");
    editor.chain().focus().setMark("segmentMark", { segmentId }).run();
  };

  const applyComment = () => {
    if (!hasSelection) return;
    const commentId = uid("cmt");
    editor.chain().focus().setMark("commentMark", { commentId }).run();
  };

  const clearMarksInSelection = () => {
    editor.chain().focus().unsetMark("segmentMark").unsetMark("commentMark").run();
  };

  const doCleanup = () => {
    // normalize using plain text to remove weird linebreaks/spaces, then re-render as paragraphs
    const cleaned = normalizePlainText(editor.getText());
    editor.commands.setContent(plainTextToHtml(cleaned), { emitUpdate: false });
    editor.commands.focus();
    onCleanup?.();
  };

  const clearFormatting = () => {
    editor.chain().focus().clearNodes().unsetAllMarks().run();
  };

  const handleCopy = async () => {
    if (!hasSelection) return;
    try {
      const text = editor.state.doc.textBetween(
        editor.state.selection.from,
        editor.state.selection.to
      );
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // Fallback
      document.execCommand("copy");
    }
  };

  const handleCut = async () => {
    if (!hasSelection) return;
    try {
      const text = editor.state.doc.textBetween(
        editor.state.selection.from,
        editor.state.selection.to
      );
      await navigator.clipboard.writeText(text);
      editor.chain().focus().deleteSelection().run();
    } catch (e) {
      // Fallback
      document.execCommand("cut");
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      editor.chain().focus().insertContent(text).run();
    } catch (e) {
      // Fallback - let browser handle it
      editor.chain().focus().run();
    }
  };

  const [textColor, setTextColor] = useState("#000000");
  const [highlightColor, setHighlightColor] = useState("#ffff00");

  return (
    <>
      <div className="rte-toolbar">
        {/* Clipboard Section */}
        <button className="rte-btn" onClick={handlePaste} type="button" title="Paste">
          📋 Paste
        </button>
        <button className="rte-btn" disabled={!hasSelection} onClick={handleCut} type="button" title="Cut">
          ✂️ Cut
        </button>
        <button className="rte-btn" disabled={!hasSelection} onClick={handleCopy} type="button" title="Copy">
          📄 Copy
        </button>

        <span style={{ opacity: 0.5 }}>|</span>

        {/* Font Section */}
        <select
          className="rte-btn"
          onChange={(e) => {
            const font = e.target.value;
            if (font === "default") {
              editor.chain().focus().unsetFontFamily().run();
            } else {
              editor.chain().focus().setFontFamily(font).run();
            }
          }}
          style={{ padding: "6px 8px", minWidth: "140px", fontFamily: "inherit" }}
          title="Font Family"
          defaultValue="default"
        >
          <option value="default">Font Family</option>
          <option value="Arial, sans-serif" style={{ fontFamily: "Arial" }}>Arial</option>
          <option value="'Times New Roman', serif" style={{ fontFamily: "Times New Roman" }}>Times New Roman</option>
          <option value="'Courier New', monospace" style={{ fontFamily: "Courier New" }}>Courier New</option>
          <option value="'Roboto', sans-serif" style={{ fontFamily: "Roboto" }}>Roboto</option>
          <option value="'Open Sans', sans-serif" style={{ fontFamily: "Open Sans" }}>Open Sans</option>
          <option value="'Lato', sans-serif" style={{ fontFamily: "Lato" }}>Lato</option>
          <option value="'Montserrat', sans-serif" style={{ fontFamily: "Montserrat" }}>Montserrat</option>
          <option value="'Playfair Display', serif" style={{ fontFamily: "Playfair Display" }}>Playfair Display</option>
          <option value="'Merriweather', serif" style={{ fontFamily: "Merriweather" }}>Merriweather</option>
          <option value="'Source Sans Pro', sans-serif" style={{ fontFamily: "Source Sans Pro" }}>Source Sans Pro</option>
          <option value="'Raleway', sans-serif" style={{ fontFamily: "Raleway" }}>Raleway</option>
          <option value="'Poppins', sans-serif" style={{ fontFamily: "Poppins" }}>Poppins</option>
          <option value="'Inter', sans-serif" style={{ fontFamily: "Inter" }}>Inter</option>
          <option value="'Nunito', sans-serif" style={{ fontFamily: "Nunito" }}>Nunito</option>
          <option value="'Ubuntu', sans-serif" style={{ fontFamily: "Ubuntu" }}>Ubuntu</option>
          <option value="'Oswald', sans-serif" style={{ fontFamily: "Oswald" }}>Oswald</option>
          <option value="'Lora', serif" style={{ fontFamily: "Lora" }}>Lora</option>
          <option value="'Crimson Text', serif" style={{ fontFamily: "Crimson Text" }}>Crimson Text</option>
          <option value="'Libre Baskerville', serif" style={{ fontFamily: "Libre Baskerville" }}>Libre Baskerville</option>
          <option value="'PT Serif', serif" style={{ fontFamily: "PT Serif" }}>PT Serif</option>
          <option value="'Noto Serif', serif" style={{ fontFamily: "Noto Serif" }}>Noto Serif</option>
        </select>

        <select
          className="rte-btn"
          onChange={(e) => {
            const size = e.target.value;
            if (size === "default") {
              editor.chain().focus().unsetFontSize().run();
            } else {
              editor.chain().focus().setFontSize(size).run();
            }
          }}
          style={{ padding: "6px 8px", minWidth: "70px" }}
          title="Font Size"
          defaultValue="12"
        >
          <option value="default">Size</option>
          <option value="8">8</option>
          <option value="9">9</option>
          <option value="10">10</option>
          <option value="11">11</option>
          <option value="12">12</option>
          <option value="14">14</option>
          <option value="16">16</option>
          <option value="18">18</option>
          <option value="20">20</option>
          <option value="24">24</option>
          <option value="28">28</option>
          <option value="32">32</option>
          <option value="36">36</option>
          <option value="48">48</option>
          <option value="72">72</option>
        </select>

        <button className="rte-btn" aria-pressed={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} type="button" title="Bold">
          <b>B</b>
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} type="button" title="Italic">
          <i>I</i>
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()} type="button" title="Underline">
          <u>U</u>
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} type="button" title="Strikethrough">
          <s>S</s>
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()} type="button" title="Subscript">
          x<sub>2</sub>
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()} type="button" title="Superscript">
          x<sup>2</sup>
        </button>

        <input
          type="color"
          value={textColor}
          onChange={(e) => {
            setTextColor(e.target.value);
            editor.chain().focus().setColor(e.target.value).run();
          }}
          style={{ width: "32px", height: "28px", padding: "2px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", cursor: "pointer" }}
          title="Text Color"
        />

        <button
          className="rte-btn"
          aria-pressed={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight({ color: highlightColor }).run()}
          type="button"
          title="Highlight"
          style={{
            backgroundColor: editor.isActive("highlight") ? highlightColor : "transparent",
            color: editor.isActive("highlight") ? "#000" : "inherit",
          }}
        >
          🖍️ Highlight
        </button>

        <input
          type="color"
          value={highlightColor}
          onChange={(e) => {
            setHighlightColor(e.target.value);
            if (editor.isActive("highlight")) {
              editor.chain().focus().toggleHighlight({ color: e.target.value }).run();
            }
          }}
          style={{ width: "32px", height: "28px", padding: "2px", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "6px", cursor: "pointer" }}
          title="Highlight Color"
        />

        <button className="rte-btn" onClick={clearFormatting} type="button" title="Clear All Formatting">
          🧹 Clear
        </button>

        <span style={{ opacity: 0.5 }}>|</span>

        {/* Paragraph Section */}
        <button className="rte-btn" aria-pressed={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} type="button" title="Align Left">
          ⬅ Left
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} type="button" title="Center">
          ⬌ Center
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} type="button" title="Align Right">
          ➡ Right
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} type="button" title="Justify">
          ⬌⬌ Justify
        </button>

        <button className="rte-btn" aria-pressed={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} type="button" title="Bullet List">
          • List
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} type="button" title="Numbered List">
          1. List
        </button>

        <button
          className="rte-btn"
          onClick={() => {
            if (editor.isActive("listItem")) {
              editor.chain().focus().liftListItem("listItem").run();
            } else {
              editor.chain().focus().setTextAlign("left").run();
            }
          }}
          type="button"
          title="Decrease Indent"
        >
          ⬅ Indent
        </button>
        <button
          className="rte-btn"
          onClick={() => {
            if (editor.isActive("listItem")) {
              editor.chain().focus().sinkListItem("listItem").run();
            } else {
              editor.chain().focus().setTextAlign("right").run();
            }
          }}
          type="button"
          title="Increase Indent"
        >
          ➡ Indent
        </button>

        <span style={{ opacity: 0.5 }}>|</span>

        {/* Headings */}
        <button className="rte-btn" aria-pressed={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} type="button" title="Heading 1">
          H1
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} type="button" title="Heading 2">
          H2
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} type="button" title="Heading 3">
          H3
        </button>

        <button className="rte-btn" aria-pressed={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} type="button" title="Blockquote">
          Quote
        </button>
        <button className="rte-btn" aria-pressed={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} type="button" title="Code Block">
          Code
        </button>

        <span style={{ opacity: 0.5 }}>|</span>

        {/* History */}
        <button className="rte-btn" onClick={() => editor.chain().focus().undo().run()} type="button" title="Undo">
          ↶ Undo
        </button>
        <button className="rte-btn" onClick={() => editor.chain().focus().redo().run()} type="button" title="Redo">
          ↷ Redo
        </button>

        <span style={{ opacity: 0.5 }}>|</span>

        {/* Find/Replace */}
        <button className="rte-btn" onClick={() => setFindOpen(true)} type="button" title="Find and Replace">
          🔍 Find/Replace
        </button>

        <span style={{ opacity: 0.5 }}>|</span>

        {/* Custom Marks */}
        <button className="rte-btn" disabled={!hasSelection} onClick={applySegmentHighlight} type="button" title="Segment Mark">
          Segment
        </button>
        <button className="rte-btn" disabled={!hasSelection} onClick={applyComment} type="button" title="Comment Mark">
          Comment
        </button>
        <button className="rte-btn" disabled={!hasSelection} onClick={clearMarksInSelection} type="button" title="Clear Marks">
          Clear marks
        </button>

        <span style={{ opacity: 0.5 }}>|</span>

        {/* Utilities */}
        <button className="rte-btn" onClick={doCleanup} type="button" title="Normalize whitespace / paragraphs">
          🧽 Cleanup
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
