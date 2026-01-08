import { useCallback, useMemo } from "react";
import type { SmartNote } from "../../lib/documentWorkspace/smartNotes";
import {
  saveSmartNote,
  loadSmartNotes,
  updateSmartNote,
  deleteSmartNote,
  searchSmartNotes,
  filterSmartNotesByCategory,
  filterSmartNotesByTag,
} from "../../lib/documentWorkspace/smartNotes";
import type { WorkspaceState } from "./useWorkspaceState";

export interface SmartNotesOperations {
  createNewSmartNote: () => void;
  loadSmartNoteForEdit: (note: SmartNote) => void;
  saveSmartNoteLocal: () => void;
  deleteSmartNoteLocal: (noteId: string) => void;
  addTagToSmartNote: (tag: string) => void;
  removeTagFromSmartNote: (tag: string) => void;
  filteredSmartNotes: SmartNote[];
  allCategories: string[];
  allTags: string[];
}

export function useSmartNotesOperations(
  docId: number,
  state: WorkspaceState
): SmartNotesOperations {
  const createNewSmartNote = useCallback(() => {
    state.setCurrentSmartNote(null);
    state.setSmartNoteHtml("<p></p>");
    state.setSmartNoteText("");
    state.setSmartNoteTags([]);
    state.setSmartNoteCategory("General");
    state.setSmartNoteChunkId(undefined);
    state.setSmartNoteDirty(false);
    state.setSmartNoteStatus("");
  }, [state]);

  const loadSmartNoteForEdit = useCallback(
    (note: SmartNote) => {
      state.setCurrentSmartNote(note);
      state.setSmartNoteHtml(note.html);
      state.setSmartNoteText(note.content);
      state.setSmartNoteTags([...note.tags]);
      state.setSmartNoteCategory(note.category);
      state.setSmartNoteChunkId(note.chunkId);
      state.setSmartNoteDirty(false);
      state.setSmartNoteStatus("");
    },
    [state]
  );

  const saveSmartNoteLocal = useCallback(() => {
    try {
      if (!state.smartNoteText.trim()) {
        state.setSmartNoteStatus("Note content cannot be empty");
        return;
      }

      if (state.currentSmartNote) {
        // Update existing note
        const updated = updateSmartNote(docId, state.currentSmartNote.id, {
          content: state.smartNoteText,
          html: state.smartNoteHtml,
          tags: state.smartNoteTags,
          category: state.smartNoteCategory,
          chunkId: state.smartNoteChunkId,
        });

        if (updated) {
          state.setSmartNotes(loadSmartNotes(docId));
          state.setSmartNoteDirty(false);
          state.setSmartNoteStatus(
            `Smart Note updated ✅ (${updated.tags.length} tags, ${updated.category})`
          );
        } else {
          state.setSmartNoteStatus("Failed to update note");
        }
      } else {
        // Create new note
        const newNote = saveSmartNote(
          {
            content: state.smartNoteText,
            html: state.smartNoteHtml,
            tags: state.smartNoteTags,
            category: state.smartNoteCategory,
            chunkId: state.smartNoteChunkId,
            priority: "medium",
          },
          docId
        );

        state.setSmartNotes(loadSmartNotes(docId));
        state.setCurrentSmartNote(newNote);
        state.setSmartNoteDirty(false);
        state.setSmartNoteStatus(
          `Smart Note saved ✅ (${newNote.tags.length} tags, ${newNote.category})`
        );
      }
    } catch (e: any) {
      state.setSmartNoteStatus(`Failed to save note: ${e?.message ?? String(e)}`);
    }
  }, [docId, state]);

  const deleteSmartNoteLocal = useCallback(
    (noteId: string) => {
      if (window.confirm("Delete this Smart Note? This cannot be undone.")) {
        if (deleteSmartNote(docId, noteId)) {
          state.setSmartNotes(loadSmartNotes(docId));
          if (state.currentSmartNote?.id === noteId) {
            createNewSmartNote();
          }
          state.setSmartNoteStatus("Note deleted ✅");
        }
      }
    },
    [docId, state, createNewSmartNote]
  );

  const addTagToSmartNote = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (trimmed && !state.smartNoteTags.includes(trimmed)) {
        state.setSmartNoteTags([...state.smartNoteTags, trimmed]);
        state.setSmartNoteDirty(true);
        state.setNewTagInput("");
      }
    },
    [state]
  );

  const removeTagFromSmartNote = useCallback(
    (tag: string) => {
      state.setSmartNoteTags(state.smartNoteTags.filter((t) => t !== tag));
      state.setSmartNoteDirty(true);
    },
    [state]
  );

  const filteredSmartNotes = useMemo(() => {
    let filtered = state.smartNotes;
    if (state.smartNoteSearchQuery)
      filtered = searchSmartNotes(filtered, state.smartNoteSearchQuery);
    if (state.smartNoteSelectedCategory !== "all")
      filtered = filterSmartNotesByCategory(filtered, state.smartNoteSelectedCategory);
    if (state.smartNoteSelectedTag)
      filtered = filterSmartNotesByTag(filtered, state.smartNoteSelectedTag);
    return filtered;
  }, [
    state.smartNotes,
    state.smartNoteSearchQuery,
    state.smartNoteSelectedCategory,
    state.smartNoteSelectedTag,
  ]);

  const allCategories = useMemo(() => {
    return [...new Set(state.smartNotes.map((n) => n.category))].sort();
  }, [state.smartNotes]);

  const allTags = useMemo(() => {
    return [...new Set(state.smartNotes.flatMap((n) => n.tags))].sort();
  }, [state.smartNotes]);

  return {
    createNewSmartNote,
    loadSmartNoteForEdit,
    saveSmartNoteLocal,
    deleteSmartNoteLocal,
    addTagToSmartNote,
    removeTagFromSmartNote,
    filteredSmartNotes,
    allCategories,
    allTags,
  };
}

