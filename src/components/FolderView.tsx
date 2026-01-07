import React, { useState } from "react";
import { FolderDTO } from "../lib/segmentFolders";
import { duplicateSegment, loadDuplicatedChunks, deleteDuplicatedChunk, DuplicatedChunk } from "../lib/chunkDuplication";

interface FolderViewProps {
  docId: number;
  folder: FolderDTO;
  onBack: () => void;
  onChunkUpdated: () => void;
}

export default function FolderView({ docId, folder, onBack, onChunkUpdated }: FolderViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const duplicatedChunks = loadDuplicatedChunks(docId);
  
  // Ensure folder and folder.contents exist and is an array
  const folderContents = (folder && Array.isArray(folder.contents)) ? folder.contents : [];
  const folderChunks = Array.isArray(duplicatedChunks) ? duplicatedChunks.filter(chunk => 
    chunk && chunk.documentId === docId && Array.isArray(folderContents) && folderContents.includes(chunk.id)
  ) : [];

  const handleEditTitle = (chunkId: string, currentTitle: string) => {
    setEditingId(chunkId);
    setEditingTitle(currentTitle);
  };

  const handleSaveTitle = (chunkId: string) => {
    // Update the chunk title in localStorage
    const chunks = loadDuplicatedChunks(docId);
    const updatedChunks = chunks.map(chunk => 
      chunk.id === chunkId ? { ...chunk, title: editingTitle } : chunk
    );
    localStorage.setItem(`aiorg_duplicated_chunks_doc_${docId}`, JSON.stringify(updatedChunks));
    
    setEditingId(null);
    setEditingTitle("");
    onChunkUpdated();
  };

  const handleDeleteChunk = (chunkId: string) => {
    setDeletingId(chunkId);
  };

  const confirmDeleteChunk = (chunkId: string) => {
    deleteDuplicatedChunk(docId, chunkId);
    setDeletingId(null);
    onChunkUpdated();
  };

  const cancelDelete = () => {
    setDeletingId(null);
  };

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={onBack} style={{ padding: "6px 12px", fontSize: 12 }}>
          ← Back
        </button>
        <h3 style={{ margin: 0, fontSize: 16 }}>📁 {folder?.name || "Unknown Folder"}</h3>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          ({folderChunks.length} chunks)
        </span>
      </div>

      {!folderChunks.length ? (
        <div style={{ padding: 20, textAlign: "center", opacity: 0.7 }}>
          No chunks in this folder yet. Drag chunks here or use the dropdown to add them.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {folderChunks.map((chunk: DuplicatedChunk) => (
            <div
              key={chunk.id}
              style={{
                padding: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 8,
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                {editingId === chunk.id ? (
                  <input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onBlur={() => handleSaveTitle(chunk.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle(chunk.id);
                      if (e.key === "Escape") {
                        setEditingId(null);
                        setEditingTitle("");
                      }
                    }}
                    style={{
                      background: "#0f1420",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#eaeaea",
                      padding: "4px 8px",
                      borderRadius: 4,
                      fontSize: 13,
                    }}
                    autoFocus
                  />
                ) : (
                  <h4 
                    style={{ 
                      margin: 0, 
                      fontSize: 14, 
                      cursor: "pointer",
                      color: "#72ffbf"
                    }}
                    onClick={() => handleEditTitle(chunk.id, chunk.title)}
                    title="Click to edit title"
                  >
                    {chunk.title}
                  </h4>
                )}
                
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {deletingId === chunk.id ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 11, opacity: 0.7 }}>Delete?</span>
                      <button
                        onClick={() => confirmDeleteChunk(chunk.id)}
                        style={{
                          padding: "3px 8px",
                          fontSize: 11,
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
                        onClick={cancelDelete}
                        style={{
                          padding: "3px 8px",
                          fontSize: 11,
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
                      onClick={() => handleDeleteChunk(chunk.id)}
                      style={{
                        padding: "4px 10px",
                        fontSize: 11,
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
              
              <div style={{ 
                fontSize: 12, 
                opacity: 0.8, 
                lineHeight: 1.4,
                maxHeight: 60,
                overflow: "hidden"
              }}>
                {chunk.content.length > 150 
                  ? chunk.content.slice(0, 150) + "..." 
                  : chunk.content
                }
              </div>
              
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
                Original: #{chunk.originalId} • {chunk.isManual ? "Manual" : "Auto"} • {chunk.mode}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

