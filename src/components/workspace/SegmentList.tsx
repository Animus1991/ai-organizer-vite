import React from "react";
import { highlightSearch } from "../../lib/searchUtils";
import { preview120 } from "../../lib/documentWorkspace/utils";
import { plainTextToHtml } from "../../editor/utils/text";
import FolderView from "../FolderView";
import type { SegmentDTO } from "../../lib/api";
import type { FolderDTO } from "../../lib/segmentFolders";

export interface SegmentListProps {
  segments: SegmentDTO[];
  filteredSegments: SegmentDTO[];
  selectedSegId: number | null;
  openSeg: SegmentDTO | null;
  folderFilter: string;
  folders: FolderDTO[];
  folderMap: Record<string, string>;
  query: string;
  draggedSegment: SegmentDTO | null;
  dragOverFolder: string | null;
  deletingSegId: number | null;
  listScrollRef: React.RefObject<HTMLDivElement | null>;
  segHtmlKey: (segId: number) => string;
  docId: number;
  onSelect: (segment: SegmentDTO) => void;
  onOpen: (segment: SegmentDTO) => void;
  onDragStart: (e: React.DragEvent, segment: SegmentDTO) => void;
  onDragEnd: () => void;
  onFolderChange: (segment: SegmentDTO, folderId: string | null) => void;
  onEdit: (segment: SegmentDTO) => void;
  onDelete: (segment: SegmentDTO) => void;
  onConfirmDelete: (segment: SegmentDTO) => void;
  onCancelDelete: () => void;
  onBackToList: () => void;
  onChunkUpdated: () => void;
  onBackFromFolder: () => void;
}

export function SegmentList({
  segments,
  filteredSegments,
  selectedSegId,
  openSeg,
  folderFilter,
  folders,
  folderMap,
  query,
  draggedSegment,
  dragOverFolder,
  deletingSegId,
  listScrollRef,
  segHtmlKey,
  docId,
  onSelect,
  onOpen,
  onDragStart,
  onDragEnd,
  onFolderChange,
  onEdit,
  onDelete,
  onConfirmDelete,
  onCancelDelete,
  onBackToList,
  onChunkUpdated,
  onBackFromFolder,
}: SegmentListProps) {
  if (openSeg) {
    // Segment viewer mode
    return (
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
          <b style={{ flex: 1 }}>
            {(((openSeg as any).orderIndex ?? 0) as number) + 1}. {(openSeg as any).title}{" "}
            <span style={{ fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.7 }}>
              {(openSeg as any).isManual ? "• manual" : "• auto"}
            </span>
          </b>

          <button onClick={() => onEdit(openSeg)} style={{ padding: "8px 10px" }}>
            Edit
          </button>

          <button onClick={onBackToList} style={{ padding: "8px 10px" }}>
            Back to list
          </button>
        </div>

        <div style={{ padding: 12, overflow: "auto", flex: "1 1 auto", minHeight: 0 }}>
          <div
            style={{ lineHeight: 1.55 }}
            dangerouslySetInnerHTML={{
              __html: localStorage.getItem(segHtmlKey((openSeg as any).id)) || plainTextToHtml((openSeg as any).content || ""),
            }}
          />
        </div>
      </div>
    );
  }

  // Folder view mode
  if (folderFilter !== "all" && folderFilter !== "none") {
    const selectedFolder = folders.find((f) => f.id === folderFilter);
    return selectedFolder ? (
      <FolderView
        docId={docId}
        folder={selectedFolder}
        onBack={onBackFromFolder}
        onChunkUpdated={onChunkUpdated}
      />
    ) : (
      <div style={{ padding: 12, opacity: 0.7 }}>Folder not found.</div>
    );
  }

  // Regular segments list
  return (
    <div ref={listScrollRef} style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "auto" }}>
      <div style={{ padding: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
        <span>Chunks</span>
        <span style={{ opacity: 0.7, fontWeight: 400 }}>
          {segments.length ? `${filteredSegments.length}/${segments.length}` : "—"}
        </span>
      </div>

      {!segments.length ? (
        <div style={{ padding: 12, opacity: 0.7 }}>No chunks loaded. Click "List segments".</div>
      ) : !filteredSegments.length ? (
        <div style={{ padding: 12, opacity: 0.7 }}>No results.</div>
      ) : (
        <div style={{ padding: 8, display: "grid", gap: 8 }}>
          {filteredSegments.map((s: any) => {
            const active = selectedSegId === s.id;
            return (
              <div
                key={s.id}
                onClick={() => onSelect(s)}
                onDoubleClick={() => onOpen(s)}
                title="Click to select & highlight. Double-click to open. Drag to move to folder."
                draggable
                onDragStart={(e) => onDragStart(e, s)}
                onDragEnd={onDragEnd}
                className={`cursor-move transition-all duration-200 ${
                  draggedSegment?.id === s.id ? "opacity-50" : ""
                } ${dragOverFolder ? "ring-2 ring-primary/50" : ""}`}
                style={{
                  cursor: "pointer",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: active ? "rgba(114,255,191,0.10)" : "rgba(255,255,255,0.03)",
                  userSelect: "none",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <b style={{ fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)" }}>
                    {(s.orderIndex ?? 0) + 1}.{" "}
                    {query.trim() ? (
                      highlightSearch(s.title ?? "", query).map((part, idx) => (
                        <span
                          key={idx}
                          style={
                            part.highlighted
                              ? {
                                  background: "rgba(99, 102, 241, 0.3)",
                                  color: "#a5b4fc",
                                  fontWeight: 700,
                                  padding: "2px 4px",
                                  borderRadius: 4,
                                }
                              : {}
                          }
                        >
                          {part.text}
                        </span>
                      ))
                    ) : (
                      s.title
                    )}
                    <span style={{ marginLeft: 8, fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.7 }}>
                      {s.isManual ? "manual" : "auto"}
                    </span>
                    {folderMap[String(s.id)] ? (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: "var(--font-size-xs)",
                          lineHeight: "var(--line-height-normal)",
                          opacity: 0.7,
                          color: "#72ffbf",
                        }}
                      >
                        📁 {folders.find((f) => f.id === folderMap[String(s.id)])?.name ?? "?"}
                      </span>
                    ) : null}
                  </b>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.7 }}>{s.mode}</span>

                    <select
                      value={folderMap[String(s.id)] ?? "none"}
                      onChange={(e) => {
                        e.stopPropagation();
                        const folderId = e.target.value === "none" ? null : e.target.value;
                        onFolderChange(s, folderId);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        padding: "4px 8px",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "#0f1420",
                        color: "#eaeaea",
                        fontSize: "var(--font-size-xs)",
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

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(s);
                      }}
                      style={{ padding: "4px 10px" }}
                    >
                      Edit
                    </button>

                    {deletingSegId === s.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.7 }}>Delete?</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onConfirmDelete(s);
                          }}
                          style={{
                            padding: "3px 8px",
                            fontSize: "var(--font-size-xs)",
                            lineHeight: "var(--line-height-normal)",
                            background: "rgba(239, 68, 68, 0.2)",
                            border: "1px solid rgba(239, 68, 68, 0.4)",
                            color: "#ef4444",
                            borderRadius: 4,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)";
                            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.6)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
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
                            lineHeight: "var(--line-height-normal)",
                            background: "rgba(255, 255, 255, 0.1)",
                            border: "1px solid rgba(255, 255, 255, 0.2)",
                            color: "#eaeaea",
                            borderRadius: 4,
                            cursor: "pointer",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(s);
                        }}
                        style={{
                          padding: "4px 10px",
                          fontSize: "var(--font-size-xs)",
                          lineHeight: "var(--line-height-normal)",
                          background: "rgba(239, 68, 68, 0.1)",
                          border: "1px solid rgba(239, 68, 68, 0.2)",
                          color: "#ef4444",
                          borderRadius: 6,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                          e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
                          e.currentTarget.style.transform = "scale(1.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                          e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.2)";
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        title="Delete chunk"
                      >
                        🗑️ Delete
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.8, marginTop: 4 }}>
                  {preview120(s.content)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

