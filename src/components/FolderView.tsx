import React, { useState, useEffect, useMemo } from "react";
import { FolderDTO } from "../lib/segmentFolders";
import { loadDuplicatedChunks, deleteDuplicatedChunk, DuplicatedChunk } from "../lib/chunkDuplication";
import { getFolder as apiGetFolder } from "../lib/api";

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
  const [refreshKey, setRefreshKey] = useState(0);
  const [folderItems, setFolderItems] = useState<string[]>([]); // chunk IDs from API

  // Load folder items from API (database-first)
  useEffect(() => {
    const loadItems = async () => {
      try {
        const folderWithItems = await apiGetFolder(parseInt(folder.id, 10));
        // Extract chunk IDs from folder items
        const chunkIds = folderWithItems.items
          .filter(item => item.chunkId)
          .map(item => item.chunkId!)
          .filter(Boolean);
        setFolderItems(chunkIds);
      } catch (error) {
        console.error("Failed to load folder items:", error);
        // Fallback: try to get from folder.contents if available
        if (folder.contents && Array.isArray(folder.contents)) {
          setFolderItems(folder.contents.filter(Boolean));
        } else {
          setFolderItems([]);
        }
      }
    };
    loadItems();
  }, [docId, folder.id, refreshKey]);

  // Also listen for storage events to update when folder changes from other tabs/components
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `aiorg_seg_folders_doc_${docId}` || e.key === `aiorg_duplicated_chunks_doc_${docId}`) {
        setRefreshKey(prev => prev + 1);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [docId]);

  // Load fresh data from API
  const currentFolder = useMemo(() => {
    // Use the folder prop as base, but items come from API state
    return folder;
  }, [folder]);

  const duplicatedChunks = useMemo(() => {
    return loadDuplicatedChunks(docId);
  }, [docId, refreshKey]);
  
  // Filter chunks that are in this folder (from API)
  const folderChunks = useMemo(() => {
    return Array.isArray(duplicatedChunks) ? duplicatedChunks.filter(chunk => 
      chunk && chunk.documentId === docId && folderItems.includes(chunk.id)
    ) : [];
  }, [duplicatedChunks, docId, folderItems]);

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
    setRefreshKey(prev => prev + 1); // Force refresh
    onChunkUpdated();
  };

  const handleDeleteChunk = (chunkId: string) => {
    setDeletingId(chunkId);
  };

  const confirmDeleteChunk = (chunkId: string) => {
    deleteDuplicatedChunk(docId, chunkId);
    setDeletingId(null);
    setRefreshKey(prev => prev + 1); // Force refresh
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
        <h3 style={{ margin: 0, fontSize: 16 }}>📁 {currentFolder?.name || folder?.name || "Unknown Folder"}</h3>
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
                <div style={{ display: "flex", gap: 8 }}>
                  {deletingId === chunk.id ? (
                    <>
                      <button
                        onClick={() => confirmDeleteChunk(chunk.id)}
                        style={{
                          padding: "4px 8px",
                          fontSize: 12,
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={cancelDelete}
                        style={{
                          padding: "4px 8px",
                          fontSize: 12,
                          background: "rgba(255,255,255,0.1)",
                          color: "#eaeaea",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleDeleteChunk(chunk.id)}
                      style={{
                        padding: "4px 8px",
                        fontSize: 12,
                        background: "rgba(239, 68, 68, 0.2)",
                        color: "#ef4444",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: 4,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                {chunk.content?.slice(0, 100)}...
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
