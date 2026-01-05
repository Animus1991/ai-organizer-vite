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
    
    const confirmed = window.confirm(`Delete ${selectedDocs.length} selected document(s)?`);
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
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleBatchMode}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isBatchMode 
                ? 'bg-primary text-white' 
                : 'bg-surface-elevated border border-border hover:bg-surface'
            }`}
          >
            {isBatchMode ? 'Exit Batch Mode' : 'Batch Mode'}
          </button>
          
          {isBatchMode && (
            <span className="text-sm text-secondary">
              {selectedCount} of {documents.length} selected
            </span>
          )}
        </div>

        {isBatchMode && (
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1 bg-surface-elevated border border-border rounded-lg hover:bg-surface text-sm"
            >
              Select All
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1 bg-surface-elevated border border-border rounded-lg hover:bg-surface text-sm"
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
            <div className="bg-surface-elevated border border-border rounded-lg p-3">
              <h4 className="font-medium text-sm mb-2">Delete</h4>
              <p className="text-xs text-secondary mb-3">
                Permanently delete selected documents
              </p>
              <button
                onClick={handleBatchDelete}
                disabled={getOperationStatus('delete') === 'in-progress'}
                className="w-full px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm"
              >
                {getOperationStatus('delete') === 'in-progress' ? (
                  <LoadingSpinner text="Deleting..." />
                ) : (
                  `Delete ${selectedCount} Document${selectedCount > 1 ? 's' : ''}`
                )}
              </button>
              {getOperationStatus('delete') === 'in-progress' && (
                <div className="mt-2">
                  <div className="w-full bg-surface border border-border rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getOperationProgress('delete')?.percentage || 0}%` }}
                    />
                  </div>
                  <div className="text-xs text-secondary mt-1 text-center">
                    {getOperationProgress('delete')?.progress} / {getOperationProgress('delete')?.total}
                  </div>
                </div>
              )}
            </div>

            {/* Batch Segment */}
            <div className="bg-surface-elevated border border-border rounded-lg p-3">
              <h4 className="font-medium text-sm mb-2">Segment</h4>
              <p className="text-xs text-secondary mb-3">
                Create segments for selected documents
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => handleBatchSegment('qa')}
                  disabled={getOperationStatus('segment') === 'in-progress'}
                  className="w-full px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 text-sm"
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
                  className="w-full px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm"
                >
                  {getOperationStatus('segment') === 'in-progress' ? (
                    <LoadingSpinner text="Segmenting..." />
                  ) : (
                    `Paragraphs Mode`
                  )}
                </button>
              </div>
              {getOperationStatus('segment') === 'in-progress' && (
                <div className="mt-2">
                  <div className="w-full bg-surface border border-border rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getOperationProgress('segment')?.percentage || 0}%` }}
                    />
                  </div>
                  <div className="text-xs text-secondary mt-1 text-center">
                    {getOperationProgress('segment')?.progress} / {getOperationProgress('segment')?.total}
                  </div>
                </div>
              )}
            </div>

            {/* Batch Export */}
            <div className="bg-surface-elevated border border-border rounded-lg p-3">
              <h4 className="font-medium text-sm mb-2">Export</h4>
              <p className="text-xs text-secondary mb-3">
                Export selected documents
              </p>
              <button
                onClick={handleBatchExport}
                disabled={getOperationStatus('export') === 'in-progress'}
                className="w-full px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 text-sm"
              >
                {getOperationStatus('export') === 'in-progress' ? (
                  <LoadingSpinner text="Exporting..." />
                ) : (
                  `Export ${selectedCount} Document${selectedCount > 1 ? 's' : ''}`
                )}
              </button>
              {getOperationStatus('export') === 'in-progress' && (
                <div className="mt-2">
                  <div className="w-full bg-surface border border-border rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${getOperationProgress('export')?.percentage || 0}%` }}
                    />
                  </div>
                  <div className="text-xs text-secondary mt-1 text-center">
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
        <div className="text-sm text-secondary">
          {selectedCount} document{selectedCount > 1 ? 's' : ''} selected. 
          <button 
            onClick={toggleBatchMode}
            className="text-primary hover:underline ml-2"
          >
            Enter batch mode
          </button>
        </div>
      )}
    </div>
  );
}
