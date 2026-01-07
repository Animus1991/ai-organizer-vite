// src/lib/searchUtils.ts
// Search and highlighting utilities

export interface SearchHighlight {
  text: string;
  highlighted: boolean;
}

/**
 * Highlights search query in text
 */
export function highlightSearch(text: string, query: string): SearchHighlight[] {
  if (!query || !text) {
    return [{ text, highlighted: false }];
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: SearchHighlight[] = [];
  let lastIndex = 0;
  let index = lowerText.indexOf(lowerQuery, lastIndex);

  while (index !== -1) {
    // Add text before match
    if (index > lastIndex) {
      parts.push({ text: text.substring(lastIndex, index), highlighted: false });
    }

    // Add highlighted match
    parts.push({ text: text.substring(index, index + query.length), highlighted: true });

    lastIndex = index + query.length;
    index = lowerText.indexOf(lowerQuery, lastIndex);
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({ text: text.substring(lastIndex), highlighted: false });
  }

  return parts.length > 0 ? parts : [{ text, highlighted: false }];
}

/**
 * Truncates text with ellipsis, preserving search highlights
 */
export function truncateWithHighlight(
  text: string,
  query: string,
  maxLength: number = 150
): { parts: SearchHighlight[]; truncated: boolean } {
  if (text.length <= maxLength) {
    return { parts: highlightSearch(text, query), truncated: false };
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const queryIndex = lowerText.indexOf(lowerQuery);

  if (queryIndex === -1) {
    // No match, just truncate
    return {
      parts: [{ text: text.substring(0, maxLength) + "...", highlighted: false }],
      truncated: true
    };
  }

  // Try to center the match
  const start = Math.max(0, queryIndex - Math.floor(maxLength / 2));
  const end = Math.min(text.length, start + maxLength);
  const truncated = start > 0 || end < text.length;

  let displayText = text.substring(start, end);
  if (start > 0) displayText = "..." + displayText;
  if (end < text.length) displayText = displayText + "...";

  // Adjust query index for truncated text
  const adjustedQueryIndex = queryIndex - start + (start > 0 ? 3 : 0);

  return {
    parts: highlightSearch(displayText, query),
    truncated
  };
}

/**
 * Advanced search filters
 */
export interface SegmentFilters {
  query?: string;
  mode?: "qa" | "paragraphs" | "all";
  source?: "all" | "auto" | "manual";
  folderId?: string | "all" | "none";
  minLength?: number;
  maxLength?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

export function filterSegments<T extends { 
  title?: string | null; 
  content?: string | null; 
  mode?: string;
  isManual?: boolean;
  id: number;
  createdAt?: string | Date;
}>(segments: T[], filters: SegmentFilters): T[] {
  let filtered = [...segments];

  // Query search
  if (filters.query) {
    const q = filters.query.toLowerCase().trim();
    filtered = filtered.filter((s) => {
      const title = (s.title ?? "").toLowerCase();
      const content = (s.content ?? "").toLowerCase();
      return title.includes(q) || content.includes(q);
    });
  }

  // Mode filter
  if (filters.mode && filters.mode !== "all") {
    filtered = filtered.filter((s) => s.mode === filters.mode);
  }

  // Source filter
  if (filters.source && filters.source !== "all") {
    if (filters.source === "manual") {
      filtered = filtered.filter((s) => s.isManual === true);
    } else {
      filtered = filtered.filter((s) => s.isManual !== true);
    }
  }

  // Folder filter
  if (filters.folderId && filters.folderId !== "all") {
    // This requires folderMap, so we'll handle it in the component
  }

  // Length filters
  if (filters.minLength !== undefined) {
    filtered = filtered.filter((s) => {
      const length = (s.content ?? "").length;
      return length >= filters.minLength!;
    });
  }

  if (filters.maxLength !== undefined) {
    filtered = filtered.filter((s) => {
      const length = (s.content ?? "").length;
      return length <= filters.maxLength!;
    });
  }

  // Date filters
  if (filters.dateFrom) {
    filtered = filtered.filter((s) => {
      if (!s.createdAt) return false;
      const date = typeof s.createdAt === "string" ? new Date(s.createdAt) : s.createdAt;
      return date >= filters.dateFrom!;
    });
  }

  if (filters.dateTo) {
    filtered = filtered.filter((s) => {
      if (!s.createdAt) return false;
      const date = typeof s.createdAt === "string" ? new Date(s.createdAt) : s.createdAt;
      return date <= filters.dateTo!;
    });
  }

  return filtered;
}

/**
 * Filter presets
 */
export const FILTER_PRESETS = {
  all: { name: "All Segments", filters: {} },
  recent: { 
    name: "Recent", 
    filters: { 
      dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    } 
  },
  long: { 
    name: "Long Segments", 
    filters: { 
      minLength: 500 
    } 
  },
  short: { 
    name: "Short Segments", 
    filters: { 
      maxLength: 200 
    } 
  },
  manual: { 
    name: "Manual Only", 
    filters: { 
      source: "manual" as const 
    } 
  },
  auto: { 
    name: "Auto Only", 
    filters: { 
      source: "auto" as const 
    } 
  },
} as const;

