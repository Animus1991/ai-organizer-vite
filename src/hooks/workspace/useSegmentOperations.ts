import { useCallback } from "react";
import {
  listSegmentations,
  listSegmentsWithMeta,
  segmentDocument,
  deleteSegments,
  deleteSegment,
  createManualSegment,
  patchSegment,
  SegmentDTO,
} from "../../lib/api";
import { plainTextToHtml } from "../../editor/utils/text";
import { fmt } from "../../lib/documentWorkspace/utils";
import { computeSelectionFromPre } from "../../lib/documentWorkspace/selection";
import { setSegmentFolder, loadFolderMap } from "../../lib/segmentFolders";
import type { WorkspaceState } from "./useWorkspaceState";

export interface SegmentOperations {
  loadSummary: () => Promise<void>;
  loadSegs: (m?: "qa" | "paragraphs") => Promise<void>;
  runSegmentation: () => Promise<void>;
  deleteModeSegments: () => Promise<void>;
  handleDeleteSingle: (seg: SegmentDTO) => Promise<void>;
  confirmDeleteSingle: (seg: SegmentDTO) => Promise<void>;
  cancelDelete: () => void;
  captureManualSelection: () => void;
  saveManualChunk: () => Promise<void>;
  openChunkEditor: (seg: SegmentDTO) => void;
  captureChunkSelection: () => void;
  saveChunkEdit: () => Promise<void>;
}

export function useSegmentOperations(
  docId: number,
  state: WorkspaceState,
  setLoading: (key: string, loading: boolean) => void
): SegmentOperations {
  const loadSummary = useCallback(async () => {
    setLoading("summary", true);
    try {
      const rows = await listSegmentations(docId);
      state.setSummary(Array.isArray(rows) ? rows : []);
    } catch {
      state.setSummary([]);
    } finally {
      setLoading("summary", false);
    }
  }, [docId, state, setLoading]);

  const loadSegs = useCallback(
    async (m?: "qa" | "paragraphs") => {
      const useMode = m ?? state.mode;
      setLoading("segments", true);
      state.setStatus("Loading segments...");
      try {
        const out = await listSegmentsWithMeta(docId, useMode);
        state.setSegments(Array.isArray(out.items) ? out.items : []);
        state.setSegmentsMeta(out.meta ?? null);

        state.setSelectedSegId(null);
        state.setOpenSeg(null);

        const last = out.meta?.lastRun ? fmt(out.meta.lastRun) : "—";
        state.setStatus(`Loaded ${out.items.length} segments (${useMode}) • lastRun: ${last}`);
      } catch (e: any) {
        state.setStatus(e?.message ?? "List failed");
      } finally {
        setLoading("segments", false);
      }
    },
    [docId, state, setLoading]
  );

  const runSegmentation = useCallback(async () => {
    if (!state.canSegment) {
      state.setStatus(`Cannot segment: parseStatus="${state.parseStatus}". Fix upload/parse first.`);
      return;
    }

    state.setStatus("Segmenting...");
    try {
      await segmentDocument(docId, state.mode);
      await loadSummary();
      await loadSegs(state.mode);
      state.setStatus(`Segmented (${state.mode})`);
    } catch (e: any) {
      state.setStatus(e?.message ?? "Segment failed");
    }
  }, [docId, state, loadSummary, loadSegs]);

  const deleteModeSegments = useCallback(async () => {
    const ok = window.confirm(`Delete AUTO segments for mode "${state.mode}"? (Manual chunks will stay)`);
    if (!ok) return;

    state.setStatus("Deleting segments...");
    try {
      await deleteSegments(docId, state.mode);
      await loadSummary();
      await loadSegs(state.mode);
      state.setSelectedSegId(null);
      state.setOpenSeg(null);
      state.setStatus(`Deleted auto segments (${state.mode}).`);
    } catch (e: any) {
      state.setStatus(e?.message ?? "Delete failed");
    }
  }, [docId, state, loadSummary, loadSegs]);

  const handleDeleteSingle = useCallback(
    async (seg: SegmentDTO) => {
      // Check if there are duplicates in folders
      const hasDuplicates = state.duplicatedChunks.some((d) => d.originalId === seg.id);
      if (hasDuplicates) {
        state.setStatus("Cannot delete original chunk that has duplicates in folders. Delete the duplicates first.");
        return;
      }

      state.setDeletingSegId(seg.id);
    },
    [state]
  );

  const confirmDeleteSingle = useCallback(
    async (seg: SegmentDTO) => {
      state.setStatus("Deleting chunk...");
      try {
        await deleteSegment(seg.id);
        state.setSegments((prev) => prev.filter((x) => x.id !== seg.id));

        if (state.selectedSegId === seg.id) state.setSelectedSegId(null);
        if (state.openSeg?.id === seg.id) state.setOpenSeg(null);
        if (state.manualOpenSeg?.id === seg.id) state.setManualOpenSeg(null);

        state.setStatus("Chunk deleted.");
        await loadSummary();
      } catch (e: any) {
        state.setStatus(e?.message ?? "Delete failed");
      }
      state.setDeletingSegId(null);
    },
    [state, loadSummary]
  );

  const cancelDelete = useCallback(() => {
    state.setDeletingSegId(null);
  }, [state]);

  const captureManualSelection = useCallback(() => {
    const pre = state.manualPreRef.current;
    if (!pre) return;
    const info = computeSelectionFromPre(pre, state.docText);
    state.setManualSel(info);
    state.setManualStatus(info ? `Selected ${info.end - info.start} chars.` : "No selection.");
  }, [state]);

  const saveManualChunk = useCallback(async () => {
    if (!state.manualSel) {
      state.setManualStatus("Pick some text (drag) first.");
      return;
    }

    try {
      state.setManualStatus("Saving...");
      const created = await createManualSegment(docId, {
        mode: state.mode,
        title: state.manualTitle.trim() ? state.manualTitle.trim() : null,
        start: state.manualSel.start,
        end: state.manualSel.end,
      });

      await loadSummary();
      await loadSegs(state.mode);

      state.setSelectedSegId(created.id);
      state.setManualStatus(`Saved: ${created.title}`);
      state.setManualTitle("");
      state.setManualSel(null);
      state.setManualOpenSeg(null);
    } catch (e: any) {
      state.setManualStatus(e?.message ?? "Manual save failed");
    }
  }, [docId, state, loadSummary, loadSegs]);

  const openChunkEditor = useCallback(
    (seg: SegmentDTO) => {
      state.setChunkEditSeg(seg);
      state.setChunkEditTitle(seg.title ?? "");
      state.setChunkEditStart(typeof seg.start === "number" ? seg.start : 0);
      state.setChunkEditEnd(typeof seg.end === "number" ? seg.end : 0);

      const plain = seg.content ?? "";
      state.setChunkEditContent(plain);

      const storedHtml = localStorage.getItem(state.segHtmlKey(seg.id));
      const html = storedHtml && storedHtml.trim() ? storedHtml : plainTextToHtml(plain);
      state.setChunkEditHtml(html);

      // Get current folder ID from folderMap
      const currentFolderId = state.folderMap[String(seg.id)] ?? null;
      state.setChunkEditFolderId(currentFolderId);

      state.setChunkEditDirty(false);
      state.setChunkEditStatus("");
      state.setChunkEditSyncFromDoc(true);
      state.setChunkEditOpen(true);
    },
    [state]
  );

  const captureChunkSelection = useCallback(() => {
    const pre = state.chunkEditPreRef.current;
    if (!pre) return;

    const info = computeSelectionFromPre(pre, state.docText);
    if (!info) {
      state.setChunkEditStatus("No selection.");
      return;
    }

    state.setChunkEditStart(info.start);
    state.setChunkEditEnd(info.end);

    if (state.chunkEditSyncFromDoc) {
      state.setChunkEditContent(info.text);
      state.setChunkEditHtml(plainTextToHtml(info.text));
      state.setChunkEditDirty(true);
    }

    state.setChunkEditStatus(`Selected ${info.end - info.start} chars from document.`);
  }, [state]);

  const saveChunkEdit = useCallback(async () => {
    if (!state.chunkEditSeg) return;

    try {
      state.setChunkEditStatus("Saving...");

      const patch: any = {
        title: state.chunkEditTitle.trim() ? state.chunkEditTitle.trim() : "",
        content: state.chunkEditContent,
      };

      if (Number.isFinite(state.chunkEditStart) && Number.isFinite(state.chunkEditEnd) && state.chunkEditEnd > state.chunkEditStart) {
        patch.start = state.chunkEditStart;
        patch.end = state.chunkEditEnd;
      }

      const updated = await patchSegment(state.chunkEditSeg.id, patch);

      state.setSegments((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      state.setOpenSeg((prev) => (prev?.id === updated.id ? updated : prev));
      state.setManualOpenSeg((prev) => (prev?.id === updated.id ? updated : prev));
      if (state.selectedSegId === updated.id) state.setSelectedSegId(updated.id);

      state.setChunkEditSeg(updated);
      state.setChunkEditStatus("Saved ✅");

      // Update folder assignment
      setSegmentFolder(docId, updated.id, state.chunkEditFolderId);
      state.setFolderMap(loadFolderMap(docId));

      // Persist HTML locally for viewing
      try {
        localStorage.setItem(state.segHtmlKey(updated.id), state.chunkEditHtml);
        state.setChunkEditDirty(false);
      } catch {
        // ignore
      }

      await loadSummary();
      await loadSegs(state.mode);
    } catch (e: any) {
      state.setChunkEditStatus(e?.message ?? "Save failed");
    }
  }, [docId, state, loadSummary, loadSegs]);

  return {
    loadSummary,
    loadSegs,
    runSegmentation,
    deleteModeSegments,
    handleDeleteSingle,
    confirmDeleteSingle,
    cancelDelete,
    captureManualSelection,
    saveManualChunk,
    openChunkEditor,
    captureChunkSelection,
    saveChunkEdit,
  };
}

