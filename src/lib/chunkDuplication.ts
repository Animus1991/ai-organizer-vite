/**
 * Duplicated Chunks Management
 * 
 * Architecture:
 * - Duplicated chunks are stored in localStorage (temporary workspace copies)
 * - When added to folders, they are stored in database via folder_items API
 * - This allows users to create temporary copies without cluttering the database
 * - Only chunks in folders are persisted to database
 */

import { SegmentDTO } from "./api";

export type DuplicatedChunk = {
  id: string; // UUID for the duplicated chunk
  originalId: number; // Reference to original segment
  title: string; // Modified title with suffix
  content: string; // Duplicated content
  mode: string; // Original mode
  isManual: boolean; // Original isManual flag
  orderIndex: number; // Original orderIndex
  createdAt: number; // When this duplicate was created
  documentId: number; // Document this belongs to
};

export type RecycledChunk = {
  id: string; // UUID for recycled item
  originalChunkId: string | number; // Either duplicated chunk id or original segment id
  title: string; // Title at time of deletion
  content: string; // Content at time of deletion
  mode: string; // Mode at time of deletion
  isManual: boolean; // isManual flag at time of deletion
  deletedAt: number; // When this was deleted
  documentId: number; // Document this belongs to
};

// Storage keys (localStorage only - these are temporary workspace copies)
function keyDuplicatedChunks(docId: number) {
  return `aiorg_duplicated_chunks_doc_${docId}`;
}

function keyRecycledChunks(docId: number) {
  return `aiorg_recycled_chunks_doc_${docId}`;
}

function uid() {
  return Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
}

// Generate unique title with suffix
function generateUniqueTitle(baseTitle: string, existingTitles: string[]): string {
  if (!existingTitles.includes(baseTitle)) {
    return baseTitle;
  }

  let suffix = 1;
  let newTitle: string;
  
  do {
    newTitle = `${baseTitle} (${suffix})`;
    suffix++;
  } while (existingTitles.includes(newTitle));

  return newTitle;
}

/**
 * Load duplicated chunks from localStorage
 * These are temporary workspace copies - not persisted to database
 */
export function loadDuplicatedChunks(docId: number): DuplicatedChunk[] {
  try {
    const raw = localStorage.getItem(keyDuplicatedChunks(docId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as DuplicatedChunk[]) : [];
  } catch {
    return [];
  }
}

/**
 * Save duplicated chunks to localStorage
 * These are temporary workspace copies - not persisted to database
 * When added to folders, they are stored in database via folder_items API
 */
export function saveDuplicatedChunks(docId: number, chunks: DuplicatedChunk[]) {
  localStorage.setItem(keyDuplicatedChunks(docId), JSON.stringify(chunks));
}

/**
 * Create duplicate of a segment (localStorage only - temporary workspace copy)
 * When added to folder, it will be persisted to database via folder_items API
 */
export function duplicateSegment(segment: SegmentDTO, docId: number): DuplicatedChunk {
  const existingChunks = loadDuplicatedChunks(docId);
  const existingTitles = existingChunks.map(c => c.title);
  
  const uniqueTitle = generateUniqueTitle(segment.title || "Untitled", existingTitles);
  
  const duplicate: DuplicatedChunk = {
    id: uid(),
    originalId: segment.id,
    title: uniqueTitle,
    content: segment.content || "",
    mode: segment.mode,
    isManual: segment.isManual || false,
    orderIndex: segment.orderIndex || 0,
    createdAt: Date.now(),
    documentId: docId
  };

  const updatedChunks = [duplicate, ...existingChunks];
  saveDuplicatedChunks(docId, updatedChunks);
  
  return duplicate;
}

/**
 * Load recycled chunks from localStorage
 */
export function loadRecycledChunks(docId: number): RecycledChunk[] {
  try {
    const raw = localStorage.getItem(keyRecycledChunks(docId));
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as RecycledChunk[]) : [];
  } catch {
    return [];
  }
}

/**
 * Save recycled chunks to localStorage
 */
export function saveRecycledChunks(docId: number, chunks: RecycledChunk[]) {
  localStorage.setItem(keyRecycledChunks(docId), JSON.stringify(chunks));
}

/**
 * Delete a duplicated chunk (move to recycle bin)
 * Note: If chunk is in a folder, it should be removed from folder first via API
 */
export function deleteDuplicatedChunk(docId: number, chunkId: string) {
  const chunks = loadDuplicatedChunks(docId);
  const chunkToDelete = chunks.find(c => c.id === chunkId);
  
  if (chunkToDelete) {
    // Move to recycle bin
    const recycledChunks = loadRecycledChunks(docId);
    const recycledChunk: RecycledChunk = {
      id: uid(),
      originalChunkId: chunkId,
      title: chunkToDelete.title,
      content: chunkToDelete.content,
      mode: chunkToDelete.mode,
      isManual: chunkToDelete.isManual,
      deletedAt: Date.now(),
      documentId: docId
    };
    
    const updatedRecycled = [recycledChunk, ...recycledChunks];
    saveRecycledChunks(docId, updatedRecycled);
    
    // Remove from duplicated chunks
    const updatedChunks = chunks.filter(c => c.id !== chunkId);
    saveDuplicatedChunks(docId, updatedChunks);
  }
}

/**
 * Restore a chunk from recycle bin
 */
export function restoreChunk(docId: number, recycledId: string) {
  const recycledChunks = loadRecycledChunks(docId);
  const chunkToRestore = recycledChunks.find(c => c.id === recycledId);
  
  if (chunkToRestore) {
    // Restore to duplicated chunks
    const duplicatedChunks = loadDuplicatedChunks(docId);
    const restoredChunk: DuplicatedChunk = {
      id: chunkToRestore.originalChunkId as string,
      originalId: 0, // We don't track this after restore
      title: chunkToRestore.title,
      content: chunkToRestore.content,
      mode: chunkToRestore.mode,
      isManual: chunkToRestore.isManual,
      orderIndex: 0,
      createdAt: Date.now(),
      documentId: docId
    };
    
    const updatedDuplicated = [restoredChunk, ...duplicatedChunks];
    saveDuplicatedChunks(docId, updatedDuplicated);
    
    // Remove from recycle bin
    const updatedRecycled = recycledChunks.filter(c => c.id !== recycledId);
    saveRecycledChunks(docId, updatedRecycled);
  }
}

/**
 * Permanently delete a chunk from recycle bin
 */
export function permanentlyDeleteChunk(docId: number, recycledId: string) {
  const recycledChunks = loadRecycledChunks(docId);
  const updatedRecycled = recycledChunks.filter(c => c.id !== recycledId);
  saveRecycledChunks(docId, updatedRecycled);
}

/**
 * Auto-cleanup expired chunks (older than 30 days)
 */
export function cleanupExpiredChunks(docId: number) {
  const recycledChunks = loadRecycledChunks(docId);
  const now = Date.now();
  const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
  
  const validChunks = recycledChunks.filter(chunk => {
    return (now - chunk.deletedAt) <= thirtyDaysInMs;
  });
  
  if (validChunks.length !== recycledChunks.length) {
    saveRecycledChunks(docId, validChunks);
  }
  
  return recycledChunks.length - validChunks.length; // Number of chunks cleaned up
}
