/**
 * Workspace Components
 * 
 * Centralized exports for workspace-related components.
 * This follows the barrel export pattern for better organization.
 * 
 * @module components/workspace
 */

export { default as WorkspaceToolbar } from './WorkspaceToolbar';
export type { WorkspaceToolbarProps } from './WorkspaceToolbar';

export { default as WorkspaceFilters } from './WorkspaceFilters';
export type { WorkspaceFiltersProps, SourceFilter } from './WorkspaceFilters';

export { default as DocumentEditModal } from './DocumentEditModal';
export type { DocumentEditModalProps } from './DocumentEditModal';

export { default as DocumentNotesModal } from './DocumentNotesModal';
export type { DocumentNotesModalProps } from './DocumentNotesModal';

export { default as ManualChunkModal } from './ManualChunkModal';
export type { ManualChunkModalProps } from './ManualChunkModal';

export { default as ChunkEditModal } from './ChunkEditModal';
export type { ChunkEditModalProps } from './ChunkEditModal';

export { SmartNotesModal } from './SmartNotesModal';
export type { SmartNotesModalProps } from './SmartNotesModal';

export { SegmentList } from './SegmentList';
export type { SegmentListProps } from './SegmentList';

