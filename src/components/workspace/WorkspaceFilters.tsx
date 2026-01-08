/**
 * WorkspaceFilters Component
 * 
 * Provides filtering and search functionality for workspace segments including:
 * - Source filter (all/auto/manual)
 * - Folder filter
 * - Search input
 * - Filter presets
 * - Advanced filters (min/max length)
 * 
 * @module components/workspace/WorkspaceFilters
 */

import React from "react";
import { FILTER_PRESETS } from "../../lib/searchUtils";
import { FolderDTO } from "../../lib/segmentFolders";

export type SourceFilter = "all" | "auto" | "manual";

export interface WorkspaceFiltersProps {
  // Filters
  sourceFilter: SourceFilter;
  onSourceFilterChange: (filter: SourceFilter) => void;
  
  folderFilter: string;
  onFolderFilterChange: (filter: string) => void;
  
  // Search
  query: string;
  onQueryChange: (query: string) => void;
  
  // Advanced Filters
  advancedFiltersOpen: boolean;
  onToggleAdvancedFilters: () => void;
  
  minLength?: number;
  maxLength?: number;
  onMinLengthChange: (length?: number) => void;
  onMaxLengthChange: (length?: number) => void;
  
  activePreset: string;
  onPresetChange: (preset: string) => void;
  
  // Actions
  onFoldersOpen: () => void;
  onWizardOpen: () => void;
  
  // Data
  folders: FolderDTO[];
  filteredSegmentsCount: number;
  totalSegmentsCount: number;
}

/**
 * WorkspaceFilters - Filtering and search controls for workspace
 */
export default function WorkspaceFilters({
  sourceFilter,
  onSourceFilterChange,
  folderFilter,
  onFolderFilterChange,
  query,
  onQueryChange,
  advancedFiltersOpen,
  onToggleAdvancedFilters,
  minLength,
  maxLength,
  onMinLengthChange,
  onMaxLengthChange,
  activePreset,
  onPresetChange,
  onFoldersOpen,
  onWizardOpen,
  folders,
  filteredSegmentsCount,
  totalSegmentsCount,
}: WorkspaceFiltersProps) {
  
  const handleClear = () => {
    onQueryChange("");
    onMinLengthChange(undefined);
    onMaxLengthChange(undefined);
    onPresetChange("all");
  };

  const handlePresetChange = (preset: string) => {
    onPresetChange(preset);
    
    if (preset === "all") {
      onMinLengthChange(undefined);
      onMaxLengthChange(undefined);
      onSourceFilterChange("all");
    } else if (preset === "long") {
      onMinLengthChange(500);
      onMaxLengthChange(undefined);
    } else if (preset === "short") {
      onMinLengthChange(undefined);
      onMaxLengthChange(200);
    } else if (preset === "manual") {
      onSourceFilterChange("manual");
    } else if (preset === "auto") {
      onSourceFilterChange("auto");
    }
  };

  const hasActiveFilters = query || minLength !== undefined || maxLength !== undefined;

  return (
    <>
      {/* Main Filters Row */}
      <div className="mt-2 flex items-center gap-2 flex-wrap" style={{ 
        marginTop: 10, 
        display: "flex", 
        gap: 10, 
        alignItems: "center", 
        flexWrap: "wrap" 
      }}>
        {/* Source Filter */}
        <select
          value={sourceFilter}
          onChange={(e) => onSourceFilterChange(e.target.value as SourceFilter)}
          className="px-3 py-2 bg-surface border border-border rounded"
          style={{ 
            padding: "8px 10px", 
            fontSize: "var(--font-size-base)", 
            lineHeight: "var(--line-height-normal)" 
          }}
        >
          <option value="all">All chunks</option>
          <option value="auto">Auto only</option>
          <option value="manual">Manual only</option>
        </select>

        {/* Folder Filter */}
        <select
          value={folderFilter}
          onChange={(e) => onFolderFilterChange(e.target.value)}
          className="px-3 py-2 bg-surface border border-border rounded"
          style={{ 
            padding: "8px 10px", 
            fontSize: "var(--font-size-base)", 
            lineHeight: "var(--line-height-normal)" 
          }}
        >
          <option value="all">All folders</option>
          <option value="none">Unfoldered</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>

        {/* Folders Button */}
        <button 
          onClick={onFoldersOpen} 
          className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2" 
          style={{ 
            padding: "8px 10px", 
            fontSize: "var(--font-size-base)", 
            lineHeight: "var(--line-height-normal)" 
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          Folders
        </button>

        {/* Document Structure Button */}
        <button 
          onClick={onWizardOpen} 
          className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2" 
          style={{ 
            padding: "8px 10px", 
            fontSize: "var(--font-size-base)", 
            lineHeight: "var(--line-height-normal)" 
          }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          Document Structure
        </button>

        {/* Search Input */}
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="🔍 Search chunks..."
          className="flex-1 min-w-0 px-3 py-2 bg-surface border border-border rounded"
          style={{
            flex: "1 1 300px",
            minWidth: "200px",
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "#0f1420",
            color: "#eaeaea",
            fontSize: "var(--font-size-base)",
            lineHeight: "var(--line-height-normal)",
          }}
        />

        {/* Clear Button */}
        <button 
          onClick={handleClear} 
          disabled={!hasActiveFilters} 
          className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors" 
          style={{ 
            padding: "8px 10px", 
            fontSize: "var(--font-size-base)", 
            lineHeight: "var(--line-height-normal)", 
            opacity: hasActiveFilters ? 1 : 0.6 
          }}
          title="Clear all filters"
        >
          Clear
        </button>

        {/* Filter Presets */}
        <select
          value={activePreset}
          onChange={(e) => handlePresetChange(e.target.value)}
          className="px-3 py-2 bg-surface border border-border rounded"
          style={{ 
            padding: "8px 10px", 
            fontSize: "var(--font-size-base)", 
            lineHeight: "var(--line-height-normal)" 
          }}
          title="Filter presets"
        >
          {Object.entries(FILTER_PRESETS).map(([key, preset]) => (
            <option key={key} value={key}>{preset.name}</option>
          ))}
        </select>

        {/* Advanced Filters Toggle */}
        <button
          onClick={onToggleAdvancedFilters}
          className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2"
          style={{ 
            padding: "8px 10px",
            fontSize: "var(--font-size-base)",
            lineHeight: "var(--line-height-normal)",
            background: advancedFiltersOpen ? "rgba(99, 102, 241, 0.2)" : "rgba(255, 255, 255, 0.05)",
            borderColor: advancedFiltersOpen ? "rgba(99, 102, 241, 0.5)" : "rgba(255, 255, 255, 0.1)",
          }}
          title="Advanced filters"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
        </button>
      </div>

      {/* Advanced Filters Panel */}
      {advancedFiltersOpen && (
        <div
          style={{
            marginTop: 12,
            padding: 16,
            background: "rgba(0, 0, 0, 0.3)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 12,
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ 
              fontSize: "var(--font-size-sm)", 
              lineHeight: "var(--line-height-normal)", 
              fontWeight: 600, 
              color: "rgba(255, 255, 255, 0.7)" 
            }}>
              Min Length:
            </label>
            <input
              type="number"
              value={minLength ?? ""}
              onChange={(e) => onMinLengthChange(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="0"
              style={{
                width: 100,
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(0, 0, 0, 0.3)",
                color: "#eaeaea",
                fontSize: "var(--font-size-sm)",
                lineHeight: "var(--line-height-normal)",
              }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <label style={{ 
              fontSize: "var(--font-size-sm)", 
              lineHeight: "var(--line-height-normal)", 
              fontWeight: 600, 
              color: "rgba(255, 255, 255, 0.7)" 
            }}>
              Max Length:
            </label>
            <input
              type="number"
              value={maxLength ?? ""}
              onChange={(e) => onMaxLengthChange(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="∞"
              style={{
                width: 100,
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(0, 0, 0, 0.3)",
                color: "#eaeaea",
                fontSize: "var(--font-size-sm)",
                lineHeight: "var(--line-height-normal)",
              }}
            />
          </div>
          <div style={{ 
            fontSize: "var(--font-size-sm)", 
            lineHeight: "var(--line-height-normal)", 
            color: "rgba(255, 255, 255, 0.6)", 
            marginLeft: "auto" 
          }}>
            {filteredSegmentsCount} / {totalSegmentsCount} segments
          </div>
        </div>
      )}
    </>
  );
}

