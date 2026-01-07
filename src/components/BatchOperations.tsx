// src/components/BatchOperations.tsx
import { useBatchOperations } from '../hooks/useBatchOperations';
import type { UploadItemDTO } from '../lib/api';
import { LoadingSpinner } from './ui/Spinner';

interface BatchOperationsProps {
  documents: UploadItemDTO[];
  segmentsMap: Map<number, any[]>;
  onRefresh?: () => void;
}

export function BatchOperations({ documents, segmentsMap, onRefresh }: BatchOperationsProps) {
  const {
    selectedItems,
    isBatchMode,
    selectedCount,
    operations,
    hasActiveOperations,
    toggleSelection,
    selectAll,
    clearSelection,
    toggleBatchMode,
    batchDelete,
    batchSegment,
    batchExport,
    isSelected
  } = useBatchOperations();

  const handleBatchDelete = async () => {
    const selectedDocs = documents.filter(doc => selectedItems.has(doc.documentId));
    if (selectedDocs.length === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedDocs.length} selected document(s)?\n\n` +
      `This will permanently delete:\n` +
      selectedDocs.map(d => `- ${d.filename}`).join('\n') +
      `\n\nThis action cannot be undone.`
    );
    if (!confirmed) return;
    
    await batchDelete(selectedDocs);
    onRefresh?.();
  };

  const handleBatchSegment = async (mode: 'qa' | 'paragraphs') => {
    const selectedDocs = documents.filter(doc => selectedItems.has(doc.documentId));
    if (selectedDocs.length === 0) return;
    
    await batchSegment(selectedDocs, mode);
    onRefresh?.();
  };

  const handleBatchExport = async () => {
    const selectedDocs = documents.filter(doc => selectedItems.has(doc.documentId));
    if (selectedDocs.length === 0) return;
    
    await batchExport(selectedDocs, segmentsMap);
  };

  const getOperationStatus = (type: 'delete' | 'segment' | 'export') => {
    const operation = operations.find(op => op.type === type);
    return operation?.status || 'pending';
  };

  const getOperationProgress = (type: 'delete' | 'segment' | 'export') => {
    const operation = operations.find(op => op.type === type);
    if (!operation) return null;
    return {
      progress: operation.progress || 0,
      total: operation.total || 0,
      percentage: operation.total ? Math.round((operation.progress / operation.total) * 100) : 0
    };
  };

  if (documents.length === 0) return null;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 mb-4">
      {/* Batch Mode Toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={toggleBatchMode}
            style={{
              padding: "12px 20px",
              background: isBatchMode 
                ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" 
                : "rgba(255, 255, 255, 0.05)",
              border: isBatchMode ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "12px",
              color: isBatchMode ? "white" : "#eaeaea",
              fontWeight: 600,
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: isBatchMode ? "0 4px 12px rgba(99, 102, 241, 0.3)" : "none",
            }}
            onMouseEnter={(e) => {
              if (!isBatchMode) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isBatchMode) {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
              }
            }}
          >
            {isBatchMode ? 'Exit Batch Mode' : 'Batch Mode'}
          </button>
          
          {isBatchMode && (
            <span style={{ fontSize: "var(--font-size-base)", color: "rgba(255, 255, 255, 0.7)" }}>
              {selectedCount} of {documents.length} selected
            </span>
          )}
        </div>

        {isBatchMode && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => selectAll(documents.map(d => d.documentId))}
              style={{
                padding: "8px 16px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                color: "#eaeaea",
                fontSize: "var(--font-size-sm)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
              }}
            >
              Select All
            </button>
            <button
              onClick={clearSelection}
              style={{
                padding: "8px 16px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "8px",
                color: "#eaeaea",
                fontSize: "var(--font-size-sm)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
              }}
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>

      {/* Batch Actions */}
      {isBatchMode && selectedCount > 0 && (
        <div className="border-t border-border pt-4">
          <h3 className="font-medium mb-3">Batch Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Batch Delete */}
            <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px", padding: "16px" }}>
              <h4 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, color: "#eaeaea", marginBottom: "8px" }}>Delete</h4>
              <p style={{ fontSize: "var(--font-size-sm)", color: "rgba(255, 255, 255, 0.6)", marginBottom: "12px" }}>
                Permanently delete selected documents
              </p>
              <button
                onClick={handleBatchDelete}
                disabled={getOperationStatus('delete') === 'in-progress'}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  background: getOperationStatus('delete') === 'in-progress' 
                    ? "rgba(239, 68, 68, 0.5)" 
                    : "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "var(--font-size-sm)",
                  cursor: getOperationStatus('delete') === 'in-progress' ? "not-allowed" : "pointer",
                  opacity: getOperationStatus('delete') === 'in-progress' ? 0.7 : 1,
                  transition: "all 0.2s ease",
                }}
              >
                {getOperationStatus('delete') === 'in-progress' ? (
                  <LoadingSpinner text="Deleting..." />
                ) : (
                  `Delete ${selectedCount} Document${selectedCount > 1 ? 's' : ''}`
                )}
              </button>
              {getOperationStatus('delete') === 'in-progress' && (
                <div style={{ marginTop: "12px" }}>
                  <div style={{ width: "100%", background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", height: "8px", overflow: "hidden" }}>
                    <div 
                      style={{ 
                        background: "#ef4444", 
                        height: "100%", 
                        borderRadius: "8px",
                        transition: "width 0.3s ease",
                        width: `${getOperationProgress('delete')?.percentage || 0}%` 
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "rgba(255, 255, 255, 0.6)", marginTop: "8px", textAlign: "center" }}>
                    {getOperationProgress('delete')?.progress} / {getOperationProgress('delete')?.total}
                  </div>
                </div>
              )}
            </div>

            {/* Batch Segment */}
            <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px", padding: "16px" }}>
              <h4 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, color: "#eaeaea", marginBottom: "8px" }}>Segment</h4>
              <p style={{ fontSize: "var(--font-size-sm)", color: "rgba(255, 255, 255, 0.6)", marginBottom: "12px" }}>
                Create segments for selected documents
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <button
                  onClick={() => handleBatchSegment('qa')}
                  disabled={getOperationStatus('segment') === 'in-progress'}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    background: getOperationStatus('segment') === 'in-progress' 
                      ? "rgba(59, 130, 246, 0.5)" 
                      : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    border: "none",
                    borderRadius: "8px",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "var(--font-size-sm)",
                    cursor: getOperationStatus('segment') === 'in-progress' ? "not-allowed" : "pointer",
                    opacity: getOperationStatus('segment') === 'in-progress' ? 0.7 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  {getOperationStatus('segment') === 'in-progress' ? (
                    <LoadingSpinner text="Segmenting..." />
                  ) : (
                    `Q&A Mode`
                  )}
                </button>
                <button
                  onClick={() => handleBatchSegment('paragraphs')}
                  disabled={getOperationStatus('segment') === 'in-progress'}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    background: getOperationStatus('segment') === 'in-progress' 
                      ? "rgba(16, 185, 129, 0.5)" 
                      : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                    borderRadius: "8px",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "var(--font-size-sm)",
                    cursor: getOperationStatus('segment') === 'in-progress' ? "not-allowed" : "pointer",
                    opacity: getOperationStatus('segment') === 'in-progress' ? 0.7 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  {getOperationStatus('segment') === 'in-progress' ? (
                    <LoadingSpinner text="Segmenting..." />
                  ) : (
                    `Paragraphs Mode`
                  )}
                </button>
              </div>
              {getOperationStatus('segment') === 'in-progress' && (
                <div style={{ marginTop: "12px" }}>
                  <div style={{ width: "100%", background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", height: "8px", overflow: "hidden" }}>
                    <div 
                      style={{ 
                        background: "#3b82f6", 
                        height: "100%", 
                        borderRadius: "8px",
                        transition: "width 0.3s ease",
                        width: `${getOperationProgress('segment')?.percentage || 0}%` 
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "rgba(255, 255, 255, 0.6)", marginTop: "8px", textAlign: "center" }}>
                    {getOperationProgress('segment')?.progress} / {getOperationProgress('segment')?.total}
                  </div>
                </div>
              )}
            </div>

            {/* Batch Export */}
            <div style={{ background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px", padding: "16px" }}>
              <h4 style={{ fontSize: "var(--font-size-base)", fontWeight: 600, color: "#eaeaea", marginBottom: "8px" }}>Export</h4>
              <p style={{ fontSize: "var(--font-size-sm)", color: "rgba(255, 255, 255, 0.6)", marginBottom: "12px" }}>
                Export selected documents
              </p>
              <button
                onClick={handleBatchExport}
                disabled={getOperationStatus('export') === 'in-progress'}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  background: getOperationStatus('export') === 'in-progress' 
                    ? "rgba(139, 92, 246, 0.5)" 
                    : "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "var(--font-size-sm)",
                  cursor: getOperationStatus('export') === 'in-progress' ? "not-allowed" : "pointer",
                  opacity: getOperationStatus('export') === 'in-progress' ? 0.7 : 1,
                  transition: "all 0.2s ease",
                }}
              >
                {getOperationStatus('export') === 'in-progress' ? (
                  <LoadingSpinner text="Exporting..." />
                ) : (
                  `Export ${selectedCount} Document${selectedCount > 1 ? 's' : ''}`
                )}
              </button>
              {getOperationStatus('export') === 'in-progress' && (
                <div style={{ marginTop: "12px" }}>
                  <div style={{ width: "100%", background: "rgba(0, 0, 0, 0.3)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", height: "8px", overflow: "hidden" }}>
                    <div 
                      style={{ 
                        background: "#8b5cf6", 
                        height: "100%", 
                        borderRadius: "8px",
                        transition: "width 0.3s ease",
                        width: `${getOperationProgress('export')?.percentage || 0}%` 
                      }}
                    />
                  </div>
                  <div style={{ fontSize: "var(--font-size-xs)", color: "rgba(255, 255, 255, 0.6)", marginTop: "8px", textAlign: "center" }}>
                    {getOperationProgress('export')?.progress} / {getOperationProgress('export')?.total}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selection Info */}
      {!isBatchMode && selectedCount > 0 && (
        <div style={{ fontSize: "var(--font-size-sm)", color: "rgba(255, 255, 255, 0.6)", marginTop: "16px" }}>
          {selectedCount} document{selectedCount > 1 ? 's' : ''} selected.{" "}
          <button 
            onClick={toggleBatchMode}
            style={{
              color: "#6366f1",
              background: "none",
              border: "none",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: "var(--font-size-sm)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#8b5cf6";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#6366f1";
            }}
          >
            Enter batch mode
          </button>
        </div>
      )}
    </div>
  );
}
