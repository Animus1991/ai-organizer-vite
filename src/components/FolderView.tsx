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
  // NOTE: Only depend on docId, folder.id, and refreshKey - NOT onChunkUpdated (function reference can change)
  useEffect(() => {
    const loadItems = async () => {
      try {
        // Use skipCache=true to ensure fresh data, especially after deletions
        // This is critical for foldering consistency
        const folderWithItems = await apiGetFolder(parseInt(folder.id, 10), true);
        // Extract chunk IDs from folder items
        const chunkIds = folderWithItems.items
          .filter(item => item.chunkId)
          .map(item => item.chunkId!)
          .filter(Boolean);
        setFolderItems(chunkIds);
      } catch (error) {
        // If folder doesn't exist (404), it may have been deleted - set empty items
        console.error("Failed to load folder items:", error);
        setFolderItems([]);
      }
    };
    loadItems();
    // refreshKey will trigger reload when needed (from custom events)
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

  // Listen for custom event when chunks are updated
  // P1-1 FIX: Use debounce to prevent rapid re-loads that cause infinite loops
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const handleChunkUpdate = () => {
      // Debounce to prevent rapid-fire reloads (e.g., if multiple events fire in quick succession)
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        setRefreshKey(prev => prev + 1);
      }, 300); // 300ms debounce - only reload after events stop firing
    };
    window.addEventListener('folder-chunk-updated', handleChunkUpdate);
    return () => {
      window.removeEventListener('folder-chunk-updated', handleChunkUpdate);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, []);

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

  const handleSaveTitle = async (chunkId: string) => {
    // Update the chunk title in localStorage
    const chunks = loadDuplicatedChunks(docId);
    const updatedChunks = chunks.map(chunk => 
      chunk.id === chunkId ? { ...chunk, title: editingTitle } : chunk
    );
    localStorage.setItem(`aiorg_duplicated_chunks_doc_${docId}`, JSON.stringify(updatedChunks));
    
    setEditingId(null);
    setEditingTitle("");
    setRefreshKey(prev => prev + 1); // Force refresh
    
    // Call onChunkUpdated but don't await to prevent blocking (title change is local only)
    onChunkUpdated().catch(err => console.error("onChunkUpdated error:", err));
  };

  const handleDeleteChunk = (chunkId: string) => {
    setDeletingId(chunkId);
  };

  const confirmDeleteChunk = async (chunkId: string) => {
    try {
      // Clear cache FIRST, before any API calls, to ensure fresh data
      const { apiCache } = await import("../lib/cache");
      const API_BASE = import.meta.env.VITE_API_BASE_URL?.toString() || "http://127.0.0.1:8000";
      // Clear ALL folder-related caches - be extremely thorough to avoid stale data
      apiCache.delete(`cache:${API_BASE}/api/workspace/folders/${folder.id}`);
      apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/documents/${docId}/folders`);
      apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders`);
      apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders/`);
      
      // Find the folder item for this chunk and delete it from API
      // Use skipCache=true to fetch fresh data after cache clear
      const folderWithItems = await apiGetFolder(parseInt(folder.id, 10), true);
      const folderItem = folderWithItems.items.find(item => item.chunkId === chunkId);
      
      let folderWasDeleted = false;
      if (folderItem) {
        const { deleteFolderItem } = await import("../lib/api");
        const response = await deleteFolderItem(folderItem.id);
        
        // P1-1: Handle folder auto-deletion by backend
        if (response.folder_deleted) {
          folderWasDeleted = true;
        }
        
        // Clear cache AGAIN after deletion to ensure it's removed
        apiCache.delete(`cache:${API_BASE}/api/workspace/folders/${folder.id}`);
        apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/documents/${docId}/folders`);
        apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders`);
        apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders/`);
      }
      
      // Also delete from localStorage (duplicated chunks)
      deleteDuplicatedChunk(docId, chunkId);
      
      // Wait for backend to fully process the deletion
      await new Promise(resolve => setTimeout(resolve, 200)); // Increased delay to ensure backend processing
      
      setDeletingId(null);
      
      // P1-1: If folder was auto-deleted, navigate back to parent view
      if (folderWasDeleted) {
        // Folder was deleted by backend - navigate back immediately
        // Clear cache one more time before navigation
        apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/documents/${docId}/folders`);
        apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders`);
        onBack();
        // The parent will handle refresh after navigation
      } else {
        // Folder still exists - refresh this view and update parent state
        setRefreshKey(prev => prev + 1); // Force refresh of FolderView
        
        // Clear cache ONE MORE TIME before calling onChunkUpdated to ensure absolute freshness
        apiCache.delete(`cache:${API_BASE}/api/workspace/folders/${folder.id}`);
        apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/documents/${docId}/folders`);
        apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders`);
        apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders/`);
        
        // Call onChunkUpdated to update parent state (DocumentWorkspace)
        // This will reload folders and folderMap with fresh data from backend
        // MUST await to ensure parent state is updated before continuing
        await onChunkUpdated();
        
        // Force one more refresh after parent state update
        setRefreshKey(prev => prev + 1);
      }
    } catch (error) {
      console.error("Failed to delete chunk from folder:", error);
      // Still delete from localStorage as fallback
      deleteDuplicatedChunk(docId, chunkId);
      
      // Clear cache even on error
      const { apiCache } = await import("../lib/cache");
      const API_BASE = import.meta.env.VITE_API_BASE_URL?.toString() || "http://127.0.0.1:8000";
      apiCache.delete(`cache:${API_BASE}/api/workspace/folders/${folder.id}`);
      apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/documents/${docId}/folders`);
      apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders`);
      
      setDeletingId(null);
      setRefreshKey(prev => prev + 1);
      
      // Still call onChunkUpdated even on error (but don't await to prevent blocking)
      onChunkUpdated().catch(err => console.error("onChunkUpdated error:", err));
    }
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
