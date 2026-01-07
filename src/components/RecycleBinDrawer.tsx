import React from "react";
import { loadRecycledChunks, restoreChunk, permanentlyDeleteChunk, RecycledChunk } from "../lib/chunkDuplication";

interface RecycleBinDrawerProps {
  docId: number;
  open: boolean;
  onClose: () => void;
  onRestored: () => void;
}

export default function RecycleBinDrawer({ docId, open, onClose, onRestored }: RecycleBinDrawerProps) {
  const [selectedItems, setSelectedItems] = React.useState<Set<string>>(new Set());

  if (!open) return null;

  const recycledChunks = loadRecycledChunks(docId);
  const safeRecycledChunks = Array.isArray(recycledChunks) ? recycledChunks : [];
  const now = Date.now();

  const formatTimeRemaining = (deletedAt: number) => {
    const hoursElapsed = (now - deletedAt) / (1000 * 60 * 60);
    const hoursRemaining = Math.max(0, 30 * 24 - hoursElapsed);
    
    if (hoursRemaining > 24) {
      const days = Math.floor(hoursRemaining / 24);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    return `${Math.floor(hoursRemaining)} hour${Math.floor(hoursRemaining) !== 1 ? 's' : ''}`;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const handleSelectAll = () => {
    if (selectedItems.size === safeRecycledChunks.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(safeRecycledChunks.map(chunk => chunk.id)));
    }
  };

  const handleSelectItem = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkRestore = () => {
    if (selectedItems.size === 0) return;
    
    if (window.confirm(`Restore ${selectedItems.size} chunk${selectedItems.size !== 1 ? 's' : ''}?`)) {
      selectedItems.forEach(id => {
        restoreChunk(docId, id);
      });
      setSelectedItems(new Set());
      onRestored();
    }
  };

  const handleBulkDelete = () => {
    if (selectedItems.size === 0) return;
    
    if (window.confirm(`Permanently delete ${selectedItems.size} chunk${selectedItems.size !== 1 ? 's' : ''}? This cannot be undone.`)) {
      selectedItems.forEach(id => {
        permanentlyDeleteChunk(docId, id);
      });
      setSelectedItems(new Set());
      onRestored();
    }
  };

  const handleAutoCleanup = () => {
    if (window.confirm("Auto-cleanup will permanently delete all expired items (older than 30 days). Continue?")) {
      const expired = safeRecycledChunks.filter(chunk => (now - chunk.deletedAt) > (30 * 24 * 60 * 60 * 1000));
      expired.forEach(chunk => {
        permanentlyDeleteChunk(docId, chunk.id);
      });
      onRestored();
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      right: 0,
      width: "400px",
      height: "100vh",
      background: "#0b0e14",
      border: "1px solid rgba(255,255,255,0.12)",
      borderLeft: "none",
      zIndex: 100,
      display: "flex",
      flexDirection: "column"
    }}>
      <div style={{
        padding: 16,
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>🗑️ Recycle Bin</h3>
        <button onClick={onClose} style={{ padding: "4px 8px", fontSize: 12 }}>×</button>
      </div>

      <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button 
            onClick={handleSelectAll}
            style={{ padding: "4px 8px", fontSize: 11 }}
          >
            {selectedItems.size === safeRecycledChunks.length ? "Deselect All" : "Select All"}
          </button>
          
          <button 
            onClick={handleBulkRestore}
            disabled={selectedItems.size === 0}
            style={{ 
              padding: "4px 8px", 
              fontSize: 11,
              opacity: selectedItems.size > 0 ? 1 : 0.5,
              cursor: selectedItems.size > 0 ? "pointer" : "not-allowed"
            }}
          >
            Restore ({selectedItems.size})
          </button>
          
          <button 
            onClick={handleBulkDelete}
            disabled={selectedItems.size === 0}
            style={{ 
              padding: "4px 8px", 
              fontSize: 11,
              background: "rgba(239, 68, 68, 0.2)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#ef4444",
              opacity: selectedItems.size > 0 ? 1 : 0.5,
              cursor: selectedItems.size > 0 ? "pointer" : "not-allowed"
            }}
          >
            Delete ({selectedItems.size})
          </button>
          
          <button 
            onClick={handleAutoCleanup}
            style={{ padding: "4px 8px", fontSize: 11 }}
          >
            Auto Cleanup
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 12 }}>
        {!safeRecycledChunks.length ? (
          <div style={{ textAlign: "center", opacity: 0.7, padding: 40 }}>
            Recycle bin is empty
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {safeRecycledChunks.map((chunk: any) => {
              const isExpired = (now - chunk.deletedAt) > (30 * 24 * 60 * 60 * 1000);
              const isSelected = selectedItems.has(chunk.id);
              
              return (
                <div
                  key={chunk.id}
                  style={{
                    padding: 12,
                    border: isSelected ? "1px solid #72ffbf" : "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 8,
                    background: isSelected ? "rgba(114, 255, 191, 0.1)" : "rgba(255,255,255,0.02)",
                    opacity: isExpired ? 0.6 : 1
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectItem(chunk.id)}
                      style={{ marginTop: 2 }}
                    />
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: "bold", fontSize: 13, marginBottom: 4 }}>
                        {chunk.title}
                      </div>
                      
                      <div style={{ 
                        fontSize: 11, 
                        opacity: 0.7, 
                        marginBottom: 6,
                        maxHeight: 40,
                        overflow: "hidden",
                        lineHeight: 1.3
                      }}>
                        {chunk.content.length > 100 
                          ? chunk.content.slice(0, 100) + "..." 
                          : chunk.content
                        }
                      </div>
                      
                      <div style={{ fontSize: 10, opacity: 0.6 }}>
                        Deleted: {formatDate(chunk.deletedAt)}
                        {isExpired ? (
                          <span style={{ color: "#ef4444", marginLeft: 8 }}>
                            ⚠️ Expired
                          </span>
                        ) : (
                          <span style={{ marginLeft: 8 }}>
                            ⏰ {formatTimeRemaining(chunk.deletedAt)} remaining
                          </span>
                        )}
                      </div>
                      
                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button
                          onClick={() => {
                            restoreChunk(docId, chunk.id);
                            onRestored();
                          }}
                          style={{
                            padding: "2px 6px",
                            fontSize: 10,
                            background: "rgba(34, 197, 94, 0.2)",
                            border: "1px solid rgba(34, 197, 94, 0.3)",
                            color: "#22c55e",
                            borderRadius: 3,
                            cursor: "pointer"
                          }}
                        >
                          Restore
                        </button>
                        
                        <button
                          onClick={() => {
                            if (window.confirm("Permanently delete this chunk?")) {
                              permanentlyDeleteChunk(docId, chunk.id);
                              onRestored();
                            }
                          }}
                          style={{
                            padding: "2px 6px",
                            fontSize: 10,
                            background: "rgba(239, 68, 68, 0.2)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            color: "#ef4444",
                            borderRadius: 3,
                            cursor: "pointer"
                          }}
                        >
                          Delete Forever
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
