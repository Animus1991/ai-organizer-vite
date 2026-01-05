// src/hooks/useBatchOperations.ts
import { useState, useCallback } from 'react';
import type { UploadItemDTO } from '../lib/api';

interface BatchOperation {
  id: string;
  type: 'delete' | 'segment' | 'export';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress?: number;
  total?: number;
  error?: string;
}

export function useBatchOperations() {
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [operations, setOperations] = useState<BatchOperation[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);

  const toggleSelection = useCallback((documentId: number) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((documentIds: number[]) => {
    setSelectedItems(new Set(documentIds));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const toggleBatchMode = useCallback(() => {
    setIsBatchMode(prev => !prev);
    if (!isBatchMode) {
      clearSelection();
    }
  }, [isBatchMode, clearSelection]);

  const addOperation = useCallback((operation: Omit<BatchOperation, 'id'>) => {
    const id = Date.now().toString();
    setOperations(prev => [...prev, { ...operation, id }]);
    return id;
  }, []);

  const updateOperation = useCallback((id: string, updates: Partial<BatchOperation>) => {
    setOperations(prev => prev.map(op => 
      op.id === id ? { ...op, ...updates } : op
    ));
  }, []);

  const removeOperation = useCallback((id: string) => {
    setOperations(prev => prev.filter(op => op.id !== id));
  }, []);

  const batchDelete = useCallback(async (documents: UploadItemDTO[]) => {
    const operationId = addOperation({
      type: 'delete',
      status: 'pending',
      total: documents.length
    });

    try {
      updateOperation(operationId, { status: 'in-progress' });
      
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        
        try {
          // Simulate API call - replace with actual delete
          await new Promise(resolve => setTimeout(resolve, 500));
          
          updateOperation(operationId, { 
            progress: i + 1,
            status: i === documents.length - 1 ? 'completed' : 'in-progress'
          });
        } catch (error) {
          updateOperation(operationId, { 
            status: 'failed',
            error: error instanceof Error ? error.message : 'Delete failed'
          });
          return;
        }
      }
      
      clearSelection();
    } catch (error) {
      updateOperation(operationId, { 
        status: 'failed',
        error: error instanceof Error ? error.message : 'Batch delete failed'
      });
    }
  }, [addOperation, updateOperation, clearSelection]);

  const batchSegment = useCallback(async (documents: UploadItemDTO[], mode: 'qa' | 'paragraphs') => {
    const operationId = addOperation({
      type: 'segment',
      status: 'pending',
      total: documents.length
    });

    try {
      updateOperation(operationId, { status: 'in-progress' });
      
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        
        try {
          // Simulate API call - replace with actual segmentation
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          updateOperation(operationId, { 
            progress: i + 1,
            status: i === documents.length - 1 ? 'completed' : 'in-progress'
          });
        } catch (error) {
          updateOperation(operationId, { 
            status: 'failed',
            error: error instanceof Error ? error.message : 'Segmentation failed'
          });
          return;
        }
      }
      
      clearSelection();
    } catch (error) {
      updateOperation(operationId, { 
        status: 'failed',
        error: error instanceof Error ? error.message : 'Batch segmentation failed'
      });
    }
  }, [addOperation, updateOperation, clearSelection]);

  const batchExport = useCallback(async (documents: UploadItemDTO[], segmentsMap: Map<number, any[]>) => {
    const operationId = addOperation({
      type: 'export',
      status: 'pending',
      total: documents.length
    });

    try {
      updateOperation(operationId, { status: 'in-progress' });
      
      // Simulate export - replace with actual export
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      updateOperation(operationId, { 
        progress: documents.length,
        status: 'completed'
      });
      
      clearSelection();
    } catch (error) {
      updateOperation(operationId, { 
        status: 'failed',
        error: error instanceof Error ? error.message : 'Batch export failed'
      });
    }
  }, [addOperation, updateOperation, clearSelection]);

  const getSelectedDocuments = useCallback((allDocuments: UploadItemDTO[]) => {
    return allDocuments.filter(doc => selectedItems.has(doc.documentId));
  }, [selectedItems]);

  const hasActiveOperations = operations.some(op => 
    op.status === 'pending' || op.status === 'in-progress'
  );

  return {
    // Selection state
    selectedItems,
    isBatchMode,
    selectedCount: selectedItems.size,
    
    // Selection actions
    toggleSelection,
    selectAll,
    clearSelection,
    toggleBatchMode,
    
    // Batch operations
    operations,
    hasActiveOperations,
    batchDelete,
    batchSegment,
    batchExport,
    getSelectedDocuments,
    
    // Helpers
    isSelected: (documentId: number) => selectedItems.has(documentId),
  };
}
