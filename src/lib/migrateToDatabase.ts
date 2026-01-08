/**
 * Migration utility to move localStorage data to database
 * 
 * This script:
 * 1. Reads all localStorage data for a document
 * 2. Sends it to the backend migration endpoint
 * 3. Clears localStorage keys after successful migration
 */

import {
  migrateLocalStorageData,
  listFolders,
} from "./api";
import {
  loadFolders,
  loadFolderMap,
} from "./segmentFolders";
import {
  loadDuplicatedChunks,
} from "./chunkDuplication";
import {
  loadSmartNotes,
} from "./documentWorkspace/smartNotes";

/**
 * Check if document has already been migrated (has folders in DB)
 */
export async function isDocumentMigrated(documentId: number): Promise<boolean> {
  try {
    const folders = await listFolders(documentId);
    return folders.length > 0;
  } catch {
    return false;
  }
}

/**
 * Migrate all localStorage data for a document to the database
 */
export async function migrateDocumentToDatabase(documentId: number): Promise<{
  success: boolean;
  message: string;
  imported?: any;
}> {
  try {
    // Check if already migrated
    const alreadyMigrated = await isDocumentMigrated(documentId);
    if (alreadyMigrated) {
      return {
        success: true,
        message: "Document already migrated to database",
      };
    }

    // Load all localStorage data
    const folders = loadFolders(documentId);
    const folderMap = loadFolderMap(documentId);
    const duplicatedChunks = loadDuplicatedChunks(documentId);
    const smartNotes = loadSmartNotes(documentId);
    
    // Load document note
    const noteHtml = localStorage.getItem(`aiorg_note_html_doc_${documentId}`);
    const noteText = noteHtml ? noteHtml.replace(/<[^>]*>/g, "").trim() : "";
    const documentNote = noteHtml ? { html: noteHtml, text: noteText } : null;

    // Prepare payload
    const payload: any = {};
    
    if (folders.length > 0) {
      payload.folders = folders.map(f => ({
        id: f.id,
        name: f.name,
        createdAt: f.createdAt,
        contents: f.contents || [],
      }));
    }
    
    if (Object.keys(folderMap).length > 0) {
      payload.folderMap = folderMap;
    }
    
    if (duplicatedChunks.length > 0) {
      payload.duplicatedChunks = duplicatedChunks.map(chunk => ({
        id: chunk.id,
        originalId: chunk.originalId,
        title: chunk.title,
        content: chunk.content,
        mode: chunk.mode,
        isManual: chunk.isManual,
        orderIndex: chunk.orderIndex,
        createdAt: chunk.createdAt,
        documentId: chunk.documentId,
      }));
    }
    
    if (smartNotes.length > 0) {
      payload.smartNotes = smartNotes.map(note => ({
        id: note.id,
        content: note.content,
        html: note.html,
        tags: note.tags,
        category: note.category,
        priority: note.priority,
        chunkId: note.chunkId,
        timestamp: note.timestamp,
      }));
    }
    
    if (documentNote) {
      payload.documentNote = documentNote;
    }

    // Send to backend
    const result = await migrateLocalStorageData(documentId, payload);

    // Clear localStorage after successful migration
    if (result.ok) {
      // Clear folders
      localStorage.removeItem(`aiorg_seg_folders_doc_${documentId}`);
      localStorage.removeItem(`aiorg_seg_folder_map_doc_${documentId}`);
      
      // Clear duplicated chunks
      localStorage.removeItem(`aiorg_duplicated_chunks_doc_${documentId}`);
      localStorage.removeItem(`aiorg_recycled_chunks_doc_${documentId}`);
      
      // Clear smart notes
      localStorage.removeItem(`smart_notes_${documentId}`);
      
      // Clear document note
      localStorage.removeItem(`aiorg_note_html_doc_${documentId}`);
      
      // Clear segment HTML (optional - these are view-only, can keep in localStorage)
      // localStorage keys like `aiorg_seg_html_${segId}` can stay
    }

    return {
      success: result.ok,
      message: result.message,
      imported: result.imported,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Migration failed",
    };
  }
}

/**
 * Migrate all documents for the current user
 * Scans localStorage for all document IDs and migrates them
 */
export async function migrateAllDocuments(): Promise<{
  success: number;
  failed: number;
  messages: string[];
}> {
  const documentIds = new Set<number>();
  const messages: string[] = [];
  let success = 0;
  let failed = 0;

  // Find all document IDs from localStorage keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    // Match patterns like: aiorg_seg_folders_doc_123, smart_notes_123, etc.
    const folderMatch = key.match(/aiorg_seg_folders_doc_(\d+)/);
    const noteMatch = key.match(/smart_notes_(\d+)/);
    const chunkMatch = key.match(/aiorg_duplicated_chunks_doc_(\d+)/);
    const docNoteMatch = key.match(/aiorg_note_html_doc_(\d+)/);

    if (folderMatch) documentIds.add(parseInt(folderMatch[1], 10));
    if (noteMatch) documentIds.add(parseInt(noteMatch[1], 10));
    if (chunkMatch) documentIds.add(parseInt(chunkMatch[1], 10));
    if (docNoteMatch) documentIds.add(parseInt(docNoteMatch[1], 10));
  }

  // Migrate each document
  for (const docId of documentIds) {
    try {
      const result = await migrateDocumentToDatabase(docId);
      if (result.success) {
        success++;
        messages.push(`Document ${docId}: ${result.message}`);
      } else {
        failed++;
        messages.push(`Document ${docId}: ${result.message}`);
      }
    } catch (error: any) {
      failed++;
      messages.push(`Document ${docId}: Error - ${error?.message || "Unknown error"}`);
    }
  }

  return { success, failed, messages };
}
