/**
 * ChunkEditModal Component
 * 
 * Modal for editing chunk content, title, position, and folder assignment.
 * 
 * @module components/workspace/ChunkEditModal
 */

import React, { useRef } from "react";
import { SegmentDTO } from "../../lib/api";
import { RichTextEditor } from "../../editor/RichTextEditor";
import { computeSelectionFromPre, splitDocByRange } from "../../lib/documentWorkspace/selection";
import { FolderDTO } from "../../lib/segmentFolders";

export interface ChunkEditModalProps {
  // Modal state
  open: boolean;
  segment: SegmentDTO | null;
  onClose: () => void;
  
  // Document content
  docText: string;
  
  // Chunk editing state
  title: string;
  onTitleChange: (title: string) => void;
  html: string;
  content: string;
  onHtmlChange: (html: string) => void;
  onContentChange: (content: string) => void;
  start: number;
  end: number;
  onStartChange: (start: number) => void;
  onEndChange: (end: number) => void;
  
  // Folder
  folderId: string | null;
  onFolderChange: (folderId: string | null) => void;
  folders: FolderDTO[];
  
  // Status
  dirty: boolean;
  status: string;
  onStatusChange: (status: string) => void;
  
  // Save functionality
  onSave: () => Promise<void>;
  
  // Fullscreen
  fullscreen: boolean;
  onFullscreenChange: (fullscreen: boolean) => void;
  
  // Chunk list
  showChunkList: boolean;
  onShowChunkListChange: (show: boolean) => void;
  showAllChunks: boolean;
  onShowAllChunksChange: (show: boolean) => void;
  segments: SegmentDTO[];
  onChunkSelect: (seg: SegmentDTO) => void;
  
  // Selection sync
  syncFromDoc: boolean;
  onSyncFromDocChange: (sync: boolean) => void;
}

/**
 * ChunkEditModal - Modal for editing chunks
 */
export default function ChunkEditModal({
  open,
  segment,
  onClose,
  docText,
  title,
  onTitleChange,
  html,
  content,
  onHtmlChange,
  onContentChange,
  start,
  end,
  onStartChange,
  onEndChange,
  folderId,
  onFolderChange,
  folders,
  dirty,
  status,
  onStatusChange,
  onSave,
  fullscreen,
  onFullscreenChange,
  showChunkList,
  onShowChunkListChange,
  showAllChunks,
  onShowAllChunksChange,
  segments,
  onChunkSelect,
  syncFromDoc,
  onSyncFromDocChange,
}: ChunkEditModalProps) {
  
  const preRef = useRef<HTMLPreElement | null>(null);

  const handleCaptureSelection = () => {
    const pre = preRef.current;
    if (!pre) return;

    const info = computeSelectionFromPre(pre, docText);
    if (!info) {
      onStatusChange("No selection.");
      return;
    }

    onStartChange(info.start);
    onEndChange(info.end);

    if (syncFromDoc) {
      onContentChange(info.text);
      onHtmlChange(plainTextToHtml(info.text));
    }

    onStatusChange(`Selected ${info.end - info.start} chars from document.`);
  };

  const handleSave = async () => {
    await onSave();
  };

  if (!open || !segment) return null;

  const parts = splitDocByRange(docText, start, end);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        padding: "20px",
        zIndex: 60,
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          flex: 1,
          background: "linear-gradient(135deg, rgba(11, 14, 20, 0.98) 0%, rgba(8, 10, 16, 0.98) 100%)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "20px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          maxWidth: fullscreen ? "100%" : "1600px",
          margin: fullscreen ? "0" : "0 auto",
          width: fullscreen ? "100%" : "auto",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flex: "0 0 auto",
            background: "linear-gradient(135deg, rgba(30, 30, 40, 0.5) 0%, rgba(20, 20, 30, 0.3) 100%)",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              fontWeight: 700,
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
              color: "#c7d2fe",
            }}
          >
            #{(segment as any).orderIndex + 1}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "var(--font-size-lg)",
                lineHeight: "var(--line-height-snug)",
                letterSpacing: "var(--letter-spacing-tight)",
                fontWeight: 700,
                color: "#eaeaea",
                marginBottom: "4px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Edit Chunk: {segment.title}
            </div>
            {status && (
              <div
                style={{
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-normal)",
                  color: "rgba(255, 255, 255, 0.6)",
                  padding: "4px 10px",
                  background: "rgba(99, 102, 241, 0.1)",
                  borderRadius: "6px",
                  display: "inline-block",
                  border: "1px solid rgba(99, 102, 241, 0.2)",
                }}
              >
                {status}
              </div>
            )}
          </div>
          <button
            onClick={() => onFullscreenChange(!fullscreen)}
            style={{
              padding: "10px 16px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "10px",
              color: "#eaeaea",
              fontWeight: 500,
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
            }}
          >
            {fullscreen ? "🗗 Exit Fullscreen" : "🗖 Fullscreen"}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "10px 18px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "10px",
              color: "#eaeaea",
              fontWeight: 600,
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
              e.currentTarget.style.color = "#fca5a5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
              e.currentTarget.style.color = "#eaeaea";
            }}
          >
            <svg style={{ width: "14px", height: "14px", display: "inline", marginRight: "6px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </button>
        </div>

        {/* Editor Toolbar */}
        <div
          style={{
            flex: "0 0 auto",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(135deg, rgba(20, 20, 30, 0.8) 0%, rgba(15, 15, 25, 0.8) 100%)",
            padding: "20px 24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-normal)",
                  fontWeight: 600,
                  color: "rgba(255, 255, 255, 0.7)",
                  marginBottom: "8px",
                }}
              >
                Title
              </label>
              <input
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(0, 0, 0, 0.3)",
                  color: "#eaeaea",
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-normal)",
                  transition: "all 0.2s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.5)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-normal)",
                  fontWeight: 600,
                  color: "rgba(255, 255, 255, 0.7)",
                  marginBottom: "8px",
                }}
              >
                Content
              </label>
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                  overflow: "hidden",
                  background: "rgba(0, 0, 0, 0.2)",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2) inset",
                }}
              >
                <RichTextEditor
                  valueHtml={html}
                  onChange={({ html, text }) => {
                    onHtmlChange(html);
                    onContentChange(text);
                  }}
                  placeholder="Edit chunk content..."
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", paddingTop: "8px" }}>
              <button
                onClick={onClose}
                style={{
                  padding: "12px 24px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  color: "#eaeaea",
                  fontWeight: 600,
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-normal)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: "12px 24px",
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  border: "none",
                  borderRadius: "12px",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-normal)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(99, 102, 241, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.3)";
                }}
              >
                <svg style={{ width: "16px", height: "16px", display: "inline", marginRight: "6px", verticalAlign: "middle" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
          {/* Left: Chunk Details + Optional List */}
          <div
            style={{
              flex: showChunkList ? "1 1 16.5%" : "1 1 16.5%",
              minWidth: 0,
              minHeight: 0,
              borderRight: "1px solid rgba(255,255,255,0.10)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Chunk Details */}
            <div
              style={{
                padding: "16px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                flex: "0 0 auto",
                background: "linear-gradient(135deg, rgba(20, 20, 30, 0.5) 0%, rgba(15, 15, 25, 0.3) 100%)",
              }}
            >
              <h4
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-normal)",
                  fontWeight: 700,
                  color: "#eaeaea",
                }}
              >
                Chunk Details
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <span
                    style={{
                      padding: "6px 12px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "8px",
                      fontSize: "var(--font-size-base)",
                      lineHeight: "var(--line-height-normal)",
                      fontWeight: 600,
                      color: "rgba(255, 255, 255, 0.8)",
                    }}
                  >
                    Index: {(segment as any).orderIndex + 1}
                  </span>
                  <span
                    style={{
                      padding: "6px 12px",
                      background: (segment as any).isManual ? "rgba(59, 130, 246, 0.2)" : "rgba(107, 114, 128, 0.2)",
                      border: (segment as any).isManual ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(107, 114, 128, 0.3)",
                      borderRadius: "8px",
                      fontSize: "var(--font-size-base)",
                      lineHeight: "var(--line-height-normal)",
                      fontWeight: 600,
                      color: (segment as any).isManual ? "#93c5fd" : "#9ca3af",
                    }}
                  >
                    {(segment as any).isManual ? "Manual" : "Auto"}
                  </span>
                  <span
                    style={{
                      padding: "6px 12px",
                      background: (segment as any).mode === "qa" ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.2)",
                      border: (segment as any).mode === "qa" ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(16, 185, 129, 0.3)",
                      borderRadius: "8px",
                      fontSize: "var(--font-size-base)",
                      lineHeight: "var(--line-height-normal)",
                      fontWeight: 600,
                      color: (segment as any).mode === "qa" ? "#93c5fd" : "#6ee7b7",
                    }}
                  >
                    Mode: {(segment as any).mode}
                  </span>
                </div>
                <div
                  style={{
                    padding: "10px 12px",
                    background: "rgba(0, 0, 0, 0.2)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: "8px",
                    fontSize: "var(--font-size-base)",
                    lineHeight: "var(--line-height-normal)",
                    color: "rgba(255, 255, 255, 0.7)",
                  }}
                >
                  <div style={{ marginBottom: "4px" }}>
                    <strong style={{ color: "#eaeaea" }}>Position:</strong> {start} - {end}
                  </div>
                  <div>
                    <strong style={{ color: "#eaeaea" }}>Length:</strong> {end - start} characters
                  </div>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "var(--font-size-xs)",
                      lineHeight: "var(--line-height-normal)",
                      fontWeight: 600,
                      color: "rgba(255, 255, 255, 0.7)",
                      marginBottom: "6px",
                    }}
                  >
                    Folder:
                  </label>
                  <select
                    value={folderId ?? "none"}
                    onChange={(e) => onFolderChange(e.target.value === "none" ? null : e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0, 0, 0, 0.3)",
                      color: "#eaeaea",
                      fontSize: "var(--font-size-base)",
                      lineHeight: "var(--line-height-normal)",
                    }}
                  >
                    <option value="none">No folder</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
                {dirty && (
                  <div
                    style={{
                      fontSize: "var(--font-size-base)",
                      lineHeight: "var(--line-height-normal)",
                      color: "#fcd34d",
                      padding: "10px 12px",
                      background: "rgba(251, 191, 36, 0.15)",
                      border: "1px solid rgba(251, 191, 36, 0.3)",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Unsaved changes
                  </div>
                )}
              </div>
            </div>

            {/* Chunk List (toggleable) */}
            {showChunkList && (
              <>
                <div style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                  <span style={{ fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", fontWeight: 600 }}>All Chunks</span>
                  <button
                    onClick={() => onShowChunkListChange(false)}
                    style={{ padding: "2px 6px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, fontSize: 10, cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ padding: 8, overflow: "auto", flex: "1 1 auto", minHeight: 0 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    {(showAllChunks ? segments : segments.slice(0, 10)).map((s: any) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          if (s.id !== segment?.id) {
                            onChunkSelect(s);
                          }
                        }}
                        style={{
                          padding: 6,
                          borderRadius: 6,
                          border: s.id === segment?.id ? "1px solid #72ffbf" : "1px solid rgba(255,255,255,0.10)",
                          background: s.id === segment?.id ? "rgba(114,255,191,0.1)" : "rgba(255,255,255,0.03)",
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>
                          {(s.orderIndex ?? 0) + 1}. {s.title}
                        </div>
                        <div style={{ opacity: 0.7 }}>
                          {s.isManual ? "Manual" : "Auto"} • {s.mode} • {s.end - s.start} chars
                        </div>
                      </div>
                    ))}
                    {segments.length > 10 && !showAllChunks && (
                      <div 
                        style={{ fontSize: 10, opacity: 0.6, textAlign: "center", paddingTop: 4, cursor: "pointer", textDecoration: "underline" }}
                        onClick={() => onShowAllChunksChange(true)}
                      >
                        ... and {segments.length - 10} more
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Show chunk list button when hidden */}
            {!showChunkList && (
              <div style={{ padding: 8, flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button
                  onClick={() => onShowChunkListChange(true)}
                  style={{ padding: "8px 12px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", cursor: "pointer" }}
                >
                  📋 Show Chunk List
                </button>
              </div>
            )}
          </div>

          {/* Right: Document Text Selection */}
          <div style={{ flex: "1 1 83.5%", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 600, fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", flex: "0 0 auto" }}>
              Select text below (drag) to update selection
            </div>
            <div style={{ padding: 12, overflow: "auto", flex: "1 1 auto", minHeight: 0, maxHeight: "40%" }}>
              <pre
                ref={preRef}
                onMouseUp={handleCaptureSelection}
                onKeyUp={handleCaptureSelection}
                style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: "var(--line-height-relaxed)", userSelect: "text", cursor: "text", fontSize: "var(--font-size-xs)" }}
              >
                {parts.before}
                {parts.mid ? (
                  <span
                    style={{
                      background: "rgba(114,255,191,0.18)",
                      outline: "1px solid rgba(114,255,191,0.45)",
                      borderRadius: 6,
                      padding: "1px 2px",
                    }}
                  >
                    {parts.mid}
                  </span>
                ) : null}
                {parts.after}
              </pre>
            </div>

            {/* Chunk List - Right side when shown */}
            {showChunkList && (
              <>
                <div style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                  <span style={{ fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", fontWeight: 600 }}>All Chunks</span>
                  <button
                    onClick={() => onShowChunkListChange(false)}
                    style={{ padding: "2px 6px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, fontSize: 10, cursor: "pointer" }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ padding: 8, overflow: "auto", flex: "1 1 auto", minHeight: 0, maxHeight: "30%" }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    {(showAllChunks ? segments : segments.slice(0, 10)).map((s: any) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          if (s.id !== segment?.id) {
                            onChunkSelect(s);
                          }
                        }}
                        style={{
                          padding: 6,
                          borderRadius: 6,
                          border: s.id === segment?.id ? "1px solid #72ffbf" : "1px solid rgba(255,255,255,0.10)",
                          background: s.id === segment?.id ? "rgba(114,255,191,0.1)" : "rgba(255,255,255,0.03)",
                          cursor: "pointer",
                          fontSize: 11,
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>
                          {(s.orderIndex ?? 0) + 1}. {s.title}
                        </div>
                        <div style={{ opacity: 0.7 }}>
                          {s.isManual ? "Manual" : "Auto"} • {s.mode} • {s.end - s.start} chars
                        </div>
                      </div>
                    ))}
                    {segments.length > 10 && !showAllChunks && (
                      <div 
                        style={{ fontSize: 10, opacity: 0.6, textAlign: "center", paddingTop: 4, cursor: "pointer", textDecoration: "underline" }}
                        onClick={() => onShowAllChunksChange(true)}
                      >
                        ... and {segments.length - 10} more
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Show chunk list button when hidden */}
            {!showChunkList && (
              <div style={{ padding: 8, flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button
                  onClick={() => onShowChunkListChange(true)}
                  style={{ padding: "8px 12px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", cursor: "pointer" }}
                >
                  📋 Show Chunk List
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { plainTextToHtml } from "../../editor/utils/text";

