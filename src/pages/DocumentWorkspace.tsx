// C:\Users\anast\PycharmProjects\AI_ORGANIZER_VITE\src\pages\DocumentWorkspace.tsx
import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  SegmentDTO,
  SegmentationSummary,
  patchDocument,
} from "../lib/api";
import SegmentationSummaryBar from "../components/SegmentationSummaryBar";
import FolderManagerDrawer from "../components/FolderManagerDrawer";
import FolderDropZone from "../components/FolderDropZone";
import { loadFolders, loadFolderMap, setSegmentFolder, addChunkToFolder, removeChunkFromFolder } from "../lib/segmentFolders";
import { duplicateSegment, loadDuplicatedChunks } from "../lib/chunkDuplication";
import OutlineWizard from "../components/OutlineWizard";
import { useMultiLoading } from "../hooks/useLoading";
import { useWorkspaceState, useDocumentOperations, useSegmentOperations, useSmartNotesOperations } from "../hooks/workspace";
import { badge } from "../lib/documentWorkspace/utils";
import { loadSmartNotes } from "../lib/documentWorkspace/smartNotes";
import { WorkspaceToolbar, WorkspaceFilters, DocumentEditModal, DocumentNotesModal, ManualChunkModal, ChunkEditModal, SmartNotesModal, SegmentList } from "../components/workspace";

// Utility functions have been extracted to:
// - src/lib/documentWorkspace/utils.ts (fmt, preview120, badge, htmlToPlainText)
// - src/lib/documentWorkspace/selection.ts (computeSelectionFromPre, splitDocByRange, SelInfo)
// - src/lib/documentWorkspace/smartNotes.ts (SmartNote interface and all functions)

export default function DocumentWorkspace() {
  const nav = useNavigate();
  const { documentId } = useParams();
  const docId = Number(documentId);
  const location = useLocation() as any;

  // Loading states
  const { setLoading, isLoading, getError } = useMultiLoading();

  // Workspace state (all useState declarations)
  const state = useWorkspaceState(docId, location?.state?.filename ?? null);

  // Document operations
  const segmentOps = useSegmentOperations(docId, state, setLoading);
  const docOps = useDocumentOperations(docId, state, setLoading, segmentOps.loadSummary);
  const smartNotesOps = useSmartNotesOperations(docId, state);

  // Destructure state for easier access (keeping compatibility with existing code)
  const {
    status,
    setStatus,
    docText,
    setDocText,
    filename,
    setFilename,
    parseStatus,
    setParseStatus,
    parseError,
    setParseError,
    sourceType,
    setSourceType,
    summary,
    setSummary,
    mode,
    setMode,
    segments,
    setSegments,
    segmentsMeta,
    setSegmentsMeta,
    query,
    setQuery,
    sourceFilter,
    setSourceFilter,
    advancedFiltersOpen,
    setAdvancedFiltersOpen,
    minLength,
    setMinLength,
    maxLength,
    setMaxLength,
    activePreset,
    setActivePreset,
    selectedSegId,
    setSelectedSegId,
    openSeg,
    setOpenSeg,
    highlightRef,
    listScrollRef,
    lastScrollTopRef,
    clickTimerRef,
    manualOpen,
    setManualOpen,
    manualTitle,
    setManualTitle,
    manualPreRef,
    manualSel,
    setManualSel,
    manualStatus,
    setManualStatus,
    manualOpenSeg,
    setManualOpenSeg,
    manualListScrollRef,
    manualLastScrollTopRef,
    manualClickTimerRef,
    chunkEditOpen,
    setChunkEditOpen,
    chunkEditSeg,
    setChunkEditSeg,
    chunkEditTitle,
    setChunkEditTitle,
    chunkEditStart,
    setChunkEditStart,
    chunkEditEnd,
    setChunkEditEnd,
    chunkEditContent,
    setChunkEditContent,
    chunkEditHtml,
    setChunkEditHtml,
    chunkEditDirty,
    setChunkEditDirty,
    chunkEditStatus,
    setChunkEditStatus,
    chunkEditFolderId,
    setChunkEditFolderId,
    chunkEditPreRef,
    chunkEditSyncFromDoc,
    setChunkEditSyncFromDoc,
    docEditOpen,
    setDocEditOpen,
    docEditText,
    setDocEditText,
    docEditHtml,
    setDocEditHtml,
    docEditStatus,
    setDocEditStatus,
    docEditSaving,
    setDocEditSaving,
    chunkEditFullscreen,
    setChunkEditFullscreen,
    showChunkListInEdit,
    setShowChunkListInEdit,
    showAllChunksInEdit,
    setShowAllChunksInEdit,
    notesOpen,
    setNotesOpen,
    noteHtml,
    setNoteHtml,
    noteText,
    setNoteText,
    noteStatus,
    setNoteStatus,
    noteDirty,
    setNoteDirty,
    smartNotesOpen,
    setSmartNotesOpen,
    smartNotes,
    setSmartNotes,
    currentSmartNote,
    setCurrentSmartNote,
    smartNoteHtml,
    setSmartNoteHtml,
    smartNoteText,
    setSmartNoteText,
    smartNoteTags,
    setSmartNoteTags,
    smartNoteCategory,
    setSmartNoteCategory,
    smartNoteChunkId,
    setSmartNoteChunkId,
    smartNoteDirty,
    setSmartNoteDirty,
    smartNoteStatus,
    setSmartNoteStatus,
    smartNoteSearchQuery,
    setSmartNoteSearchQuery,
    smartNoteSelectedCategory,
    setSmartNoteSelectedCategory,
    smartNoteSelectedTag,
    setSmartNoteSelectedTag,
    newTagInput,
    setNewTagInput,
    foldersOpen,
    setFoldersOpen,
    folders,
    setFolders,
    folderFilter,
    setFolderFilter,
    folderMap,
    setFolderMap,
    draggedSegment,
    setDraggedSegment,
    dragOverFolder,
    setDragOverFolder,
    deletingSegId,
    setDeletingSegId,
    deletingManualSegId,
    setDeletingManualSegId,
    wizardOpen,
    setWizardOpen,
    recycleBinOpen,
    setRecycleBinOpen,
    duplicatedChunks,
    setDuplicatedChunks,
    currentFolder,
    setCurrentFolder,
    canSegment,
    segHtmlKey,
  } = state;

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, segment: any) => {
    setDraggedSegment(segment);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(segment));
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedSegment(null);
    setDragOverFolder(null);
  };

  // Handle drag over folder
  const handleDragOverFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolder(folderId);
  };

  // Handle drop on folder
  const handleDropOnFolder = async (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    if (draggedSegment) {
      // Create duplicate and add to folder
      const duplicated = duplicateSegment(draggedSegment, docId);
      if (duplicated) {
        try {
          await setSegmentFolder(docId, draggedSegment.id, folderId);
          await addChunkToFolder(docId, folderId, duplicated.id, {
            title: duplicated.title,
            content: duplicated.content,
            mode: duplicated.mode,
            isManual: duplicated.isManual,
            orderIndex: duplicated.orderIndex,
          });
          const [folders, folderMap] = await Promise.all([
            loadFolders(docId),
            loadFolderMap(docId),
          ]);
          setFolders(folders);
          setFolderMap(folderMap);
          setDuplicatedChunks(loadDuplicatedChunks(docId));
        } catch (error) {
          console.error("Failed to handle drop on folder:", error);
        }
      }
    }
    setDragOverFolder(null);
  };

  // Handle drop on "No folder"
  const handleDropOnNoFolder = async (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedSegment) {
      await setSegmentFolder(docId, draggedSegment.id, null);
      const folderMap = await loadFolderMap(docId);
      setFolderMap(folderMap);
    }
    setDragOverFolder(null);
  };

  // Use operations from hooks
  const { loadDocument, openDocEditor, saveDocEdit, saveNoteLocal, resetNoteFromDocument } = docOps;
  const {
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
  } = segmentOps;

  async function applyNoteToDocumentText() {
    const ok = window.confirm(
      "Apply Notes to Document TEXT?\n\nThis will overwrite the document text with the editor plain-text, and your segment offsets may become invalid.\nYou will likely need to re-run segmentation.\n\nContinue?"
    );
    if (!ok) return;

    try {
      setStatus("Applying notes to document...");
      await patchDocument(docId, { text: noteText });
      await loadDocument();
      await loadSummary();
      setStatus("Applied notes to document ✅");
    } catch (e: any) {
      setStatus(e?.message ?? "Failed to apply notes to document");
    }
  }

  // Smart Notes operations (extracted to hook)
  const {
    createNewSmartNote,
    loadSmartNoteForEdit,
    saveSmartNoteLocal,
    deleteSmartNoteLocal,
    addTagToSmartNote,
    removeTagFromSmartNote,
    filteredSmartNotes,
    allCategories,
    allTags,
  } = smartNotesOps;

  useEffect(() => {
    if (!Number.isFinite(docId)) return;

    docOps.loadDocument();
    segmentOps.loadSummary();

    // Load folders, folder map, duplicated chunks, and smart notes (now async API calls)
    (async () => {
      try {
        const [folders, folderMap, duplicatedChunks, smartNotes] = await Promise.all([
          loadFolders(docId),
          loadFolderMap(docId),
          Promise.resolve(loadDuplicatedChunks(docId)), // Still localStorage for now
          loadSmartNotes(docId),
        ]);
        setFolders(folders);
        setFolderMap(folderMap);
        setDuplicatedChunks(duplicatedChunks);
        setSmartNotes(smartNotes);
      } catch (error) {
        console.error("Failed to load workspace data:", error);
        setFolders([]);
        setFolderMap({});
        setDuplicatedChunks([]);
        setSmartNotes([]);
      }
    })();

    return () => {
      if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
      if (manualClickTimerRef.current) window.clearTimeout(manualClickTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const summaryByMode = useMemo(() => {
    const map: Record<string, SegmentationSummary> = {};
    for (const r of summary) map[r.mode] = r;
    return map;
  }, [summary]);

  const visibleBySource = useMemo(() => {
    if (sourceFilter === "all") return segments;
    if (sourceFilter === "manual") return segments.filter((s) => !!(s as any).isManual);
    return segments.filter((s) => !(s as any).isManual);
  }, [segments, sourceFilter]);

  const filteredSegments = useMemo(() => {
    const folderOk = (segId: number) => {
    const fId = folderMap[String(segId)] ?? null;
    if (folderFilter === "all") return true;
    if (folderFilter === "none") return !fId;
    return fId === folderFilter;
  };

    // Apply folder filter first
    let filtered = visibleBySource.filter((s) => folderOk(s.id));

    // Apply query search
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      filtered = filtered.filter((s) => {
    const hay = `${s.title ?? ""} ${s.content ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
    }

    // Apply length filters
    if (minLength !== undefined) {
      filtered = filtered.filter((s) => {
        const length = (s.content ?? "").length;
        return length >= minLength;
      });
    }

    if (maxLength !== undefined) {
      filtered = filtered.filter((s) => {
        const length = (s.content ?? "").length;
        return length <= maxLength;
      });
    }

    return filtered;
  }, [visibleBySource, query, folderFilter, folderMap, minLength, maxLength]);

  const selectedSeg = useMemo(() => {
    if (!selectedSegId) return null;
    return segments.find((s) => s.id === selectedSegId) ?? null;
  }, [selectedSegId, segments]);

  const highlightedDoc = useMemo(() => {
    if (!docText) return { before: "", mid: "", after: "" };

    const s = selectedSeg;
    const start = typeof (s as any)?.start === "number" ? (s as any).start : null;
    const end = typeof (s as any)?.end === "number" ? (s as any).end : null;

    if (start === null || end === null || start < 0 || end <= start || end > docText.length) {
      return { before: docText, mid: "", after: "" };
    }

    return {
      before: docText.slice(0, start),
      mid: docText.slice(start, end),
      after: docText.slice(end),
    };
  }, [docText, selectedSeg]);

  useEffect(() => {
    if (!highlightRef.current) return;
    highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedSegId]);

  useEffect(() => {
    if (openSeg) return;
    if (listScrollRef.current) listScrollRef.current.scrollTop = lastScrollTopRef.current;
  }, [openSeg]);

  useEffect(() => {
    if (manualOpenSeg) return;
    if (manualListScrollRef.current) manualListScrollRef.current.scrollTop = manualLastScrollTopRef.current;
  }, [manualOpenSeg]);

  function handleSelect(seg: SegmentDTO) {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => setSelectedSegId(seg.id), 170);
  }

  function handleOpen(seg: SegmentDTO) {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    setSelectedSegId(seg.id);

    if (listScrollRef.current) lastScrollTopRef.current = listScrollRef.current.scrollTop;
    setOpenSeg(seg);
  }

  async function handleFolderChange(segment: SegmentDTO, folderId: string | null) {
    if (folderId) {
      // Create duplicate and add to folder
      const duplicated = duplicateSegment(segment, docId);
      if (duplicated) {
        await setSegmentFolder(docId, segment.id, folderId);
        await addChunkToFolder(docId, folderId, duplicated.id, {
          title: duplicated.title,
          content: duplicated.content,
          mode: duplicated.mode,
          isManual: duplicated.isManual,
          orderIndex: duplicated.orderIndex,
        });
        const [folders, folderMap] = await Promise.all([
          loadFolders(docId),
          loadFolderMap(docId),
        ]);
        setFolders(folders);
        setFolderMap(folderMap);
        setDuplicatedChunks(loadDuplicatedChunks(docId));
      }
    } else {
      // Remove from folder - need to also remove duplicated chunk from folder.contents
      const previousFolderId = folderMap[String(segment.id)];
      if (previousFolderId) {
        // Find the duplicated chunk that corresponds to this segment
        const duplicatedChunks = loadDuplicatedChunks(docId);
        const duplicatedChunk = duplicatedChunks.find((chunk) => chunk.originalId === segment.id);
        
        if (duplicatedChunk) {
          // Remove the duplicated chunk from the folder's contents
          await removeChunkFromFolder(docId, previousFolderId, duplicatedChunk.id);
        }
      }
      
      await setSegmentFolder(docId, segment.id, null);
      const [folders, folderMap] = await Promise.all([
        loadFolders(docId),
        loadFolderMap(docId),
      ]);
      setFolders(folders);
      setFolderMap(folderMap);
    }
  }

  const manualSegments = useMemo(() => {
    return segments.filter((s) => !!(s as any).isManual && (s as any).mode === mode);
  }, [segments, mode]);

  function manualHandleSelect(seg: SegmentDTO) {
    if (manualClickTimerRef.current) window.clearTimeout(manualClickTimerRef.current);
    manualClickTimerRef.current = window.setTimeout(() => {
      setSelectedSegId(seg.id);
      setManualStatus(`Selected saved chunk: ${seg.title}`);
    }, 170);
  }

  function manualHandleOpen(seg: SegmentDTO) {
    if (manualClickTimerRef.current) window.clearTimeout(manualClickTimerRef.current);
    setSelectedSegId(seg.id);
    if (manualListScrollRef.current) manualLastScrollTopRef.current = manualListScrollRef.current.scrollTop;
    setManualOpenSeg(seg);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "linear-gradient(135deg, #0a0a0a 0%, #0f0f1a 50%, #0a0a0a 100%)",
        color: "#eaeaea",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: "18px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
          flex: "0 0 auto",
          background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(15, 15, 25, 0.95) 100%)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
            }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "20px", height: "20px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1
              style={{
                fontSize: "var(--font-size-xl)",
                lineHeight: "var(--line-height-snug)",
                fontWeight: 700,
                letterSpacing: "var(--letter-spacing-tight)",
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                margin: 0,
                marginBottom: "4px",
              }}
            >
              Document #{docId}
            </h1>
            <p style={{ margin: 0, fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)", color: "rgba(255, 255, 255, 0.6)", fontWeight: 400 }}>{filename ?? "—"}</p>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }} />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={openDocEditor}
            style={{
              padding: "12px 20px",
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              border: "none",
              borderRadius: "12px",
              color: "white",
              fontWeight: 600,
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
              boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(99, 102, 241, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.3)";
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          Edit document
        </button>
          <button
            onClick={() => nav("/")}
            style={{
              padding: "12px 20px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "12px",
              color: "#eaeaea",
              fontWeight: 600,
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          Back to Home
        </button>
        </div>
      </div>

      {/* Ingest banner */}
      <div
        style={{
          padding: "14px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flex: "0 0 auto",
          background: "linear-gradient(135deg, rgba(20, 20, 30, 0.8) 0%, rgba(15, 15, 25, 0.8) 100%)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 600, color: "#eaeaea", fontSize: "var(--font-size-base)", lineHeight: "var(--line-height-normal)" }}>Ingest:</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-normal)",
                  fontWeight: 600,
                  cursor: "help",
                  ...(parseStatus === "ok"
                    ? {
                        background: "rgba(16, 185, 129, 0.2)",
                        color: "#6ee7b7",
                        border: "1px solid rgba(16, 185, 129, 0.3)",
                      }
                    : parseStatus === "failed"
                    ? {
                        background: "rgba(239, 68, 68, 0.2)",
                        color: "#fca5a5",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                      }
                    : {
                        background: "rgba(251, 191, 36, 0.2)",
                        color: "#fcd34d",
                        border: "1px solid rgba(251, 191, 36, 0.3)",
                      }),
                }}
                title={
                  parseStatus === "ok"
                    ? "Το document έχει parse-αριστεί επιτυχώς. Μπορείς να κάνεις segmentation."
                    : parseStatus === "failed"
                    ? "Το parsing απέτυχε. Δες το parse error παρακάτω."
                    : "Το document βρίσκεται σε αναμονή για parsing. Περίμενε να ολοκληρωθεί."
                }
              >
                {badge(parseStatus)}
              </div>
              <span
                style={{
                  fontSize: "var(--font-size-xs)",
              lineHeight: "var(--line-height-normal)",
                  color: "rgba(255, 255, 255, 0.5)",
                  fontStyle: "italic",
                  cursor: "help",
                }}
                title="Ingest = Parsing: Η διαδικασία μετατροπής του uploaded file σε structured text. Πρέπει να είναι 'ok' για να μπορέσεις να κάνεις segmentation."
              >
                (Parsing status)
              </span>
            </div>
            {sourceType && (
              <span
                style={{
                  fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                  color: "rgba(255, 255, 255, 0.7)",
                  background: "rgba(255, 255, 255, 0.05)",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  fontWeight: 500,
                }}
              >
                source: {sourceType}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {!canSegment ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "var(--font-size-sm)",
                lineHeight: "var(--line-height-normal)",
                color: "#fca5a5",
                background: "rgba(239, 68, 68, 0.15)",
                padding: "8px 16px",
                borderRadius: "10px",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                fontWeight: 500,
                cursor: "help",
              }}
              title="Το document πρέπει να έχει parse-αριστεί επιτυχώς (parseStatus=ok) πριν μπορέσεις να κάνεις segmentation. Το 'Ingest' δείχνει την κατάσταση του parsing."
            >
              <svg style={{ width: "14px", height: "14px", flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Segmentation disabled until parseStatus=ok</span>
            </div>
          ) : (
            <span
              style={{
                fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                color: "#6ee7b7",
                background: "rgba(16, 185, 129, 0.15)",
                padding: "8px 16px",
                borderRadius: "10px",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                fontWeight: 500,
              }}
            >
              ✅ Ready for segmentation
            </span>
          )}
        </div>
        {parseStatus === "failed" && parseError ? (
          <div
            style={{
              marginTop: "12px",
              padding: "12px 16px",
              background: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "12px",
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
              color: "#fca5a5",
            }}
          >
            <strong>Parse error:</strong> {parseError}
          </div>
        ) : null}
      </div>

      {/* 50/50 split area */}
      <div className="flex flex-1 min-h-0" style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
        {/* Left: full document */}
        <div
          className="flex-1 min-w-0 min-h-0 border-r border-border flex flex-col"
          style={{
            flex: "1 1 65%", // Give more space to document
            minWidth: 0,
            minHeight: 0,
            borderRight: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              fontWeight: 700,
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
              color: "#eaeaea",
              background: "linear-gradient(135deg, rgba(30, 30, 40, 0.5) 0%, rgba(20, 20, 30, 0.3) 100%)",
            }}
          >
            Full document
            {selectedSeg ? (
              <span style={{ marginLeft: 10, fontWeight: 400, opacity: 0.7, fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)", color: "rgba(255, 255, 255, 0.6)" }}>
                — selected: #{(((selectedSeg as any).orderIndex ?? 0) as number) + 1} ({(selectedSeg as any).mode}){" "}
                {(selectedSeg as any).isManual ? "• manual" : "• auto"}
              </span>
            ) : null}
          </div>

          <div className="p-3 overflow-auto flex-1 min-h-0" style={{ padding: 12, overflow: "auto", flex: "1 1 auto", minHeight: 0 }}>
            {docText ? (
              <pre className="whitespace-pre-wrap m-0 leading-relaxed" style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.55 }}>
                {highlightedDoc.before}
                {highlightedDoc.mid ? (
                  <span
                    ref={highlightRef}
                    className="highlight-segment"
                    style={{
                      background: "rgba(99, 102, 241, 0.2)",
                      outline: "1px solid rgba(99, 102, 241, 0.4)",
                      borderRadius: 4,
                      padding: "1px 2px",
                    }}
                  >
                    {highlightedDoc.mid}
                  </span>
                ) : null}
                {highlightedDoc.after}
              </pre>
            ) : (
              <div className="text-secondary opacity-70" style={{ opacity: 0.7 }}>—</div>
            )}
          </div>
        </div>

        {/* Right: workspace */}
        <div
          className="ws-right"
          style={{
            flex: "1 1 35%", // Remaining space for workspace
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* TOP: controls / summary / filters */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(135deg, rgba(30, 30, 40, 0.5) 0%, rgba(20, 20, 30, 0.3) 100%)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: "12px" }}>
              <span style={{ fontWeight: 700, fontSize: "var(--font-size-lg)", lineHeight: "var(--line-height-snug)", color: "#eaeaea", letterSpacing: "var(--letter-spacing-tight)" }}>Workspace</span>
              <div style={{ flex: 1 }} />
              {status && (
                <span
                  style={{
                    opacity: 0.75,
                    fontSize: "var(--font-size-sm)",
                    lineHeight: "var(--line-height-normal)",
                    color: "rgba(255, 255, 255, 0.6)",
                    padding: "4px 10px",
                    background: "rgba(255, 255, 255, 0.05)",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                  }}
                >
                  {status}
                </span>
              )}
            </div>

            {/* Workspace Toolbar */}
            <WorkspaceToolbar
              mode={mode}
              onModeChange={setMode}
              onListSegments={() => loadSegs()}
              onSegmentNow={runSegmentation}
              onDeleteModeSegments={deleteModeSegments}
              onManualChunk={() => {
                  setManualOpen(true);
                  setManualStatus("Select text (drag) on the left, then Save.");
                  setManualSel(null);
                  setManualTitle("");
                  setManualOpenSeg(null);
                }}
              filteredSegments={filteredSegments}
              docId={docId}
              notesOpen={notesOpen}
              onToggleNotes={() => state.setNotesOpen(!state.notesOpen)}
              smartNotesOpen={smartNotesOpen}
              onToggleSmartNotes={() => state.setSmartNotesOpen(!state.smartNotesOpen)}
              smartNotesCount={smartNotes.length}
              onLoadSmartNotes={async () => {
                const notes = await loadSmartNotes(docId);
                setSmartNotes(notes);
              }}
              onCreateNewSmartNote={createNewSmartNote}
              canSegment={canSegment}
              parseStatus={parseStatus}
            />

            {/* Compact one-liner summary */}
            <SegmentationSummaryBar
              qa={{ count: summaryByMode.qa?.count ?? 0, last: summaryByMode.qa?.lastSegmentedAt ?? null }}
              paragraphs={{ count: summaryByMode.paragraphs?.count ?? 0, last: summaryByMode.paragraphs?.lastSegmentedAt ?? null }}
              metaLine={
                segmentsMeta
                  ? `list: count=${segmentsMeta.count} mode=${segmentsMeta.mode} lastRun=${segmentsMeta.lastRun ?? "—"}`
                  : undefined
              }
              onRefresh={() => {
                loadSummary();
              }}
              drawerTitle={`Document #${docId} • Segmentation`}
            />


            {/* Workspace Filters */}
            <WorkspaceFilters
              sourceFilter={sourceFilter}
              onSourceFilterChange={setSourceFilter}
              folderFilter={folderFilter}
              onFolderFilterChange={setFolderFilter}
              query={query}
              onQueryChange={setQuery}
              advancedFiltersOpen={advancedFiltersOpen}
              onToggleAdvancedFilters={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
              minLength={minLength}
              maxLength={maxLength}
              onMinLengthChange={setMinLength}
              onMaxLengthChange={setMaxLength}
              activePreset={activePreset}
              onPresetChange={setActivePreset}
              onFoldersOpen={() => setFoldersOpen(true)}
              onWizardOpen={() => setWizardOpen(true)}
              folders={folders}
              filteredSegmentsCount={filteredSegments.length}
              totalSegmentsCount={segments.length}
            />
          </div>

          {/* Folder Drop Zones */}
          {draggedSegment && (
            <div className="mt-4 p-4 bg-surface-elevated border border-border rounded-lg">
              <h3 className="text-sm font-semibold text-primary mb-3">Move "{draggedSegment.title || 'Segment'}" to folder:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <FolderDropZone
                  folder={null}
                  onDrop={(folderId) => handleDropOnNoFolder({ preventDefault: () => {} } as React.DragEvent)}
                  onDragOver={(folderId) => setDragOverFolder(folderId)}
                  isDragOver={dragOverFolder === null}
                  draggedSegment={draggedSegment}
                />
                {folders.map((folder) => (
                  <FolderDropZone
                    key={folder.id}
                    folder={folder}
                    onDrop={(folderId) => handleDropOnFolder({ preventDefault: () => {} } as React.DragEvent, folderId!)}
                    onDragOver={(folderId) => setDragOverFolder(folderId)}
                    isDragOver={dragOverFolder === folder.id}
                    draggedSegment={draggedSegment}
                  />
                ))}
            </div>
          </div>
          )}

          {/* BODY: notes area + chunks list/view */}
          <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
            {/* Left within workspace: chunks list/view */}
            <div style={{ flex: notesOpen ? "1 1 50%" : "1 1 auto", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex" }}>
                <SegmentList
                  segments={segments}
                  filteredSegments={filteredSegments}
                  selectedSegId={selectedSegId}
                  openSeg={openSeg}
                  folderFilter={folderFilter}
                  folders={folders}
                  folderMap={folderMap}
                  query={query}
                  draggedSegment={draggedSegment}
                  dragOverFolder={dragOverFolder}
                  deletingSegId={deletingSegId}
                  listScrollRef={listScrollRef}
                  segHtmlKey={segHtmlKey}
                  docId={docId}
                  onSelect={handleSelect}
                  onOpen={handleOpen}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onFolderChange={handleFolderChange}
                  onEdit={openChunkEditor}
                  onDelete={handleDeleteSingle}
                  onConfirmDelete={confirmDeleteSingle}
                  onCancelDelete={cancelDelete}
                  onBackToList={() => setOpenSeg(null)}
                  onChunkUpdated={async () => {
                    const [folders, folderMap] = await Promise.all([
                      loadFolders(docId),
                      loadFolderMap(docId),
                    ]);
                    setFolders(folders);
                    setFolderMap(folderMap);
                    setDuplicatedChunks(loadDuplicatedChunks(docId));
                  }}
                  onBackFromFolder={() => setFolderFilter("all")}
                />
              </div>

              <div style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.7 }}>
                Tip: Click = highlight. Double-click = open. Filter = All/Auto/Manual.
              </div>
            </div>
          </div>
              </div>
            </div>

      {/* Document Notes Modal */}
      <DocumentNotesModal
        open={notesOpen}
        onClose={() => setNotesOpen(false)}
        html={noteHtml}
        text={noteText}
        onHtmlChange={(html) => {
          setNoteHtml(html);
          setNoteDirty(true);
        }}
        onTextChange={setNoteText}
        onSave={saveNoteLocal}
        onResetFromDocument={resetNoteFromDocument}
        dirty={noteDirty}
        status={noteStatus}
      />

      {/* Smart Notes Modal */}
      <SmartNotesModal
        open={smartNotesOpen}
        onClose={() => setSmartNotesOpen(false)}
        docId={docId}
        smartNotes={smartNotes}
        currentSmartNote={currentSmartNote}
        smartNoteHtml={smartNoteHtml}
        smartNoteText={smartNoteText}
        smartNoteTags={smartNoteTags}
        smartNoteCategory={smartNoteCategory}
        smartNoteDirty={smartNoteDirty}
        smartNoteStatus={smartNoteStatus}
        smartNoteSearchQuery={smartNoteSearchQuery}
        smartNoteSelectedCategory={smartNoteSelectedCategory}
        smartNoteSelectedTag={smartNoteSelectedTag}
        newTagInput={newTagInput}
        onHtmlChange={(html) => {
          setSmartNoteHtml(html);
          setSmartNoteDirty(true);
        }}
        onTextChange={setSmartNoteText}
        onTagsChange={(tags) => {
          setSmartNoteTags(tags);
          setSmartNoteDirty(true);
        }}
        onCategoryChange={(category) => {
          setSmartNoteCategory(category);
          setSmartNoteDirty(true);
        }}
        onDirtyChange={setSmartNoteDirty}
        onStatusChange={setSmartNoteStatus}
        onSearchQueryChange={setSmartNoteSearchQuery}
        onSelectedCategoryChange={setSmartNoteSelectedCategory}
        onSelectedTagChange={setSmartNoteSelectedTag}
        onNewTagInputChange={setNewTagInput}
        onCreateNew={createNewSmartNote}
        onSave={saveSmartNoteLocal}
        onDelete={deleteSmartNoteLocal}
        onLoadNote={loadSmartNoteForEdit}
        onAddTag={addTagToSmartNote}
        onRemoveTag={removeTagFromSmartNote}
        filteredSmartNotes={filteredSmartNotes}
        allCategories={allCategories}
        allTags={allTags}
      />

      {/* Manual Chunk Modal */}
      <ManualChunkModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        docText={docText}
        mode={mode}
        title={manualTitle}
        onTitleChange={setManualTitle}
        selection={manualSel}
        onSelectionChange={(sel) => {
          setManualSel(sel);
          setManualStatus(sel ? `Selected ${sel.end - sel.start} chars.` : "No selection.");
        }}
        status={manualStatus}
        onStatusChange={setManualStatus}
        onSave={saveManualChunk}
        manualSegments={manualSegments}
        openSegment={manualOpenSeg}
        onOpenSegmentChange={(seg) => {
          if (manualListScrollRef.current) manualLastScrollTopRef.current = manualListScrollRef.current.scrollTop;
          setManualOpenSeg(seg);
        }}
        folderMap={folderMap}
        folders={folders}
        onFolderChange={async (segmentId, folderId) => {
          // For manual chunks, we also need to handle duplicated chunks
          if (!folderId) {
            // Remove from folder - need to also remove duplicated chunk from folder.contents
            const previousFolderId = folderMap[String(segmentId)];
            if (previousFolderId) {
              // Find the duplicated chunk that corresponds to this segment
              const duplicatedChunks = loadDuplicatedChunks(docId);
              const duplicatedChunk = duplicatedChunks.find((chunk) => chunk.originalId === segmentId);
              
              if (duplicatedChunk) {
                // Remove the duplicated chunk from the folder's contents
                await removeChunkFromFolder(docId, previousFolderId, duplicatedChunk.id);
              }
            }
          }
          await setSegmentFolder(docId, segmentId, folderId);
          const [folders, updatedFolderMap] = await Promise.all([
            loadFolders(docId),
            loadFolderMap(docId),
          ]);
          setFolders(folders);
          setFolderMap(updatedFolderMap);
        }}
        onSegmentSelect={(seg) => {
          if (manualClickTimerRef.current) window.clearTimeout(manualClickTimerRef.current);
          manualClickTimerRef.current = window.setTimeout(() => {
            setSelectedSegId(seg.id);
            setManualStatus(`Selected saved chunk: ${seg.title}`);
          }, 170);
        }}
        onSegmentOpen={(seg) => {
          if (manualClickTimerRef.current) window.clearTimeout(manualClickTimerRef.current);
          setSelectedSegId(seg.id);
          if (manualListScrollRef.current) manualLastScrollTopRef.current = manualListScrollRef.current.scrollTop;
          setManualOpenSeg(seg);
        }}
        onSegmentEdit={openChunkEditor}
        onSegmentDelete={handleDeleteSingle}
        deletingSegId={deletingSegId}
        onConfirmDelete={confirmDeleteSingle}
        onCancelDelete={cancelDelete}
        segHtmlKey={segHtmlKey}
      />

      {/* Chunk Edit Modal */}
      <ChunkEditModal
        open={chunkEditOpen}
        segment={chunkEditSeg}
        onClose={() => setChunkEditOpen(false)}
        docText={docText}
        title={chunkEditTitle}
        onTitleChange={setChunkEditTitle}
        html={chunkEditHtml}
        content={chunkEditContent}
        onHtmlChange={(html) => {
          setChunkEditHtml(html);
          setChunkEditDirty(true);
        }}
        onContentChange={setChunkEditContent}
        start={chunkEditStart}
        end={chunkEditEnd}
        onStartChange={setChunkEditStart}
        onEndChange={setChunkEditEnd}
        folderId={chunkEditFolderId}
        onFolderChange={setChunkEditFolderId}
        folders={folders}
        dirty={chunkEditDirty}
        status={chunkEditStatus}
        onStatusChange={setChunkEditStatus}
        onSave={saveChunkEdit}
        fullscreen={chunkEditFullscreen}
        onFullscreenChange={setChunkEditFullscreen}
        showChunkList={showChunkListInEdit}
        onShowChunkListChange={setShowChunkListInEdit}
        showAllChunks={showAllChunksInEdit}
        onShowAllChunksChange={setShowAllChunksInEdit}
        segments={segments}
        onChunkSelect={openChunkEditor}
        syncFromDoc={chunkEditSyncFromDoc}
        onSyncFromDocChange={setChunkEditSyncFromDoc}
      />

      {/* Document Edit Modal */}
      <DocumentEditModal
        open={docEditOpen}
        onClose={() => setDocEditOpen(false)}
        html={docEditHtml}
        text={docEditText}
        onHtmlChange={setDocEditHtml}
        onTextChange={setDocEditText}
        onSave={saveDocEdit}
        status={docEditStatus}
        saving={docEditSaving}
      />

      {/* Folder Manager Drawer */}
      <FolderManagerDrawer
        docId={docId}
        open={foldersOpen}
        onClose={() => setFoldersOpen(false)}
        onChanged={async (updatedFolders) => {
          setFolders(updatedFolders);
          const folderMap = await loadFolderMap(docId);
          setFolderMap(folderMap);
        }}
      />

      {/* Outline Wizard */}
      <OutlineWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        documentId={docId}
        segments={segments.map(s => ({
          id: s.id,
          title: s.title || "",
          content: s.content || "",
          mode: s.mode,
          isManual: s.isManual
        }))}
      />
    </div>
  );
}
