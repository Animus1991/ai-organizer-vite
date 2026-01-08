/**
 * WorkspaceToolbar Component
 * 
 * Provides the main toolbar for workspace actions including:
 * - Mode selection (qa/paragraphs)
 * - Segment operations (list, segment, delete)
 * - Manual chunk creation
 * - Export functionality
 * - Document Notes and Smart Notes access
 * 
 * @module components/workspace/WorkspaceToolbar
 */

import React from "react";
import { SegmentDTO } from "../../lib/api";
import { 
  exportSegmentsToJSON, 
  exportSegmentsToCSV, 
  exportSegmentsToTXT, 
  exportSegmentsToMD,
  downloadFile 
} from "../../lib/exportUtils";
import { loadSmartNotes } from "../../lib/documentWorkspace/smartNotes";

export interface WorkspaceToolbarProps {
  // Mode
  mode: "qa" | "paragraphs";
  onModeChange: (mode: "qa" | "paragraphs") => void;
  
  // Actions
  onListSegments: () => void;
  onSegmentNow: () => void;
  onDeleteModeSegments: () => void;
  onManualChunk: () => void;
  
  // Export
  filteredSegments: SegmentDTO[];
  docId: number;
  
  // Notes
  notesOpen: boolean;
  onToggleNotes: () => void;
  smartNotesOpen: boolean;
  onToggleSmartNotes: () => void;
  smartNotesCount: number;
  onLoadSmartNotes: () => void;
  onCreateNewSmartNote: () => void;
  
  // Status
  canSegment: boolean;
  parseStatus?: string;
}

/**
 * WorkspaceToolbar - Main toolbar for workspace actions
 */
export default function WorkspaceToolbar({
  mode,
  onModeChange,
  onListSegments,
  onSegmentNow,
  onDeleteModeSegments,
  onManualChunk,
  filteredSegments,
  docId,
  notesOpen,
  onToggleNotes,
  smartNotesOpen,
  onToggleSmartNotes,
  smartNotesCount,
  onLoadSmartNotes,
  onCreateNewSmartNote,
  canSegment,
  parseStatus,
}: WorkspaceToolbarProps) {
  
  const handleExportMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const menu = document.getElementById('export-segments-menu');
    if (menu) {
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
  };

  const handleExport = (format: 'json' | 'csv' | 'txt' | 'md') => {
    const menu = document.getElementById('export-segments-menu');
    if (menu) menu.style.display = 'none';

    let content: string;
    let filename: string;
    let mimeType: string;

    switch (format) {
      case 'json':
        content = exportSegmentsToJSON(filteredSegments, { format: 'json', includeMetadata: true });
        filename = `segments_${docId}_${mode}_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
        break;
      case 'csv':
        content = exportSegmentsToCSV(filteredSegments);
        filename = `segments_${docId}_${mode}_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
        break;
      case 'txt':
        content = exportSegmentsToTXT(filteredSegments, { format: 'txt', includeMetadata: true });
        filename = `segments_${docId}_${mode}_${new Date().toISOString().split('T')[0]}.txt`;
        mimeType = 'text/plain';
        break;
      case 'md':
        content = exportSegmentsToMD(filteredSegments, { format: 'md', includeMetadata: true });
        filename = `segments_${docId}_${mode}_${new Date().toISOString().split('T')[0]}.md`;
        mimeType = 'text/markdown';
        break;
    }

    downloadFile(content, filename, mimeType);
  };

  const handleSmartNotesToggle = () => {
    if (!smartNotesOpen) {
      onLoadSmartNotes();
      onCreateNewSmartNote();
    }
    onToggleSmartNotes();
  };

  return (
    <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      {/* Mode Selector */}
      <label style={{ 
        opacity: 0.85, 
        fontSize: "var(--font-size-base)", 
        lineHeight: "var(--line-height-normal)", 
        color: "rgba(255, 255, 255, 0.7)", 
        fontWeight: 500 
      }}>
        Mode:
      </label>
      <select
        value={mode}
        onChange={(e) => onModeChange(e.target.value as "qa" | "paragraphs")}
        style={{
          padding: "10px 14px",
          background: "rgba(0, 0, 0, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "10px",
          color: "#eaeaea",
          fontSize: "var(--font-size-base)",
          lineHeight: "var(--line-height-normal)",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.5)";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        <option value="qa">qa</option>
        <option value="paragraphs">paragraphs</option>
      </select>

      {/* List Segments Button */}
      <button
        onClick={onListSegments}
        disabled={!canSegment}
        style={{
          padding: "10px 16px",
          background: canSegment ? "rgba(255, 255, 255, 0.05)" : "rgba(107, 114, 128, 0.3)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "10px",
          color: "#eaeaea",
          fontWeight: 600,
          fontSize: "var(--font-size-base)",
          lineHeight: "var(--line-height-normal)",
          cursor: canSegment ? "pointer" : "not-allowed",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          transition: "all 0.2s ease",
          opacity: canSegment ? 1 : 0.6,
        }}
        title={!canSegment ? "parseStatus must be ok." : ""}
        onMouseEnter={(e) => {
          if (canSegment) {
            e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = canSegment ? "rgba(255, 255, 255, 0.05)" : "rgba(107, 114, 128, 0.3)";
          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
          e.currentTarget.style.transform = "translateY(0)";
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        List segments
      </button>

      {/* Segment Now Button */}
      <button
        onClick={onSegmentNow}
        disabled={!canSegment}
        style={{
          padding: "10px 16px",
          background: canSegment ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : "rgba(107, 114, 128, 0.3)",
          border: "none",
          borderRadius: "10px",
          color: "white",
          fontWeight: 600,
          fontSize: "var(--font-size-base)",
          lineHeight: "var(--line-height-normal)",
          cursor: canSegment ? "pointer" : "not-allowed",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          transition: "all 0.2s ease",
          boxShadow: canSegment ? "0 2px 8px rgba(99, 102, 241, 0.3)" : "none",
          opacity: canSegment ? 1 : 0.6,
        }}
        title={!canSegment ? "parseStatus must be ok." : ""}
        onMouseEnter={(e) => {
          if (canSegment) {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.4)";
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = canSegment ? "0 2px 8px rgba(99, 102, 241, 0.3)" : "none";
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        Segment now
      </button>

      {/* Delete Mode Segments Button */}
      <button
        onClick={onDeleteModeSegments}
        style={{
          padding: "10px 16px",
          background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
          border: "none",
          borderRadius: "10px",
          color: "white",
          fontWeight: 600,
          fontSize: "var(--font-size-base)",
          lineHeight: "var(--line-height-normal)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          transition: "all 0.2s ease",
          boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.4)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 2px 8px rgba(239, 68, 68, 0.3)";
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete mode segments
      </button>

      {/* Manual Chunk Button */}
      <button
        onClick={onManualChunk}
        className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2"
        style={{ 
          padding: "8px 10px",
          fontSize: "var(--font-size-base)",
          lineHeight: "var(--line-height-normal)",
        }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Manual chunk
      </button>

      {/* Export Button with Dropdown */}
      <div style={{ position: "relative" }}>
        <button
          onClick={handleExportMenuToggle}
          disabled={filteredSegments.length === 0}
          className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2"
          style={{ 
            padding: "8px 10px",
            fontSize: "var(--font-size-base)",
            lineHeight: "var(--line-height-normal)",
            opacity: filteredSegments.length === 0 ? 0.5 : 1,
            cursor: filteredSegments.length === 0 ? "not-allowed" : "pointer",
          }}
          title={`Export ${filteredSegments.length} segment(s)`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export ({filteredSegments.length})
        </button>
        <div
          id="export-segments-menu"
          style={{
            display: "none",
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: "8px",
            background: "rgba(20, 20, 30, 0.95)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "12px",
            padding: "8px",
            minWidth: "180px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
            zIndex: 1000,
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.display = "none";
          }}
        >
          <button
            onClick={() => handleExport('json')}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderRadius: "8px",
              color: "#eaeaea",
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
              textAlign: "left",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Export as JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderRadius: "8px",
              color: "#eaeaea",
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
              textAlign: "left",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Export as CSV
          </button>
          <button
            onClick={() => handleExport('txt')}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderRadius: "8px",
              color: "#eaeaea",
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
              textAlign: "left",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Export as TXT
          </button>
          <button
            onClick={() => handleExport('md')}
            style={{
              width: "100%",
              padding: "10px 16px",
              background: "transparent",
              border: "none",
              borderRadius: "8px",
              color: "#eaeaea",
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
              textAlign: "left",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            Export as Markdown
          </button>
        </div>
      </div>

      {/* Document Notes Button */}
      <button 
        onClick={onToggleNotes} 
        className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2" 
        style={{ 
          padding: "8px 10px",
          fontSize: "var(--font-size-base)",
          lineHeight: "var(--line-height-normal)",
        }}
        title="Document Notes - Write and save notes about this document"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        {notesOpen ? "Hide Document Notes" : "Document Notes"}
      </button>
      
      {/* Smart Notes Button */}
      <button 
        onClick={handleSmartNotesToggle} 
        className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2" 
        style={{ 
          padding: "8px 10px",
          fontSize: "var(--font-size-base)",
          lineHeight: "var(--line-height-normal)",
        }}
        title="Smart Notes - Organize your thoughts with tags and categories. Create multiple notes, search and filter them easily."
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {smartNotesOpen ? "Hide Smart Notes" : `Smart Notes (${smartNotesCount})`}
      </button>
    </div>
  );
}

