/**
 * Smart Notes functionality - Database-first architecture
 * localStorage is ONLY used for:
 * - Migration detection (checking if data exists)
 * - Read fallback (if API fails, read-only)
 * 
 * ALL WRITES go to database via API - no localStorage fallback for writes
 */

import {
  listSmartNotes,
  createSmartNote as apiCreateSmartNote,
  updateSmartNote as apiUpdateSmartNote,
  deleteSmartNote as apiDeleteSmartNote,
  type SmartNoteDTO,
} from "../api";
import { migrateDocumentToDatabase } from "../migrateToDatabase";

// Legacy interface for backward compatibility
export interface SmartNote {
  id: string;
  content: string;
  html: string;
  tags: string[];
  category: string;
  timestamp: string;
  chunkId?: number;
  priority?: 'low' | 'medium' | 'high';
}

// Legacy localStorage key (for migration detection and read fallback only)
function keySmartNotes(docId: number) {
  return `smart_notes_${docId}`;
}

/**
 * Convert API SmartNoteDTO to legacy format
 */
function apiToLegacyNote(apiNote: SmartNoteDTO): SmartNote {
  return {
    id: String(apiNote.id),
    content: apiNote.content,
    html: apiNote.html,
    tags: apiNote.tags,
    category: apiNote.category,
    timestamp: apiNote.createdAt,
    chunkId: apiNote.chunkId ?? undefined,
    priority: apiNote.priority as 'low' | 'medium' | 'high' | undefined,
  };
}

/**
 * Convert legacy SmartNote to API format
 */
function legacyToApiNote(note: Omit<SmartNote, 'id' | 'timestamp'>): {
  content: string;
  html: string;
  tags: string[];
  category: string;
  priority: string;
  chunkId?: number | null;
} {
  return {
    content: note.content,
    html: note.html,
    tags: note.tags || [],
    category: note.category || 'General',
    priority: note.priority || 'medium',
    chunkId: note.chunkId ?? null,
  };
}

/**
 * Ensure document is migrated to database before using API
 */
async function ensureMigrated(docId: number): Promise<void> {
  const hasNotes = localStorage.getItem(keySmartNotes(docId));
  
  if (hasNotes) {
    try {
      await migrateDocumentToDatabase(docId);
    } catch (error) {
      console.warn("Migration failed, continuing with API:", error);
    }
  }
}

/**
 * Save a new smart note via API (database-only)
 * Throws error if API fails - no localStorage fallback
 */
export async function saveSmartNote(
  note: Omit<SmartNote, 'id' | 'timestamp'>,
  docId: number
): Promise<SmartNote> {
  await ensureMigrated(docId);
  
  // Database-only - throw error if API fails
  const apiNote = await apiCreateSmartNote({
    documentId: docId,
    ...legacyToApiNote(note),
  });
  return apiToLegacyNote(apiNote);
}

/**
 * Load all smart notes for a document from API (database-first)
 * Read fallback to localStorage ONLY if API fails (read-only)
 */
export async function loadSmartNotes(docId: number): Promise<SmartNote[]> {
  await ensureMigrated(docId);
  
  try {
    const apiNotes = await listSmartNotes(docId);
    return apiNotes.map(apiToLegacyNote);
  } catch (error) {
    console.error("Failed to load smart notes from API:", error);
    // Read-only fallback to localStorage (for offline/error scenarios)
    try {
      return JSON.parse(localStorage.getItem(keySmartNotes(docId)) || '[]');
    } catch {
      return [];
    }
  }
}

/**
 * Update an existing smart note via API (database-only)
 * Throws error if API fails - no localStorage fallback
 */
export async function updateSmartNote(
  docId: number,
  noteId: string,
  updates: Partial<SmartNote>
): Promise<SmartNote | null> {
  await ensureMigrated(docId);
  
  // Database-only - throw error if API fails
  const apiNote = await apiUpdateSmartNote(parseInt(noteId, 10), {
    content: updates.content,
    html: updates.html,
    tags: updates.tags,
    category: updates.category,
    priority: updates.priority,
    chunkId: updates.chunkId ?? null,
  });
  return apiToLegacyNote(apiNote);
}

/**
 * Delete a smart note via API (database-only)
 * Throws error if API fails - no localStorage fallback
 */
export async function deleteSmartNote(docId: number, noteId: string): Promise<boolean> {
  await ensureMigrated(docId);
  
  // Database-only - throw error if API fails
  await apiDeleteSmartNote(parseInt(noteId, 10));
  return true;
}

/**
 * Search smart notes by query (content, tags, category)
 */
export function searchSmartNotes(notes: SmartNote[], query: string): SmartNote[] {
  if (!query) return notes;
  const lowerQuery = query.toLowerCase();
  return notes.filter(note => 
    note.content.toLowerCase().includes(lowerQuery) ||
    note.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
    note.category.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Filter smart notes by category
 */
export function filterSmartNotesByCategory(notes: SmartNote[], category: string): SmartNote[] {
  if (category === 'all') return notes;
  return notes.filter(note => note.category === category);
}

/**
 * Filter smart notes by tag
 */
export function filterSmartNotesByTag(notes: SmartNote[], tag: string): SmartNote[] {
  if (!tag) return notes;
  return notes.filter(note => note.tags.includes(tag));
}
