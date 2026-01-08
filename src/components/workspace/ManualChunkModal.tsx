/**
 * ManualChunkModal Component
 * 
 * Modal for creating manual chunks by selecting text from the document.
 * 
 * @module components/workspace/ManualChunkModal
 */

import React, { useRef } from "react";
import { SegmentDTO } from "../../lib/api";
import { SelInfo, computeSelectionFromPre } from "../../lib/documentWorkspace/selection";
import { preview120 } from "../../lib/documentWorkspace/utils";
import { plainTextToHtml } from "../../editor/utils/text";
import { FolderDTO } from "../../lib/segmentFolders";

export interface ManualChunkModalProps {
  // Modal state
  open: boolean;
  onClose: () => void;
  
  // Document content
  docText: string;
  mode: "qa" | "paragraphs";
  
  // Manual chunk state
  title: string;
  onTitleChange: (title: string) => void;
  selection: SelInfo | null;
  onSelectionChange: (selection: SelInfo | null) => void;
  status: string;
  onStatusChange: (status: string) => void;
  
  // Save functionality
  onSave: () => Promise<void>;
  
  // Manual segments list
  manualSegments: SegmentDTO[];
  openSegment: SegmentDTO | null;
  onOpenSegmentChange: (seg: SegmentDTO | null) => void;
  
  // Folder management
  folderMap: Record<string, string>;
  folders: FolderDTO[];
  onFolderChange: (segmentId: number, folderId: string | null) => void;
  
  // Actions
  onSegmentSelect: (seg: SegmentDTO) => void;
  onSegmentOpen: (seg: SegmentDTO) => void;
  onSegmentEdit: (seg: SegmentDTO) => void;
  onSegmentDelete: (seg: SegmentDTO) => void;
  deletingSegId: number | null;
  onConfirmDelete: (seg: SegmentDTO) => void;
  onCancelDelete: () => void;
  
  // Utilities
  segHtmlKey: (segId: number) => string;
}

/**
 * ManualChunkModal - Modal for creating manual chunks
 */
export default function ManualChunkModal({
  open,
  onClose,
  docText,
  mode,
  title,
  onTitleChange,
  selection,
  onSelectionChange,
  status,
  onStatusChange,
  onSave,
  manualSegments,
  openSegment,
  onOpenSegmentChange,
  folderMap,
  folders,
  onFolderChange,
  onSegmentSelect,
  onSegmentOpen,
  onSegmentEdit,
  onSegmentDelete,
  deletingSegId,
  onConfirmDelete,
  onCancelDelete,
  segHtmlKey,
}: ManualChunkModalProps) {
  
  const preRef = useRef<HTMLPreElement | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef<number>(0);

  const handleCaptureSelection = () => {
    const pre = preRef.current;
    if (!pre) return;
    const info = computeSelectionFromPre(pre, docText);
    onSelectionChange(info);
    onStatusChange(info ? `Selected ${info.end - info.start} chars.` : "No selection.");
  };

  const handleSave = async () => {
    if (!selection) {
      onStatusChange("Pick some text (drag) first.");
      return;
    }
    await onSave();
  };

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", padding: 18, zIndex: 50 }}>
      <div
        style={{
          flex: 1,
          background: "#0b0e14",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: "0 0 auto",
          }}
        >
          <b style={{ flex: 1 }}>Create manual chunk</b>
          <span style={{ fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.7 }}>
            {status}
          </span>
          <button 
            onClick={onClose} 
            style={{ 
              padding: "8px 10px",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 6,
              color: "#eaeaea",
              cursor: "pointer",
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
            }}
          >
            Close
          </button>
        </div>

        {/* Main Content */}
        <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
          {/* Left: Document text for selection */}
          <div
            style={{
              flex: "1 1 60%",
              minWidth: 0,
              minHeight: 0,
              borderRight: "1px solid rgba(255,255,255,0.10)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 700, flex: "0 0 auto" }}>
              Select text below (drag). Then Save.
            </div>

            <div style={{ padding: 12, overflow: "auto", flex: "1 1 auto", minHeight: 0 }}>
              <pre
                ref={preRef}
                onMouseUp={handleCaptureSelection}
                onKeyUp={handleCaptureSelection}
                style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6, userSelect: "text", cursor: "text" }}
              >
                {docText}
              </pre>
            </div>
          </div>

          {/* Right: Fields + Manual segments list */}
          <div style={{ flex: "1 1 40%", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
            {/* Title input and save */}
            <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", flex: "0 0 auto" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  value={title}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSave();
                    }
                  }}
                  onChange={(e) => onTitleChange(e.target.value)}
                  placeholder="Title (optional)"
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "#0f1420",
                    color: "#eaeaea",
                    fontSize: "var(--font-size-base)",
                    lineHeight: "var(--line-height-normal)",
                  }}
                />
                <button 
                  onClick={handleSave} 
                  style={{ 
                    padding: "10px 12px",
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    border: "none",
                    borderRadius: 8,
                    color: "white",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "var(--font-size-base)",
                    lineHeight: "var(--line-height-normal)",
                  }}
                >
                  Save chunk
                </button>
              </div>

              {/* Preview */}
              <div style={{ marginTop: 10, fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.75 }}>
                Preview (stored selection):
              </div>
              <div
                style={{
                  marginTop: 6,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                  maxHeight: 130,
                  overflow: "auto",
                }}
              >
                {selection ? (
                  <>
                    <div style={{ fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.75, marginBottom: 6 }}>
                      start={selection.start} end={selection.end} ({selection.end - selection.start} chars)
                    </div>
                    <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5 }}>{selection.text}</pre>
                  </>
                ) : (
                  <div style={{ opacity: 0.7 }}>— no selection</div>
                )}
              </div>
            </div>

            {/* Manual segments list or viewer */}
            <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
              {!openSegment ? (
                <div ref={listScrollRef} style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "auto" }}>
                  <div style={{ padding: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                    <span>Saved manual chunks ({mode})</span>
                    <span style={{ opacity: 0.7, fontWeight: 400 }}>{manualSegments.length}</span>
                  </div>

                  {!manualSegments.length ? (
                    <div style={{ padding: 12, opacity: 0.7 }}>
                      No manual chunks yet for <b>{mode}</b>.
                    </div>
                  ) : (
                    <div style={{ padding: 8, display: "grid", gap: 8 }}>
                      {manualSegments.map((s: any) => (
                        <div
                          key={s.id}
                          onClick={() => onSegmentSelect(s)}
                          onDoubleClick={() => onSegmentOpen(s)}
                          title="Click to select & highlight. Double-click to open. Drag to move to folder."
                          style={{
                            cursor: "pointer",
                            padding: 10,
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.10)",
                            background: "rgba(114,255,191,0.08)",
                            userSelect: "none",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                            <b style={{ fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)" }}>
                              {s.title}
                              {folderMap[String(s.id)] ? (
                                <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7, color: "#72ffbf" }}>
                                  📁 {folders.find((f) => f.id === folderMap[String(s.id)])?.name ?? "?"}
                                </span>
                              ) : null}
                            </b>

                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <select
                                value={folderMap[String(s.id)] ?? "none"}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const folderId = e.target.value === "none" ? null : e.target.value;
                                  onFolderChange(s.id, folderId);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  border: "1px solid rgba(255,255,255,0.12)",
                                  background: "#0f1420",
                                  color: "#eaeaea",
                                  fontSize: 11,
                                }}
                              >
                                <option value="none">No folder</option>
                                {folders.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </select>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSegmentEdit(s);
                                }}
                                style={{ padding: "4px 10px", fontSize: "var(--font-size-xs)" }}
                              >
                                Edit
                              </button>

                              {deletingSegId === s.id ? (
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                  <span style={{ fontSize: 11, opacity: 0.7 }}>Delete?</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onConfirmDelete(s);
                                    }}
                                    style={{
                                      padding: "3px 8px",
                                      fontSize: "var(--font-size-xs)",
                                      background: "rgba(239, 68, 68, 0.2)",
                                      border: "1px solid rgba(239, 68, 68, 0.4)",
                                      color: "#ef4444",
                                      borderRadius: 4,
                                      cursor: "pointer",
                                    }}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onCancelDelete();
                                    }}
                                    style={{
                                      padding: "3px 8px",
                                      fontSize: "var(--font-size-xs)",
                                      background: "rgba(255, 255, 255, 0.1)",
                                      border: "1px solid rgba(255, 255, 255, 0.2)",
                                      color: "#eaeaea",
                                      borderRadius: 4,
                                      cursor: "pointer",
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSegmentDelete(s);
                                  }}
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: 11,
                                    background: "rgba(239, 68, 68, 0.1)",
                                    border: "1px solid rgba(239, 68, 68, 0.2)",
                                    color: "#ef4444",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                  }}
                                  title="Delete chunk"
                                >
                                  🗑️ Delete
                                </button>
                              )}
                            </div>
                          </div>
                          <div style={{ marginTop: 6, fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.85 }}>
                            {preview120(s.content)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
                  <div
                    style={{
                      padding: 12,
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flex: "0 0 auto",
                    }}
                  >
                    <b style={{ flex: 1 }}>{(openSegment as any).title}</b>
                    <button onClick={() => onSegmentEdit(openSegment)} style={{ padding: "8px 10px" }}>
                      Edit
                    </button>
                    <button onClick={() => onOpenSegmentChange(null)} style={{ padding: "8px 10px" }}>
                      Back to list
                    </button>
                  </div>

                  <div style={{ padding: 12, overflow: "auto", flex: "1 1 auto", minHeight: 0 }}>
                    <div
                      style={{ lineHeight: 1.55 }}
                      dangerouslySetInnerHTML={{
                        __html:
                          localStorage.getItem(segHtmlKey((openSegment as any).id)) ||
                          plainTextToHtml((openSegment as any).content || ""),
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.7 }}>
              Tip: Manual modal stays open. Save multiple chunks in a row.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

