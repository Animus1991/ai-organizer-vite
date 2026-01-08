import { useCallback } from "react";
import { getDocument, patchDocument, getDocumentNote, upsertDocumentNote } from "../../lib/api";
import { plainTextToHtml } from "../../editor/utils/text";
import { htmlToPlainText } from "../../lib/documentWorkspace/utils";
import type { WorkspaceState } from "./useWorkspaceState";
import { migrateDocumentToDatabase } from "../../lib/migrateToDatabase";

export interface DocumentOperations {
  loadDocument: () => Promise<void>;
  openDocEditor: () => void;
  saveDocEdit: () => Promise<void>;
  saveNoteLocal: () => Promise<void>;
  resetNoteFromDocument: () => void;
}

export function useDocumentOperations(
  docId: number,
  state: WorkspaceState,
  setLoading: (key: string, loading: boolean) => void,
  onLoadSummary: () => Promise<void>
): DocumentOperations {
  const loadDocument = useCallback(async () => {
    setLoading("document", true);
    state.setStatus("Loading document...");
    try {
      const d = await getDocument(docId);
      const text = d.text ?? "";
      state.setDocText(text);

      if (!state.filename && d.filename) state.setFilename(d.filename);

      state.setParseStatus(d.parseStatus ?? "pending");
      state.setParseError((d.parseError as any) ?? null);
      state.setSourceType((d.sourceType as any) ?? null);

      // Auto-migrate localStorage data if exists
      const hasLocalNote = localStorage.getItem(`aiorg_note_html_doc_${docId}`);
      if (hasLocalNote) {
        try {
          await migrateDocumentToDatabase(docId);
        } catch (error) {
          console.warn("Auto-migration failed:", error);
        }
      }

      // Load document note from API (database-first)
      try {
        const note = await getDocumentNote(docId);
        if (note) {
          state.setNoteHtml(note.html);
          state.setNoteText(note.text);
        } else {
          // No note in DB, check localStorage (read-only fallback)
          const stored = localStorage.getItem(`aiorg_note_html_doc_${docId}`);
          if (stored && stored.trim()) {
            state.setNoteHtml(stored);
            state.setNoteText(htmlToPlainText(stored));
          } else {
            // Seed from document text
            state.setNoteHtml(plainTextToHtml(text));
            state.setNoteText(text);
          }
        }
      } catch (error) {
        console.error("Failed to load document note from API:", error);
        // Read-only fallback to localStorage (for offline/error scenarios)
        const stored = localStorage.getItem(`aiorg_note_html_doc_${docId}`);
        if (stored && stored.trim()) {
          state.setNoteHtml(stored);
          state.setNoteText(htmlToPlainText(stored));
        } else {
          state.setNoteHtml(plainTextToHtml(text));
          state.setNoteText(text);
        }
      }

      state.setNoteDirty(false);
      state.setNoteStatus("");

      state.setStatus("");
    } catch (e: any) {
      state.setStatus(`Failed to load document: ${e?.message ?? String(e)}`);
    } finally {
      setLoading("document", false);
    }
  }, [docId, state, setLoading]);

  const openDocEditor = useCallback(() => {
    state.setDocEditText(state.docText);
    state.setDocEditHtml(plainTextToHtml(state.docText));
    state.setDocEditStatus("");
    state.setDocEditSaving(false);
    state.setDocEditOpen(true);
  }, [state]);

  const saveDocEdit = useCallback(async () => {
    try {
      state.setDocEditSaving(true);
      state.setDocEditStatus("Saving...");
      await patchDocument(docId, { text: state.docEditText });

      await loadDocument(); // refresh parse fields too
      state.setDocEditStatus("Saved ✅");
      state.setDocEditOpen(false);

      await onLoadSummary();
    } catch (e: any) {
      state.setDocEditSaving(false);
      state.setDocEditStatus(e?.message ?? "Failed to save document");
    }
  }, [docId, state, loadDocument, onLoadSummary]);

  const saveNoteLocal = useCallback(async () => {
    try {
      state.setNoteStatus("Saving...");
      
      // Database-only - throw error if API fails (no localStorage fallback for writes)
      const text = htmlToPlainText(state.noteHtml);
      await upsertDocumentNote(docId, state.noteHtml, text);
      
      state.setNoteDirty(false);
      state.setNoteStatus("Document notes saved ✅");
      
      // Clear localStorage after successful save (migration cleanup)
      localStorage.removeItem(`aiorg_note_html_doc_${docId}`);
    } catch (e: any) {
      console.error("Failed to save document note to API:", e);
      // NO localStorage fallback for writes - show error to user
      state.setNoteStatus(`Failed to save: ${e?.message ?? String(e)}`);
      throw e; // Re-throw so caller knows it failed
    }
  }, [docId, state]);

  const resetNoteFromDocument = useCallback(() => {
    state.setNoteHtml(plainTextToHtml(state.docText));
    state.setNoteText(state.docText);
    state.setNoteDirty(true);
    state.setNoteStatus("Notes replaced from current document text (not saved yet).");
  }, [state]);

  return {
    loadDocument,
    openDocEditor,
    saveDocEdit,
    saveNoteLocal,
    resetNoteFromDocument,
  };
}
