/**
 * Folder management - Database-first architecture
 * localStorage is ONLY used for:
 * - Migration detection (checking if data exists)
 * - Read fallback (if API fails, read-only)
 * 
 * ALL WRITES go to database via API - no localStorage fallback for writes
 */

import {
  listFolders,
  getFolder,
  createFolder as apiCreateFolder,
  updateFolder as apiUpdateFolder,
  deleteFolder as apiDeleteFolder,
  createFolderItem,
  deleteFolderItem,
  type FolderDTO,
  type FolderItemDTO,
  type FolderWithItemsDTO,
} from "./api";
import { migrateDocumentToDatabase } from "./migrateToDatabase";

// Legacy types for backward compatibility
export type { FolderDTO };

// Legacy localStorage keys (for migration detection and read fallback only)
function keyFolders(docId: number) {
  return `aiorg_seg_folders_doc_${docId}`;
}

function keyMap(docId: number) {
  return `aiorg_seg_folder_map_doc_${docId}`;
}

/**
 * Ensure document is migrated to database before using API
 */
async function ensureMigrated(docId: number): Promise<void> {
  // Check if localStorage has data
  const hasFolders = localStorage.getItem(keyFolders(docId));
  const hasMap = localStorage.getItem(keyMap(docId));
  
  if (hasFolders || hasMap) {
    // Try to migrate (idempotent - won't duplicate if already migrated)
    try {
      await migrateDocumentToDatabase(docId);
    } catch (error) {
      console.warn("Migration failed, continuing with API:", error);
    }
  }
}

/**
 * Convert API FolderDTO to legacy format
 */
function apiToLegacyFolder(apiFolder: FolderDTO, items?: FolderItemDTO[]): FolderDTO & { contents: string[] } {
  const contents = items
    ? items.filter(item => item.chunkId).map(item => item.chunkId!).filter(Boolean)
    : [];
  
  return {
    id: String(apiFolder.id), // Convert number to string for backward compatibility
    name: apiFolder.name,
    createdAt: new Date(apiFolder.createdAt).getTime(),
    contents,
  };
}

/**
 * Load folders from API (database-first)
 * Read fallback to localStorage ONLY if API fails (read-only)
 */
export async function loadFolders(docId: number, skipCache: boolean = false): Promise<FolderDTO[]> {
  await ensureMigrated(docId);
  
  // If skipCache is true, clear cache before loading
  if (skipCache) {
    const { apiCache } = await import("./cache");
    const API_BASE = import.meta.env.VITE_API_BASE_URL?.toString() || "http://127.0.0.1:8000";
    // Clear all folder-related caches - be thorough to avoid stale data
    apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/documents/${docId}/folders`);
    apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders`);
    apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders/`);
  }
  
  try {
    const apiFolders = await listFolders(docId);
    
    // Convert to legacy format for backward compatibility
    return apiFolders.map(folder => ({
      id: String(folder.id),
      name: folder.name,
      createdAt: new Date(folder.createdAt).getTime(),
      contents: [], // Will be populated by getFolder if needed
    }));
  } catch (error) {
    console.error("Failed to load folders from API:", error);
    // Read-only fallback to localStorage (for offline/error scenarios)
    try {
      const raw = localStorage.getItem(keyFolders(docId));
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? (arr as FolderDTO[]) : [];
    } catch {
      return [];
    }
  }
}

/**
 * Save folders - DEPRECATED (folders are saved via API)
 * This is a no-op - kept for backward compatibility only
 */
export function saveFolders(_docId: number, _folders: FolderDTO[]) {
  // No-op - folders are now managed via API only
}

/**
 * Create a new folder via API (database-only)
 * Throws error if API fails - no localStorage fallback
 */
export async function createFolder(docId: number, name: string): Promise<FolderDTO> {
  await ensureMigrated(docId);
  
  try {
    const folder = await apiCreateFolder(docId, name);
    return folder;
  } catch (error) {
    console.error("❌ createFolder: API create failed", error);
    throw error;
  }
}

/**
 * Rename a folder via API (database-only)
 * Throws error if API fails - no localStorage fallback
 */
export async function renameFolder(docId: number, folderId: string, name: string): Promise<void> {
  await ensureMigrated(docId);
  
  // Database-only - throw error if API fails
  await apiUpdateFolder(parseInt(folderId, 10), name);
}

/**
 * Delete a folder via API (database-only)
 * Throws error if API fails - no localStorage fallback
 */
export async function deleteFolder(docId: number, folderId: string): Promise<void> {
  await ensureMigrated(docId);
  
  try {
    await apiDeleteFolder(parseInt(folderId, 10));
  } catch (error) {
    console.error("❌ deleteFolder: API delete failed", error);
    throw error;
  }
}

/**
 * Helper function to filter folders that have at least one item (segment or chunk)
 * This ensures empty folders (where all chunks were deleted) don't appear in the dropdown
 */
export function filterFoldersWithItems(
  folders: FolderDTO[],
  folderMap: Record<string, string>
): FolderDTO[] {
  return folders.filter(folder => {
    // Check if this folder has any items (segments or chunks) in the folderMap
    const folderId = folder.id;
    return Object.values(folderMap).some(mappedFolderId => mappedFolderId === folderId);
  });
}

/**
 * Load folder map (segment_id -> folder_id, chunk:chunkId -> folder_id) from API (database-first)
 * Read fallback to localStorage ONLY if API fails (read-only)
 * 
 * The folderMap maps:
 * - segmentId -> folderId (for regular segments)
 * - chunk:chunkId -> folderId (for duplicated chunks)
 */
export async function loadFolderMap(docId: number, skipCache: boolean = false): Promise<Record<string, string>> {
  await ensureMigrated(docId);
  
  // If skipCache is true, clear cache before loading
  if (skipCache) {
    const { apiCache } = await import("./cache");
    const API_BASE = import.meta.env.VITE_API_BASE_URL?.toString() || "http://127.0.0.1:8000";
    // Clear all folder-related caches - including individual folder caches
    apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/documents/${docId}/folders`);
    apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders`);
    apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders/`);
  }
  
  try {
    const folders = await listFolders(docId);
    const map: Record<string, string> = {};
    
    // Load items for each folder to build map
    // Clear individual folder cache before each getFolder call if skipCache is true
    for (const folder of folders) {
      try {
        if (skipCache) {
          // Clear this specific folder's cache before fetching to ensure fresh data
          const { apiCache } = await import("./cache");
          const API_BASE = import.meta.env.VITE_API_BASE_URL?.toString() || "http://127.0.0.1:8000";
          apiCache.delete(`cache:${API_BASE}/api/workspace/folders/${folder.id}`);
        }
        const folderWithItems = await getFolder(folder.id);
        for (const item of folderWithItems.items) {
          // Map segmentId to folderId (for regular segments)
          if (item.segmentId) {
            map[String(item.segmentId)] = String(folder.id);
          }
          // Also map chunkId to folderId (for duplicated chunks)
          // We use a special prefix to distinguish chunks from segments
          if (item.chunkId) {
            map[`chunk:${item.chunkId}`] = String(folder.id);
          }
        }
      } catch (error) {
        console.warn(`Failed to load items for folder ${folder.id}:`, error);
      }
    }
    
    return map;
  } catch (error) {
    console.error("Failed to load folder map from API:", error);
    // Read-only fallback to localStorage (for offline/error scenarios)
    try {
      const raw = localStorage.getItem(keyMap(docId));
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === "object" ? (obj as Record<string, string>) : {};
    } catch {
      return {};
    }
  }
}

/**
 * Save folder map - DEPRECATED (map is managed via API)
 * This is a no-op - kept for backward compatibility only
 */
export function saveFolderMap(_docId: number, _map: Record<string, string>) {
  // No-op - folder map is now managed via API only
}

/**
 * Set segment folder assignment via API (database-only)
 * Throws error if API fails - no localStorage fallback
 */
export async function setSegmentFolder(
  docId: number,
  segId: number,
  folderId: string | null
): Promise<void> {
  await ensureMigrated(docId);
  
  if (!folderId) {
    // Remove segment from all folders
    const folders = await listFolders(docId);
    for (const folder of folders) {
      try {
        const folderWithItems = await getFolder(folder.id);
        const item = folderWithItems.items.find(i => i.segmentId === segId);
        if (item) {
          await deleteFolderItem(item.id);
        }
      } catch (error) {
        console.warn(`Failed to remove segment from folder ${folder.id}:`, error);
      }
    }
  } else {
    // Add segment to folder
    // First, remove from other folders
    const folders = await listFolders(docId);
    for (const folder of folders) {
      if (String(folder.id) !== folderId) {
        try {
          const folderWithItems = await getFolder(folder.id);
          const item = folderWithItems.items.find(i => i.segmentId === segId);
          if (item) {
            await deleteFolderItem(item.id);
          }
        } catch (error) {
          console.warn(`Failed to remove segment from folder ${folder.id}:`, error);
        }
      }
    }
    
    // Then add to target folder (database-only)
    await createFolderItem({
      folderId: parseInt(folderId, 10),
      segmentId: segId,
    });
  }
}

/**
 * Get folder ID for a segment (database-first)
 */
export async function getSegmentFolderId(docId: number, segId: number): Promise<string | null> {
  const map = await loadFolderMap(docId);
  return map[String(segId)] ?? null;
}

/**
 * Add a duplicated chunk to a folder via API (database-only)
 * Throws error if API fails - no localStorage fallback
 */
export async function addChunkToFolder(
  docId: number,
  folderId: string,
  chunkId: string,
  chunkData?: {
    title?: string;
    content?: string;
    mode?: string;
    isManual?: boolean;
    orderIndex?: number;
  }
): Promise<void> {
  await ensureMigrated(docId);
  
  // Database-only - throw error if API fails
  await createFolderItem({
    folderId: parseInt(folderId, 10),
    chunkId,
    chunkTitle: chunkData?.title,
    chunkContent: chunkData?.content,
    chunkMode: chunkData?.mode,
    chunkIsManual: chunkData?.isManual,
    chunkOrderIndex: chunkData?.orderIndex,
  });
}

/**
 * Remove a duplicated chunk from a folder via API (database-only)
 * Throws error if API fails - no localStorage fallback
 */
export async function removeChunkFromFolder(
  docId: number,
  folderId: string,
  chunkId: string
): Promise<void> {
  await ensureMigrated(docId);
  
  // Database-only - handle gracefully if chunk not found (may have been already deleted)
  try {
    const folderWithItems = await getFolder(parseInt(folderId, 10));
    const item = folderWithItems.items.find(i => i.chunkId === chunkId);
    if (item) {
      await deleteFolderItem(item.id);
    } else {
      // Chunk not found - may have been already deleted, just return (no-op)
      // This is not an error condition - the chunk is already removed
      return;
    }
  } catch (error) {
    // If folder doesn't exist or other error, log but don't throw
    // The chunk removal is idempotent - if it's already gone, that's fine
    console.warn(`Failed to remove chunk ${chunkId} from folder ${folderId}:`, error);
    return;
  }
}
