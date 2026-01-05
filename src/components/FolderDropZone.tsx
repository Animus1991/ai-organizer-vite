// src/components/FolderDropZone.tsx
import React from 'react';
import { FolderDTO } from '../lib/segmentFolders';

type Props = {
  folder: FolderDTO | null; // null for "No folder"
  onDrop: (folderId: string | null) => void;
  onDragOver: (folderId: string | null) => void;
  isDragOver: boolean;
  draggedSegment: any;
};

export default function FolderDropZone({ folder, onDrop, onDragOver, isDragOver, draggedSegment }: Props) {
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    onDragOver(folder?.id || null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDrop(folder?.id || null);
  };

  const handleDragLeave = () => {
    onDragOver(null);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragLeave={handleDragLeave}
      className={`border-2 border-dashed rounded-lg p-4 transition-all duration-200 ${
        isDragOver 
          ? 'border-primary bg-primary/10 scale-105' 
          : 'border-border/30 hover:border-border/60'
      } ${!draggedSegment ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3">
        {folder ? (
          <>
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-primary">{folder.name}</p>
              <p className="text-sm text-secondary">
                {isDragOver ? 'Drop segment here' : 'Drag segment here to add'}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-8 h-8 bg-surface-elevated border border-border rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-primary">No Folder</p>
              <p className="text-sm text-secondary">
                {isDragOver ? 'Drop to remove from folder' : 'Drag segment here to unassign'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
