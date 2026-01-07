// C:\Users\anast\PycharmProjects\AI_ORGANIZER_VITE\src\pages\DocumentWorkspace.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  deleteSegments,
  getDocument,
  listSegmentations,
  listSegmentsWithMeta,
  segmentDocument,
  SegmentDTO,
  SegmentationSummary,
  createManualSegment,
  deleteSegment,
  patchSegment,
  patchDocument,
  SegmentsListMeta,
} from "../lib/api";
import { RichTextEditor } from "../editor/RichTextEditor";
import { plainTextToHtml } from "../editor/utils/text";
import SegmentationSummaryBar from "../components/SegmentationSummaryBar";
import FolderManagerDrawer from "../components/FolderManagerDrawer";
import FolderDropZone from "../components/FolderDropZone";
import { loadFolders, loadFolderMap, setSegmentFolder, FolderDTO, addChunkToFolder } from "../lib/segmentFolders";
import { duplicateSegment, loadDuplicatedChunks } from "../lib/chunkDuplication";
import RecycleBinDrawer from "../components/RecycleBinDrawer";
import FolderView from "../components/FolderView";
import OutlineWizard from "../components/OutlineWizard";
import { useMultiLoading } from "../hooks/useLoading";
import { highlightSearch, truncateWithHighlight, FILTER_PRESETS, type SegmentFilters } from "../lib/searchUtils";
import { 
  exportSegmentsToJSON, 
  exportSegmentsToCSV, 
  exportSegmentsToTXT, 
  exportSegmentsToMD,
  downloadFile 
} from "../lib/exportUtils";

type SourceFilter = "all" | "auto" | "manual";
type SelInfo = { start: number; end: number; text: string };

// Utility Functions
function fmt(dt?: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  return isNaN(d.getTime()) ? dt : d.toLocaleString();
}

function preview120(s: string) {
  const oneLine = (s ?? "").replace(/\s+/g, " ").trim();
  return oneLine.length > 120 ? oneLine.slice(0, 120) + "…" : oneLine;
}

// Smart Notes Types (Manual Tags Only)
interface SmartNote {
  id: string;
  content: string;
  html: string;
  tags: string[]; // Manual tags only (user adds them)
  category: string; // Manual category (user chooses)
  timestamp: string;
  chunkId?: number; // Optional link to specific chunk
  priority?: 'low' | 'medium' | 'high';
}

// Smart Notes Functions (Manual Tags Only)
function saveSmartNote(note: Omit<SmartNote, 'id' | 'timestamp'>, docId: number): SmartNote {
  const smartNote: SmartNote = {
    ...note,
    id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    tags: note.tags || [], // Manual tags only
    category: note.category || 'General',
    priority: note.priority || 'medium'
  };
  
  const existingNotes = JSON.parse(localStorage.getItem(`smart_notes_${docId}`) || '[]');
  existingNotes.push(smartNote);
  localStorage.setItem(`smart_notes_${docId}`, JSON.stringify(existingNotes));
  
  return smartNote;
}

function loadSmartNotes(docId: number): SmartNote[] {
  return JSON.parse(localStorage.getItem(`smart_notes_${docId}`) || '[]');
}

function updateSmartNote(docId: number, noteId: string, updates: Partial<SmartNote>): SmartNote | null {
  const notes = loadSmartNotes(docId);
  const index = notes.findIndex(n => n.id === noteId);
  if (index === -1) return null;
  
  notes[index] = { ...notes[index], ...updates };
  localStorage.setItem(`smart_notes_${docId}`, JSON.stringify(notes));
  return notes[index];
}

function deleteSmartNote(docId: number, noteId: string): boolean {
  const notes = loadSmartNotes(docId);
  const filtered = notes.filter(n => n.id !== noteId);
  localStorage.setItem(`smart_notes_${docId}`, JSON.stringify(filtered));
  return filtered.length < notes.length;
}

function searchSmartNotes(notes: SmartNote[], query: string): SmartNote[] {
  if (!query) return notes;
  const lowerQuery = query.toLowerCase();
  return notes.filter(note => 
    note.content.toLowerCase().includes(lowerQuery) ||
    note.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
    note.category.toLowerCase().includes(lowerQuery)
  );
}

function filterSmartNotesByCategory(notes: SmartNote[], category: string): SmartNote[] {
  if (category === 'all') return notes;
  return notes.filter(note => note.category === category);
}

function filterSmartNotesByTag(notes: SmartNote[], tag: string): SmartNote[] {
  if (!tag) return notes;
  return notes.filter(note => note.tags.includes(tag));
}

function htmlToPlainText(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    return (doc.body?.textContent ?? "").replace(/\r\n/g, "\n");
  } catch {
    return "";
  }
}

function badge(parseStatus?: string) {
  if (parseStatus === "ok") return "✅ ok";
  if (parseStatus === "failed") return "⛔ failed";
  if (parseStatus === "pending") return "⛳ pending";
  return parseStatus ? `• ${parseStatus}` : "—";
}

function splitDocByRange(docText: string, start: number, end: number) {
  if (!docText) return { before: "", mid: "", after: "" };
  if (start < 0 || end <= start || end > docText.length) return { before: docText, mid: "", after: "" };
  return { before: docText.slice(0, start), mid: docText.slice(start, end), after: docText.slice(end) };
}

function computeSelectionFromPre(pre: HTMLPreElement, docText: string): SelInfo | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  const range = sel.getRangeAt(0);
  if (!pre.contains(range.startContainer) || !pre.contains(range.endContainer)) return null;

  const r1 = document.createRange();
  r1.setStart(pre, 0);
  r1.setEnd(range.startContainer, range.startOffset);
  const a = r1.toString().length;

  const r2 = document.createRange();
  r2.setStart(pre, 0);
  r2.setEnd(range.endContainer, range.endOffset);
  const b = r2.toString().length;

  const start = Math.min(a, b);
  const end = Math.max(a, b);
  if (end <= start) return null;

  return { start, end, text: docText.slice(start, end) };
}

export default function DocumentWorkspace() {
  const nav = useNavigate();
  const { documentId } = useParams();
  const docId = Number(documentId);
  const location = useLocation() as any;

  // Loading states
  const { setLoading, isLoading, getError } = useMultiLoading();

  const [status, setStatus] = useState<string>("");
  const [docText, setDocText] = useState<string>("");
  const [filename, setFilename] = useState<string | null>(location?.state?.filename ?? null);

  // ingest fields
  const [parseStatus, setParseStatus] = useState<string>("pending");
  const [parseError, setParseError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<string | null>(null);

  // summary + list
  const [summary, setSummary] = useState<SegmentationSummary[]>([]);
  const [mode, setMode] = useState<"qa" | "paragraphs">("qa");
  const [segments, setSegments] = useState<SegmentDTO[]>([]);
  const [segmentsMeta, setSegmentsMeta] = useState<SegmentsListMeta | null>(null);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [minLength, setMinLength] = useState<number | undefined>(undefined);
  const [maxLength, setMaxLength] = useState<number | undefined>(undefined);
  const [activePreset, setActivePreset] = useState<string>("all");

  // selection / viewer
  const [selectedSegId, setSelectedSegId] = useState<number | null>(null);
  const [openSeg, setOpenSeg] = useState<SegmentDTO | null>(null);
  const highlightRef = useRef<HTMLSpanElement | null>(null);

  // list scroll memory
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef<number>(0);
  const clickTimerRef = useRef<number | null>(null);

  // manual modal
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const manualPreRef = useRef<HTMLPreElement | null>(null);
  const [manualSel, setManualSel] = useState<SelInfo | null>(null);
  const [manualStatus, setManualStatus] = useState<string>("");
  const [manualOpenSeg, setManualOpenSeg] = useState<SegmentDTO | null>(null);
  const manualListScrollRef = useRef<HTMLDivElement | null>(null);
  const manualLastScrollTopRef = useRef<number>(0);
  const manualClickTimerRef = useRef<number | null>(null);

  // chunk edit modal
  const [chunkEditOpen, setChunkEditOpen] = useState(false);
  const [chunkEditSeg, setChunkEditSeg] = useState<SegmentDTO | null>(null);
  const [chunkEditTitle, setChunkEditTitle] = useState("");
  const [chunkEditStart, setChunkEditStart] = useState<number>(0);
  const [chunkEditEnd, setChunkEditEnd] = useState<number>(0);
  const [chunkEditContent, setChunkEditContent] = useState("");
  const [chunkEditHtml, setChunkEditHtml] = useState<string>("<p></p>");
  const [chunkEditDirty, setChunkEditDirty] = useState<boolean>(false);
  const [chunkEditStatus, setChunkEditStatus] = useState("");
  const [chunkEditFolderId, setChunkEditFolderId] = useState<string | null>(null);
  const chunkEditPreRef = useRef<HTMLPreElement | null>(null);
  const [chunkEditSyncFromDoc, setChunkEditSyncFromDoc] = useState(true);

  // document edit modal
  const [docEditOpen, setDocEditOpen] = useState(false);
  const [docEditText, setDocEditText] = useState("");
  const [docEditHtml, setDocEditHtml] = useState<string>("<p></p>");
  const [docEditStatus, setDocEditStatus] = useState("");
  const [docEditSaving, setDocEditSaving] = useState(false);

  // chunk editing layout state
  const [chunkEditFullscreen, setChunkEditFullscreen] = useState(false);
  const [showChunkListInEdit, setShowChunkListInEdit] = useState(true);
  const [showAllChunksInEdit, setShowAllChunksInEdit] = useState(false);

  // Notes (Word-like) stored locally per document
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteHtml, setNoteHtml] = useState<string>("<p></p>");
  const [noteText, setNoteText] = useState<string>("");
  const [noteStatus, setNoteStatus] = useState<string>("");
  const [noteDirty, setNoteDirty] = useState<boolean>(false);

  // Document Notes - Simplified
  // Smart Notes - Organized notes with manual tags
  const [smartNotesOpen, setSmartNotesOpen] = useState(false);
  const [smartNotes, setSmartNotes] = useState<SmartNote[]>([]);
  const [currentSmartNote, setCurrentSmartNote] = useState<SmartNote | null>(null);
  const [smartNoteHtml, setSmartNoteHtml] = useState<string>("<p></p>");
  const [smartNoteText, setSmartNoteText] = useState<string>("");
  const [smartNoteTags, setSmartNoteTags] = useState<string[]>([]);
  const [smartNoteCategory, setSmartNoteCategory] = useState<string>("General");
  const [smartNoteChunkId, setSmartNoteChunkId] = useState<number | undefined>(undefined);
  const [smartNoteDirty, setSmartNoteDirty] = useState<boolean>(false);
  const [smartNoteStatus, setSmartNoteStatus] = useState<string>("");
  
  // Smart Notes Search & Filter
  const [smartNoteSearchQuery, setSmartNoteSearchQuery] = useState<string>("");
  const [smartNoteSelectedCategory, setSmartNoteSelectedCategory] = useState<string>("all");
  const [smartNoteSelectedTag, setSmartNoteSelectedTag] = useState<string>("");
  const [newTagInput, setNewTagInput] = useState<string>("");

  // local HTML per segment
  const segHtmlKey = (segId: number) => `aiorg_seg_html_${segId}`;

  const [foldersOpen, setFoldersOpen] = useState(false);
  const [folders, setFolders] = useState<FolderDTO[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>("all"); // all | none | <folderId>
  const [folderMap, setFolderMap] = useState<Record<string, string>>({});

  // Drag and drop state
  const [draggedSegment, setDraggedSegment] = useState<any | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Deletion confirmation state
  const [deletingSegId, setDeletingSegId] = useState<number | null>(null);
  const [deletingManualSegId, setDeletingManualSegId] = useState<number | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);

  // Recycle bin state
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [duplicatedChunks, setDuplicatedChunks] = useState<any[]>([]);

  // Folder navigation state
  const [currentFolder, setCurrentFolder] = useState<FolderDTO | null>(null);

  const canSegment = parseStatus === "ok";

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
  const handleDropOnFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    if (draggedSegment) {
      // Create duplicate and add to folder
      const duplicated = duplicateSegment(draggedSegment, docId);
      if (duplicated) {
        setSegmentFolder(docId, draggedSegment.id, folderId);
        addChunkToFolder(docId, folderId, duplicated.id);
        setFolderMap(loadFolderMap(docId));
        setDuplicatedChunks(loadDuplicatedChunks(docId));
        setFolders(loadFolders(docId)); // Update folders state
      }
    }
    setDragOverFolder(null);
  };

  // Handle drop on "No folder"
  const handleDropOnNoFolder = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedSegment) {
      setSegmentFolder(docId, draggedSegment.id, null);
      setFolderMap(loadFolderMap(docId));
    }
    setDragOverFolder(null);
  };

  async function loadDocument() {
    setLoading("document", true);
    setStatus("Loading document...");
    try {
      const d = await getDocument(docId);
      const text = d.text ?? "";
      setDocText(text);

      if (!filename && d.filename) setFilename(d.filename);

      setParseStatus(d.parseStatus ?? "pending");
      setParseError((d.parseError as any) ?? null);
      setSourceType((d.sourceType as any) ?? null);

      // Notes load (local). If none, seed from doc (non-destructive)
      const stored = localStorage.getItem(`aiorg_note_html_doc_${docId}`);
      if (stored && stored.trim()) {
        setNoteHtml(stored);
        setNoteText(htmlToPlainText(stored));
      } else {
        setNoteHtml(plainTextToHtml(text));
        setNoteText(text);
      }
      setNoteDirty(false);
      setNoteStatus("");

      setStatus("");
    } catch (e: any) {
      setStatus(`Failed to load document: ${e?.message ?? String(e)}`);
    } finally {
      setLoading("document", false);
    }
  }

  async function loadSummary() {
    setLoading("summary", true);
    try {
      const rows = await listSegmentations(docId);
      setSummary(Array.isArray(rows) ? rows : []);
    } catch {
      setSummary([]);
    } finally {
      setLoading("summary", false);
    }
  }

  async function loadSegs(m?: "qa" | "paragraphs") {
    const useMode = m ?? mode;
    setLoading("segments", true);
    setStatus("Loading segments...");
    try {
      const out = await listSegmentsWithMeta(docId, useMode);
      setSegments(Array.isArray(out.items) ? out.items : []);
      setSegmentsMeta(out.meta ?? null);

      setSelectedSegId(null);
      setOpenSeg(null);

      const last = out.meta?.lastRun ? fmt(out.meta.lastRun) : "—";
      setStatus(`Loaded ${out.items.length} segments (${useMode}) • lastRun: ${last}`);
    } catch (e: any) {
      setStatus(e?.message ?? "List failed");
    } finally {
      setLoading("segments", false);
    }
  }

  async function runSegmentation() {
    if (!canSegment) {
      setStatus(`Cannot segment: parseStatus="${parseStatus}". Fix upload/parse first.`);
      return;
    }

    setStatus("Segmenting...");
    try {
      await segmentDocument(docId, mode);
      await loadSummary();
      await loadSegs(mode);
      setStatus(`Segmented (${mode})`);
    } catch (e: any) {
      setStatus(e?.message ?? "Segment failed");
    }
  }

  async function deleteModeSegments() {
    const ok = window.confirm(`Delete AUTO segments for mode "${mode}"? (Manual chunks will stay)`);
    if (!ok) return;

    setStatus("Deleting segments...");
    try {
      await deleteSegments(docId, mode);
      await loadSummary();
      await loadSegs(mode);
      setSelectedSegId(null);
      setOpenSeg(null);
      setStatus(`Deleted auto segments (${mode}).`);
    } catch (e: any) {
      setStatus(e?.message ?? "Delete failed");
    }
  }

  async function handleDeleteSingle(seg: SegmentDTO) {
    // Check if there are duplicates in folders
    const hasDuplicates = duplicatedChunks.some(d => d.originalId === seg.id);
    if (hasDuplicates) {
      setStatus("Cannot delete original chunk that has duplicates in folders. Delete the duplicates first.");
      return;
    }
    
    setDeletingSegId(seg.id);
  }

  async function confirmDeleteSingle(seg: SegmentDTO) {
    setStatus("Deleting chunk...");
    try {
      await deleteSegment(seg.id);
      setSegments((prev) => prev.filter((x) => x.id !== seg.id));

      if (selectedSegId === seg.id) setSelectedSegId(null);
      if (openSeg?.id === seg.id) setOpenSeg(null);
      if (manualOpenSeg?.id === seg.id) setManualOpenSeg(null);

      setStatus("Chunk deleted.");
      await loadSummary();
    } catch (e: any) {
      setStatus(e?.message ?? "Delete failed");
    }
    setDeletingSegId(null);
  }

  function cancelDelete() {
    setDeletingSegId(null);
  }

  function captureManualSelection() {
    const pre = manualPreRef.current;
    if (!pre) return;
    const info = computeSelectionFromPre(pre, docText);
    setManualSel(info);
    setManualStatus(info ? `Selected ${info.end - info.start} chars.` : "No selection.");
  }

  async function saveManualChunk() {
    if (!manualSel) {
      setManualStatus("Pick some text (drag) first.");
      return;
    }

    try {
      setManualStatus("Saving...");
      const created = await createManualSegment(docId, {
        mode,
        title: manualTitle.trim() ? manualTitle.trim() : null,
        start: manualSel.start,
        end: manualSel.end,
      });

      await loadSummary();
      await loadSegs(mode);

      setSelectedSegId(created.id);
      setManualStatus(`Saved: ${created.title}`);
      setManualTitle("");
      setManualSel(null);
      setManualOpenSeg(null);
    } catch (e: any) {
      setManualStatus(e?.message ?? "Manual save failed");
    }
  }

  function openChunkEditor(seg: SegmentDTO) {
    setChunkEditSeg(seg);
    setChunkEditTitle(seg.title ?? "");
    setChunkEditStart(typeof seg.start === "number" ? seg.start : 0);
    setChunkEditEnd(typeof seg.end === "number" ? seg.end : 0);

    const plain = seg.content ?? "";
    setChunkEditContent(plain);

    const storedHtml = localStorage.getItem(segHtmlKey(seg.id));
    const html = storedHtml && storedHtml.trim() ? storedHtml : plainTextToHtml(plain);
    setChunkEditHtml(html);

    const currentFolderId = folderMap[String(seg.id)] ?? null;
    setChunkEditFolderId(currentFolderId);

    setChunkEditDirty(false);
    setChunkEditStatus("");
    setChunkEditSyncFromDoc(true);
    setChunkEditOpen(true);
  }

  function captureChunkSelection() {
    const pre = chunkEditPreRef.current;
    if (!pre) return;

    const info = computeSelectionFromPre(pre, docText);
    if (!info) {
      setChunkEditStatus("No selection.");
      return;
    }

    setChunkEditStart(info.start);
    setChunkEditEnd(info.end);

    if (chunkEditSyncFromDoc) {
      setChunkEditContent(info.text);
      setChunkEditHtml(plainTextToHtml(info.text));
      setChunkEditDirty(true);
    }

    setChunkEditStatus(`Selected ${info.end - info.start} chars from document.`);
  }

  async function saveChunkEdit() {
    if (!chunkEditSeg) return;

    try {
      setChunkEditStatus("Saving...");

      const patch: any = {
        title: chunkEditTitle.trim() ? chunkEditTitle.trim() : "",
        content: chunkEditContent,
      };

      if (Number.isFinite(chunkEditStart) && Number.isFinite(chunkEditEnd) && chunkEditEnd > chunkEditStart) {
        patch.start = chunkEditStart;
        patch.end = chunkEditEnd;
      }

      const updated = await patchSegment(chunkEditSeg.id, patch);

      setSegments((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setOpenSeg((prev) => (prev?.id === updated.id ? updated : prev));
      setManualOpenSeg((prev) => (prev?.id === updated.id ? updated : prev));
      if (selectedSegId === updated.id) setSelectedSegId(updated.id);

      setChunkEditSeg(updated);
      setChunkEditStatus("Saved ✅");

      // Update folder assignment
      setSegmentFolder(docId, updated.id, chunkEditFolderId);
      setFolderMap(loadFolderMap(docId));

      // persist HTML locally for viewing
      try {
        localStorage.setItem(segHtmlKey(updated.id), chunkEditHtml);
        setChunkEditDirty(false);
      } catch {
        // ignore
      }

      await loadSummary();
    } catch (e: any) {
      setChunkEditStatus(e?.message ?? "Save failed");
    }
  }

  function openDocEditor() {
    setDocEditText(docText);
    setDocEditHtml(plainTextToHtml(docText));
    setDocEditStatus("");
    setDocEditSaving(false);
    setDocEditOpen(true);
  }

  async function saveDocEdit() {
    try {
      setDocEditSaving(true);
      setDocEditStatus("Saving...");
      await patchDocument(docId, { text: docEditText });

      await loadDocument(); // refresh parse fields too
      setDocEditStatus("Saved ✅");
      setDocEditOpen(false);

      await loadSummary();
    } catch (e: any) {
      setDocEditSaving(false);
      setDocEditStatus(e?.message ?? "Failed to save document");
    }
  }

  function saveNoteLocal() {
    try {
      // ✅ Simplified: Just save document notes (removed Smart Notes complexity)
      localStorage.setItem(`aiorg_note_html_doc_${docId}`, noteHtml);
      setNoteDirty(false);
      setNoteStatus("Document notes saved ✅");
    } catch (e: any) {
      setNoteStatus(`Failed to save notes: ${e?.message ?? String(e)}`);
    }
  }

  function resetNoteFromDocument() {
    setNoteHtml(plainTextToHtml(docText));
    setNoteText(docText);
    setNoteDirty(true);
    setNoteStatus("Notes replaced from current document text (not saved yet).");
  }

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

  // Smart Notes Functions
  function createNewSmartNote() {
    setCurrentSmartNote(null);
    setSmartNoteHtml("<p></p>");
    setSmartNoteText("");
    setSmartNoteTags([]);
    setSmartNoteCategory("General");
    setSmartNoteChunkId(undefined);
    setSmartNoteDirty(false);
    setSmartNoteStatus("");
  }

  function loadSmartNoteForEdit(note: SmartNote) {
    setCurrentSmartNote(note);
    setSmartNoteHtml(note.html);
    setSmartNoteText(note.content);
    setSmartNoteTags([...note.tags]);
    setSmartNoteCategory(note.category);
    setSmartNoteChunkId(note.chunkId);
    setSmartNoteDirty(false);
    setSmartNoteStatus("");
  }

  function saveSmartNoteLocal() {
    try {
      if (!smartNoteText.trim()) {
        setSmartNoteStatus("Note content cannot be empty");
        return;
      }

      if (currentSmartNote) {
        // Update existing note
        const updated = updateSmartNote(docId, currentSmartNote.id, {
          content: smartNoteText,
          html: smartNoteHtml,
          tags: smartNoteTags,
          category: smartNoteCategory,
          chunkId: smartNoteChunkId,
        });
        
        if (updated) {
          setSmartNotes(loadSmartNotes(docId));
          setSmartNoteDirty(false);
          setSmartNoteStatus(`Smart Note updated ✅ (${updated.tags.length} tags, ${updated.category})`);
        } else {
          setSmartNoteStatus("Failed to update note");
        }
      } else {
        // Create new note
        const newNote = saveSmartNote({
          content: smartNoteText,
          html: smartNoteHtml,
          tags: smartNoteTags,
          category: smartNoteCategory,
          chunkId: smartNoteChunkId,
          priority: 'medium'
        }, docId);
        
        setSmartNotes(loadSmartNotes(docId));
        setCurrentSmartNote(newNote);
        setSmartNoteDirty(false);
        setSmartNoteStatus(`Smart Note saved ✅ (${newNote.tags.length} tags, ${newNote.category})`);
      }
    } catch (e: any) {
      setSmartNoteStatus(`Failed to save note: ${e?.message ?? String(e)}`);
    }
  }

  function deleteSmartNoteLocal(noteId: string) {
    if (window.confirm("Delete this Smart Note? This cannot be undone.")) {
      if (deleteSmartNote(docId, noteId)) {
        setSmartNotes(loadSmartNotes(docId));
        if (currentSmartNote?.id === noteId) {
          createNewSmartNote();
        }
        setSmartNoteStatus("Note deleted ✅");
      }
    }
  }

  function addTagToSmartNote(tag: string) {
    const trimmed = tag.trim();
    if (trimmed && !smartNoteTags.includes(trimmed)) {
      setSmartNoteTags([...smartNoteTags, trimmed]);
      setSmartNoteDirty(true);
      setNewTagInput("");
    }
  }

  function removeTagFromSmartNote(tag: string) {
    setSmartNoteTags(smartNoteTags.filter(t => t !== tag));
    setSmartNoteDirty(true);
  }

  const filteredSmartNotes = useMemo(() => {
    let filtered = smartNotes;
    if (smartNoteSearchQuery) filtered = searchSmartNotes(filtered, smartNoteSearchQuery);
    if (smartNoteSelectedCategory !== 'all') filtered = filterSmartNotesByCategory(filtered, smartNoteSelectedCategory);
    if (smartNoteSelectedTag) filtered = filterSmartNotesByTag(filtered, smartNoteSelectedTag);
    return filtered;
  }, [smartNotes, smartNoteSearchQuery, smartNoteSelectedCategory, smartNoteSelectedTag]);

  const allCategories = useMemo(() => {
    return [...new Set(smartNotes.map(n => n.category))].sort();
  }, [smartNotes]);

  const allTags = useMemo(() => {
    return [...new Set(smartNotes.flatMap(n => n.tags))].sort();
  }, [smartNotes]);

  useEffect(() => {
    if (!Number.isFinite(docId)) return;

    loadDocument();
    loadSummary();

    try {
    setFolders(loadFolders(docId));
    setFolderMap(loadFolderMap(docId));
      setDuplicatedChunks(loadDuplicatedChunks(docId));
      // Load Smart Notes
      setSmartNotes(loadSmartNotes(docId));
  } catch {
    setFolders([]);
    setFolderMap({});
      setDuplicatedChunks([]);
      setSmartNotes([]);
  }

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
              <span style={{ fontWeight: 600, color: "#eaeaea", fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)" }}>Ingest:</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  fontSize: "var(--font-size-sm)",
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
              <span style={{ fontWeight: 700, fontSize: "var(--font-size-base)", lineHeight: "var(--line-height-normal)", color: "#eaeaea" }}>Workspace</span>
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

            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ opacity: 0.85, fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)", color: "rgba(255, 255, 255, 0.7)", fontWeight: 500 }}>Mode:</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                style={{
                  padding: "10px 14px",
                  background: "rgba(0, 0, 0, 0.3)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "10px",
                  color: "#eaeaea",
                  fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.5)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <option value="qa">qa</option>
                <option value="paragraphs">paragraphs</option>
              </select>

              <button
                onClick={() => loadSegs()}
                style={{
                  padding: "10px 16px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "10px",
                  color: "#eaeaea",
                  fontWeight: 600,
                  fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                List segments
              </button>

              <button
                onClick={runSegmentation}
                disabled={!canSegment}
                style={{
                  padding: "10px 16px",
                  background: canSegment ? "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)" : "rgba(107, 114, 128, 0.3)",
                  border: "none",
                  borderRadius: "10px",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                  cursor: canSegment ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                  boxShadow: canSegment ? "0 2px 8px rgba(99, 102, 241, 0.3)" : "none",
                  opacity: canSegment ? 1 : 0.6,
                }}
                title={!canSegment ? "parseStatus must be ok." : ""}
                onMouseEnter={(e) => {
                  if (canSegment) {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.4)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = canSegment ? "0 2px 8px rgba(99, 102, 241, 0.3)" : "none";
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Segment now
              </button>

              <button
                onClick={deleteModeSegments}
                style={{
                  padding: "10px 16px",
                  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  border: "none",
                  borderRadius: "10px",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                  boxShadow: "0 2px 8px rgba(239, 68, 68, 0.3)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(239, 68, 68, 0.3)";
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete mode segments
              </button>

              <button
                onClick={() => {
                  setManualOpen(true);
                  setManualStatus("Select text (drag) on the left, then Save.");
                  setManualSel(null);
                  setManualTitle("");
                  setManualOpenSeg(null);
                }}
                className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2"
                style={{ 
                  padding: "8px 10px",
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-normal)",
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Manual chunk
              </button>

              <div style={{ position: "relative" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const menu = document.getElementById('export-segments-menu');
                    if (menu) {
                      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                    }
                  }}
                  disabled={filteredSegments.length === 0}
                  className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2"
                  style={{ 
                    padding: "8px 10px",
                    fontSize: "var(--font-size-base)",
                    lineHeight: "var(--line-height-normal)",
                    opacity: filteredSegments.length === 0 ? 0.5 : 1,
                    cursor: filteredSegments.length === 0 ? "not-allowed" : "pointer",
                  }}
                  title={`Export ${filteredSegments.length} segment(s)`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export ({filteredSegments.length})
                </button>
                <div
                  id="export-segments-menu"
                  style={{
                    display: "none",
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    marginTop: "8px",
                    background: "rgba(20, 20, 30, 0.95)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    padding: "8px",
                    minWidth: "180px",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                    zIndex: 1000,
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                >
                  <button
                    onClick={() => {
                      const content = exportSegmentsToJSON(filteredSegments, { format: 'json', includeMetadata: true });
                      const filename = `segments_${docId}_${mode}_${new Date().toISOString().split('T')[0]}.json`;
                      downloadFile(content, filename, 'application/json');
                      const menu = document.getElementById('export-segments-menu');
                      if (menu) menu.style.display = 'none';
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      background: "transparent",
                      border: "none",
                      borderRadius: "8px",
                      color: "#eaeaea",
                      fontSize: "14px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Export as JSON
                  </button>
                  <button
                    onClick={() => {
                      const content = exportSegmentsToCSV(filteredSegments);
                      const filename = `segments_${docId}_${mode}_${new Date().toISOString().split('T')[0]}.csv`;
                      downloadFile(content, filename, 'text/csv');
                      const menu = document.getElementById('export-segments-menu');
                      if (menu) menu.style.display = 'none';
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      background: "transparent",
                      border: "none",
                      borderRadius: "8px",
                      color: "#eaeaea",
                      fontSize: "14px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => {
                      const content = exportSegmentsToTXT(filteredSegments, { format: 'txt', includeMetadata: true });
                      const filename = `segments_${docId}_${mode}_${new Date().toISOString().split('T')[0]}.txt`;
                      downloadFile(content, filename, 'text/plain');
                      const menu = document.getElementById('export-segments-menu');
                      if (menu) menu.style.display = 'none';
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      background: "transparent",
                      border: "none",
                      borderRadius: "8px",
                      color: "#eaeaea",
                      fontSize: "14px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Export as TXT
                  </button>
                  <button
                    onClick={() => {
                      const content = exportSegmentsToMD(filteredSegments, { format: 'md', includeMetadata: true });
                      const filename = `segments_${docId}_${mode}_${new Date().toISOString().split('T')[0]}.md`;
                      downloadFile(content, filename, 'text/markdown');
                      const menu = document.getElementById('export-segments-menu');
                      if (menu) menu.style.display = 'none';
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 16px",
                      background: "transparent",
                      border: "none",
                      borderRadius: "8px",
                      color: "#eaeaea",
                      fontSize: "14px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    Export as Markdown
                  </button>
                </div>
              </div>

              <button 
                onClick={() => setNotesOpen((v) => !v)} 
                className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2" 
                style={{ 
                  padding: "8px 10px",
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-normal)",
                }}
                title="Document Notes - Write and save notes about this document"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                {notesOpen ? "Hide Document Notes" : "Document Notes"}
              </button>
              
              <button 
                onClick={() => {
                  setSmartNotesOpen((v) => !v);
                  if (!smartNotesOpen) {
                    setSmartNotes(loadSmartNotes(docId));
                    createNewSmartNote();
                  }
                }} 
                className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2" 
                style={{ 
                  padding: "8px 10px",
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-normal)",
                }}
                title="Smart Notes - Organize your thoughts with tags and categories. Create multiple notes, search and filter them easily."
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {smartNotesOpen ? "Hide Smart Notes" : `Smart Notes (${smartNotes.length})`}
              </button>
            </div>

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


            {/* Search + Source filter */}
            <div className="mt-2 flex items-center gap-2 flex-wrap" style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
                className="px-3 py-2 bg-surface border border-border rounded"
                style={{ padding: "8px 10px" }}
              >
                <option value="all">All chunks</option>
                <option value="auto">Auto only</option>
                <option value="manual">Manual only</option>
              </select>
              <select
                value={folderFilter}
                onChange={(e) => setFolderFilter(e.target.value)}
                className="px-3 py-2 bg-surface border border-border rounded"
                style={{ padding: "8px 10px" }}
              >
                <option value="all">All folders</option>
                <option value="none">Unfoldered</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>

              <button onClick={() => setFoldersOpen(true)} className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2" style={{ padding: "8px 10px" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Folders
              </button>

              <button onClick={() => setWizardOpen(true)} className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2" style={{ padding: "8px 10px" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Document Structure
              </button>

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="🔍 Search chunks..."
                className="flex-1 min-w-0 px-3 py-2 bg-surface border border-border rounded"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#0f1420",
                  color: "#eaeaea",
                  fontSize: "var(--font-size-base)",
                }}
              />
              <button 
                onClick={() => {
                  setQuery("");
                  setMinLength(undefined);
                  setMaxLength(undefined);
                  setActivePreset("all");
                }} 
                disabled={!query && !minLength && !maxLength} 
                className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors" 
                style={{ padding: "8px 10px", opacity: (query || minLength || maxLength) ? 1 : 0.6 }}
                title="Clear all filters"
              >
                Clear
              </button>
              <select
                value={activePreset}
                onChange={(e) => {
                  const preset = e.target.value;
                  setActivePreset(preset);
                  if (preset === "all") {
                    setMinLength(undefined);
                    setMaxLength(undefined);
                    setSourceFilter("all");
                  } else if (preset === "long") {
                    setMinLength(500);
                    setMaxLength(undefined);
                  } else if (preset === "short") {
                    setMinLength(undefined);
                    setMaxLength(200);
                  } else if (preset === "manual") {
                    setSourceFilter("manual");
                  } else if (preset === "auto") {
                    setSourceFilter("auto");
                  }
                }}
                className="px-3 py-2 bg-surface border border-border rounded"
                style={{ padding: "8px 10px", fontSize: "var(--font-size-base)" }}
                title="Filter presets"
              >
                {Object.entries(FILTER_PRESETS).map(([key, preset]) => (
                  <option key={key} value={key}>{preset.name}</option>
                ))}
              </select>
              <button
                onClick={() => setAdvancedFiltersOpen(!advancedFiltersOpen)}
                className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2"
                style={{ 
                  padding: "8px 10px",
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
                  <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(255, 255, 255, 0.7)" }}>
                    Min Length:
                  </label>
                  <input
                    type="number"
                    value={minLength ?? ""}
                    onChange={(e) => setMinLength(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="0"
                    style={{
                      width: 100,
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      background: "rgba(0, 0, 0, 0.3)",
                      color: "#eaeaea",
                      fontSize: 12,
                    }}
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "rgba(255, 255, 255, 0.7)" }}>
                    Max Length:
                  </label>
                  <input
                    type="number"
                    value={maxLength ?? ""}
                    onChange={(e) => setMaxLength(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="∞"
                    style={{
                      width: 100,
                      padding: "6px 10px",
                      borderRadius: 6,
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      background: "rgba(0, 0, 0, 0.3)",
                      color: "#eaeaea",
                      fontSize: 12,
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)", marginLeft: "auto" }}>
                  {filteredSegments.length} / {segments.length} segments
                </div>
              </div>
            )}
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
                {!openSeg ? (
                  <div ref={listScrollRef} style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "auto" }}>
                    {folderFilter !== "all" && folderFilter !== "none" ? (() => {
                      const selectedFolder = folders.find(f => f.id === folderFilter);
                      return selectedFolder ? (
                        // Show folder view when a specific folder is selected
                        <FolderView
                          docId={docId}
                          folder={selectedFolder}
                          onBack={() => setFolderFilter("all")}
                          onChunkUpdated={() => {
                            setDuplicatedChunks(loadDuplicatedChunks(docId));
                            setFolders(loadFolders(docId));
                          }}
                        />
                      ) : (
                        <div style={{ padding: 12, opacity: 0.7 }}>Folder not found.</div>
                      );
                    })() : (
                      // Show regular segments list
                      <>
                    <div style={{ padding: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                      <span>Chunks</span>
                      <span style={{ opacity: 0.7, fontWeight: 400 }}>
                        {segments.length ? `${filteredSegments.length}/${segments.length}` : "—"}
                      </span>
                    </div>

                    {!segments.length ? (
                          <div style={{ padding: 12, opacity: 0.7 }}>No chunks loaded. Click "List segments".</div>
                    ) : !filteredSegments.length ? (
                      <div style={{ padding: 12, opacity: 0.7 }}>No results.</div>
                    ) : (
                      <div style={{ padding: 8, display: "grid", gap: 8 }}>
                        {filteredSegments.map((s: any) => {
                          const active = selectedSegId === s.id;
                          return (
                            <div
                              key={s.id}
                              onClick={() => handleSelect(s)}
                              onDoubleClick={() => handleOpen(s)}
                                  title="Click to select & highlight. Double-click to open. Drag to move to folder."
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, s)}
                                  onDragEnd={handleDragEnd}
                                  className={`cursor-move transition-all duration-200 ${
                                    draggedSegment?.id === s.id ? 'opacity-50' : ''
                                  } ${dragOverFolder ? 'ring-2 ring-primary/50' : ''}`}
                              style={{
                                cursor: "pointer",
                                padding: 10,
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,0.10)",
                                background: active ? "rgba(114,255,191,0.10)" : "rgba(255,255,255,0.03)",
                                userSelect: "none",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                <b style={{ fontSize: 13 }}>
                                  {(s.orderIndex ?? 0) + 1}.{" "}
                                  {query.trim() ? (
                                    highlightSearch(s.title ?? "", query).map((part, idx) => (
                                      <span
                                        key={idx}
                                        style={part.highlighted ? {
                                          background: "rgba(99, 102, 241, 0.3)",
                                          color: "#a5b4fc",
                                          fontWeight: 700,
                                          padding: "2px 4px",
                                          borderRadius: 4,
                                        } : {}}
                                      >
                                        {part.text}
                                      </span>
                                    ))
                                  ) : (
                                    s.title
                                  )}
                                  <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>{s.isManual ? "manual" : "auto"}</span>
                                      {folderMap[String(s.id)] ? (
                                        <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7, color: "#72ffbf" }}>
                                          📁 {folders.find((f) => f.id === folderMap[String(s.id)])?.name ?? "?"}
                                        </span>
                                      ) : null}
                                </b>

                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <span style={{ fontSize: 12, opacity: 0.7 }}>{s.mode}</span>

                                      <select
                                        value={folderMap[String(s.id)] ?? "none"}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const folderId = e.target.value === "none" ? null : e.target.value;

                                          if (folderId) {
                                            // Create duplicate and add to folder
                                            const duplicated = duplicateSegment(s, docId);
                                            if (duplicated) {
                                              setSegmentFolder(docId, s.id, folderId);
                                              addChunkToFolder(docId, folderId, duplicated.id);
                                              setFolderMap(loadFolderMap(docId));
                                              setDuplicatedChunks(loadDuplicatedChunks(docId) as any);
                                              setFolders(loadFolders(docId)); // Update folders state
                                            }
                                          } else {
                                            setSegmentFolder(docId, s.id, null);
                                            setFolderMap(loadFolderMap(docId));
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                          padding: "4px 8px",
                                          borderRadius: 6,
                                          border: "1px solid rgba(255,255,255,0.12)",
                                          background: "#0f1420",
                                          color: "#eaeaea",
                                          fontSize: 11,
                                        }}
                                      >
                                        <option value="none">No folder</option>
                                        {folders.map((f) => (
                                          <option key={f.id} value={f.id}>
                                            {f.name}
                                          </option>
                                        ))}
                                      </select>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openChunkEditor(s);
                                    }}
                                    style={{ padding: "4px 10px" }}
                                  >
                                    Edit
                                  </button>

                                      {deletingSegId === s.id ? (
                                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                          <span style={{ fontSize: 11, opacity: 0.7 }}>Delete?</span>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              confirmDeleteSingle(s);
                                            }}
                                            style={{
                                              padding: "3px 8px",
                                              fontSize: 11,
                                              background: "rgba(239, 68, 68, 0.2)",
                                              border: "1px solid rgba(239, 68, 68, 0.4)",
                                              color: "#ef4444",
                                              borderRadius: 4,
                                              cursor: "pointer",
                                              transition: "all 0.2s",
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)";
                                              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.6)";
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                                              e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
                                            }}
                                          >
                                            ✓
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              cancelDelete();
                                            }}
                                            style={{
                                              padding: "3px 8px",
                                              fontSize: 11,
                                              background: "rgba(255, 255, 255, 0.1)",
                                              border: "1px solid rgba(255, 255, 255, 0.2)",
                                              color: "#eaeaea",
                                              borderRadius: 4,
                                              cursor: "pointer",
                                              transition: "all 0.2s",
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                                              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                                              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                                            }}
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSingle(s);
                                    }}
                                          style={{
                                            padding: "4px 10px",
                                            fontSize: 11,
                                            background: "rgba(239, 68, 68, 0.1)",
                                            border: "1px solid rgba(239, 68, 68, 0.2)",
                                            color: "#ef4444",
                                            borderRadius: 6,
                                            cursor: "pointer",
                                            transition: "all 0.2s",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 4,
                                          }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                                            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
                                            e.currentTarget.style.transform = "scale(1.05)";
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                                            e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.2)";
                                            e.currentTarget.style.transform = "scale(1)";
                                          }}
                                          title="Delete chunk"
                                        >
                                          🗑️ Delete
                                  </button>
                                      )}
                                </div>
                              </div>
                                  <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                                    {preview120(s.content)}
                                  </div>
                            </div>
                          );
                        })}
                      </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
                    <div
                      style={{
                        padding: 12,
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flex: "0 0 auto",
                      }}
                    >
                      <b style={{ flex: 1 }}>
                        {(((openSeg as any).orderIndex ?? 0) as number) + 1}. {(openSeg as any).title}{" "}
                        <span style={{ fontSize: 12, opacity: 0.7 }}>{(openSeg as any).isManual ? "• manual" : "• auto"}</span>
                      </b>

                      <button onClick={() => openSeg && openChunkEditor(openSeg)} style={{ padding: "8px 10px" }}>
                        Edit
                      </button>

                      <button onClick={() => setOpenSeg(null)} style={{ padding: "8px 10px" }}>
                        Back to list
                      </button>
                    </div>

                    <div style={{ padding: 12, overflow: "auto", flex: "1 1 auto", minHeight: 0 }}>
                      <div
                        style={{ lineHeight: 1.55 }}
                        dangerouslySetInnerHTML={{
                          __html: localStorage.getItem(segHtmlKey((openSeg as any).id)) || plainTextToHtml((openSeg as any).content || ""),
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12, opacity: 0.7 }}>
                Tip: Click = highlight. Double-click = open. Filter = All/Auto/Manual.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes Editor Modal */}
      {notesOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", padding: 18, zIndex: 70 }}>
            <div
              style={{
              flex: 1,
              background: "#0b0e14",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
                overflow: "hidden",
              display: "flex",
              flexDirection: "column",
                minHeight: 0,
              maxWidth: "1200px",
              margin: "0 auto"
              }}
            >
            {/* Header */}
                  <div
                    style={{
                padding: 20,
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                flex: "0 0 auto"
              }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#eaeaea", marginBottom: "6px" }}>
                    📝 Document Notes
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, opacity: 0.8, color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.5 }}>
                    <strong>Your personal workspace</strong> for thoughts, summaries, and annotations about this document. 
                    Use this to keep research notes, key findings, or personal thoughts separate from the document content.
                  </p>
                </div>
                <button
                  onClick={() => setNotesOpen(false)}
                  style={{
                    padding: "8px 12px",
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    fontSize: "var(--font-size-base)",
                    lineHeight: "var(--line-height-normal)",
                    cursor: "pointer",
                    color: "#eaeaea"
                  }}
                >
                  ✕ Close
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button 
                  onClick={saveNoteLocal} 
                  style={{
                    padding: "10px 16px",
                    background: noteDirty ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.1)",
                    border: noteDirty ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    fontSize: "var(--font-size-base)",
                    lineHeight: "var(--line-height-normal)",
                    cursor: "pointer",
                    fontWeight: 500
                  }}
                >
                  💾 {noteDirty ? 'Save Changes' : 'Saved'}
                      </button>
                
                <button 
                  onClick={resetNoteFromDocument} 
                  style={{
                    padding: "10px 16px",
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    fontSize: "var(--font-size-base)",
                    lineHeight: "var(--line-height-normal)",
                    cursor: "pointer",
                    color: "#eaeaea"
                  }}
                  title="Copy the entire document text into notes (useful for creating summaries)"
                >
                  📄 Copy Document Text
                </button>
                    </div>

              {/* Status */}
              <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
                Status: {noteStatus} {noteDirty && '• Unsaved changes'}
                    </div>
                  </div>

            {/* Main Content Area - Simplified */}
            <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", padding: 20 }}>
              {/* Rich Text Editor */}
              <div style={{ flex: 1, minHeight: 400, display: "flex", flexDirection: "column" }}>
                <RichTextEditor
                  valueHtml={noteHtml}
                  onChange={({ html, text }) => {
                    setNoteHtml(html);
                    setNoteText(text);
                    setNoteDirty(true);
                  }}
                  placeholder="💭 Write your thoughts, summaries, or research notes about this document here... Use the toolbar above for formatting."
                />
              </div>

              {/* Help Section */}
              <div style={{ 
                marginTop: 20,
                padding: 16, 
                borderTop: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                borderRadius: 12
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#eaeaea" }}>
                  💡 Document Notes Help
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.9, color: "rgba(255, 255, 255, 0.7)" }}>
                  <strong>💡 How to Use Document Notes:</strong><br/>
                  • <strong>Personal Workspace:</strong> Write your thoughts, summaries, research notes, or annotations about this document<br/>
                  • <strong>Rich Text Editing:</strong> Use the toolbar above for formatting (bold, italic, colors, fonts, etc.)<br/>
                  • <strong>Auto-Save:</strong> Notes are automatically saved in your browser when you click "Save Changes"<br/>
                  • <strong>Copy Document Text:</strong> Use "Copy Document Text" to quickly copy the entire document into notes (useful for creating summaries)<br/>
                  • <strong>Word/Character Count:</strong> See statistics in the status bar below<br/><br/>
                  <strong>📌 Use Cases:</strong> Research notes, document summaries, key findings, personal thoughts, annotations, related resources
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Smart Notes Modal */}
      {smartNotesOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", padding: "20px", zIndex: 75, transition: "all 0.2s ease" }}>
          <div
            style={{
              flex: 1,
              background: "linear-gradient(135deg, rgba(11, 14, 20, 0.98) 0%, rgba(8, 10, 16, 0.98) 100%)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "20px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              maxWidth: "1600px",
              margin: "0 auto",
              width: "100%",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                background: "rgba(255,255,255,0.03)",
                flex: "0 0 auto"
              }}
            >
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#eaeaea", marginBottom: "6px" }}>
                    🧠 Smart Notes
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, opacity: 0.8, color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.5 }}>
                    <strong>Organize your thoughts</strong> with tags and categories. Create multiple notes, search and filter them easily.
                  </p>
                </div>
                <button
                  onClick={() => setSmartNotesOpen(false)}
                  style={{
                    padding: "8px 12px",
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    fontSize: "var(--font-size-base)",
                    lineHeight: "var(--line-height-normal)",
                    cursor: "pointer",
                    color: "#eaeaea"
                  }}
                >
                  ✕ Close
                </button>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
                <button 
                  onClick={createNewSmartNote}
                  style={{
                    padding: "10px 16px",
                    background: "rgba(99, 102, 241, 0.2)",
                    border: "1px solid rgba(99, 102, 241, 0.5)",
                    borderRadius: 8,
                    fontSize: "var(--font-size-base)",
                    lineHeight: "var(--line-height-normal)",
                    cursor: "pointer",
                    fontWeight: 500,
                    color: "#eaeaea"
                  }}
                >
                  ➕ New Note
                </button>
                
                <button 
                  onClick={saveSmartNoteLocal} 
                  style={{
                    padding: "10px 16px",
                    background: smartNoteDirty ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.1)",
                    border: smartNoteDirty ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    fontSize: "var(--font-size-base)",
                    lineHeight: "var(--line-height-normal)",
                    cursor: "pointer",
                    fontWeight: 500,
                    color: "#eaeaea"
                  }}
                  disabled={!smartNoteText.trim()}
                >
                  💾 {smartNoteDirty ? 'Save Changes' : 'Saved'}
                </button>

                {currentSmartNote && (
                  <button 
                    onClick={() => deleteSmartNoteLocal(currentSmartNote.id)}
                    style={{
                      padding: "10px 16px",
                      background: "rgba(239,68,68,0.2)",
                      border: "1px solid rgba(239,68,68,0.5)",
                      borderRadius: 8,
                      fontSize: "var(--font-size-base)",
                      lineHeight: "var(--line-height-normal)",
                      cursor: "pointer",
                      color: "#eaeaea"
                    }}
                  >
                    🗑️ Delete
                  </button>
                )}
              </div>

              {/* Status */}
              <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8, color: "rgba(255, 255, 255, 0.7)" }}>
                Status: {smartNoteStatus || "Ready"} {smartNoteDirty && '• Unsaved changes'}
              </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", padding: 20, gap: 20 }}>
              {/* Left: Editor */}
              <div style={{ flex: "1 1 60%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                {/* Tags and Category */}
                <div style={{ marginBottom: 16, padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: "#eaeaea" }}>
                    🏷️ Tags & Category
                  </div>
                  
                  {/* Category */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "rgba(255, 255, 255, 0.7)" }}>
                      Category:
                    </label>
                    <select
                      value={smartNoteCategory}
                      onChange={(e) => {
                        setSmartNoteCategory(e.target.value);
                        setSmartNoteDirty(true);
                      }}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: 8,
                        fontSize: "var(--font-size-base)",
                        color: "#eaeaea"
                      }}
                    >
                      <option value="General">📁 General</option>
                      <option value="Technical">🔧 Technical</option>
                      <option value="Research">🔬 Research</option>
                      <option value="Ideas">💡 Ideas</option>
                      <option value="Important">⭐ Important</option>
                      <option value="Questions">❓ Questions</option>
                    </select>
                  </div>

                  {/* Tags */}
                  <div>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 6, color: "rgba(255, 255, 255, 0.7)" }}>
                      Tags (manual):
                    </label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      {smartNoteTags.map(tag => (
                        <span
                          key={tag}
                          style={{
                            padding: "6px 12px",
                            background: "rgba(99, 102, 241, 0.2)",
                            border: "1px solid rgba(99, 102, 241, 0.5)",
                            borderRadius: 20,
                            fontSize: 12,
                            color: "#eaeaea",
                            display: "flex",
                            alignItems: "center",
                            gap: 6
                          }}
                        >
                          🏷️ {tag}
                          <button
                            onClick={() => removeTagFromSmartNote(tag)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#eaeaea",
                              cursor: "pointer",
                              padding: 0,
                              marginLeft: 4,
                              fontSize: 14
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            addTagToSmartNote(newTagInput);
                          }
                        }}
                        placeholder="Add tag and press Enter"
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          background: "rgba(255,255,255,0.1)",
                          border: "1px solid rgba(255,255,255,0.2)",
                          borderRadius: 8,
                          fontSize: "var(--font-size-base)",
                          color: "#eaeaea"
                        }}
                      />
                      <button
                        onClick={() => addTagToSmartNote(newTagInput)}
                        style={{
                          padding: "8px 16px",
                          background: "rgba(99, 102, 241, 0.3)",
                          border: "1px solid rgba(99, 102, 241, 0.5)",
                          borderRadius: 8,
                          fontSize: "var(--font-size-base)",
                          cursor: "pointer",
                          color: "#eaeaea"
                        }}
                      >
                        Add Tag
                      </button>
                    </div>
                  </div>
                </div>

                {/* Rich Text Editor */}
                <div style={{ flex: 1, minHeight: 300, display: "flex", flexDirection: "column" }}>
                  <RichTextEditor
                    valueHtml={smartNoteHtml}
                    onChange={({ html, text }) => {
                      setSmartNoteHtml(html);
                      setSmartNoteText(text);
                      setSmartNoteDirty(true);
                    }}
                    placeholder="💭 Write your note here... Use tags and categories to organize your thoughts..."
                  />
                </div>
              </div>

              {/* Right: Notes List */}
              <div style={{ flex: "1 1 40%", display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ 
                  padding: 16, 
                  background: "rgba(255,255,255,0.02)", 
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.1)",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column"
                }}>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: "#eaeaea" }}>
                    📚 Notes ({smartNotes.length})
                  </div>

                  {/* Search Bar */}
                  <div style={{ marginBottom: 12 }}>
                    <input
                      type="text"
                      placeholder="🔍 Search notes..."
                      value={smartNoteSearchQuery}
                      onChange={(e) => setSmartNoteSearchQuery(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: 8,
                        fontSize: "var(--font-size-base)",
                        color: "#eaeaea"
                      }}
                    />
                  </div>

                  {/* Filters */}
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    <select
                      value={smartNoteSelectedCategory}
                      onChange={(e) => setSmartNoteSelectedCategory(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: "120px",
                        padding: "6px 10px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "#eaeaea"
                      }}
                    >
                      <option value="all">📁 All Categories</option>
                      {allCategories.map(cat => (
                        <option key={cat} value={cat}>📁 {cat}</option>
                      ))}
                    </select>

                    <select
                      value={smartNoteSelectedTag}
                      onChange={(e) => setSmartNoteSelectedTag(e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: "120px",
                        padding: "6px 10px",
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "#eaeaea"
                      }}
                    >
                      <option value="">🏷️ All Tags</option>
                      {allTags.map(tag => (
                        <option key={tag} value={tag}>🏷️ {tag}</option>
                      ))}
                    </select>
                  </div>

                  {/* Notes List */}
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {filteredSmartNotes.length > 0 ? (
                      filteredSmartNotes.map(note => (
                        <div
                          key={note.id}
                          onClick={() => loadSmartNoteForEdit(note)}
                          style={{
                            padding: 12,
                            marginBottom: 8,
                            background: currentSmartNote?.id === note.id ? "rgba(99, 102, 241, 0.2)" : "rgba(255,255,255,0.05)",
                            border: currentSmartNote?.id === note.id ? "1px solid rgba(99, 102, 241, 0.5)" : "1px solid rgba(255,255,255,0.1)",
                            borderRadius: 8,
                            fontSize: 12,
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                          onMouseEnter={(e) => {
                            if (currentSmartNote?.id !== note.id) {
                              e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (currentSmartNote?.id !== note.id) {
                              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                            }
                          }}
                        >
                          <div style={{ fontWeight: 600, marginBottom: 4, color: "#eaeaea" }}>
                            {note.content.slice(0, 80)}{note.content.length > 80 ? "…" : ""}
                          </div>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                            <span style={{ fontSize: 11, opacity: 0.7, color: "rgba(255, 255, 255, 0.6)" }}>
                              📁 {note.category}
                            </span>
                            {note.tags.map(tag => (
                              <span key={tag} style={{ fontSize: 11, opacity: 0.7, color: "rgba(255, 255, 255, 0.6)" }}>
                                🏷️ {tag}
                              </span>
                            ))}
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.6, color: "rgba(255, 255, 255, 0.5)" }}>
                            {new Date(note.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: "center", opacity: 0.5, fontSize: 13, padding: 20, color: "rgba(255, 255, 255, 0.6)" }}>
                        {smartNotes.length === 0 
                          ? "No notes yet. Click 'New Note' to create your first Smart Note!"
                          : "No notes match your search/filter criteria."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Help Section */}
            <div style={{ 
              padding: 20, 
              borderTop: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.02)",
              flex: "0 0 auto"
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#eaeaea" }}>
                💡 Smart Notes Help
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.9, color: "rgba(255, 255, 255, 0.7)" }}>
                <strong>🧠 Smart Notes Features:</strong><br/>
                • <strong>Multiple Notes:</strong> Create as many notes as you need, each with its own tags and category<br/>
                • <strong>Manual Tags:</strong> Add tags manually to organize your notes (e.g., "important", "verify", "citation-needed")<br/>
                • <strong>Categories:</strong> Organize notes by category (General, Technical, Research, Ideas, etc.)<br/>
                • <strong>Search & Filter:</strong> Quickly find notes by content, tags, or categories<br/>
                • <strong>Link to Chunks:</strong> Optionally link notes to specific document chunks for better context<br/>
                • <strong>Rich Text Editing:</strong> Full formatting support with toolbar
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Manual modal */}
      {manualOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", padding: 18, zIndex: 50 }}>
          <div
            style={{
              flex: 1,
              background: "#0b0e14",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: 12,
                borderBottom: "1px solid rgba(255,255,255,0.10)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flex: "0 0 auto",
              }}
            >
              <b style={{ flex: 1 }}>Create manual chunk</b>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{manualStatus}</span>
              <button onClick={() => setManualOpen(false)} style={{ padding: "8px 10px" }}>
                Close
              </button>
            </div>

            <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
              {/* Left: document text for selection */}
              <div
                style={{
                  flex: "1 1 60%", // Give more space to document text
                  minWidth: 0,
                  minHeight: 0,
                  borderRight: "1px solid rgba(255,255,255,0.10)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 700, flex: "0 0 auto" }}>
                  Select text below (drag). Then Save.
                </div>

                <div style={{ padding: 12, overflow: "auto", flex: "1 1 auto", minHeight: 0 }}>
                  <pre
                    ref={manualPreRef}
                    onMouseUp={captureManualSelection}
                    onKeyUp={captureManualSelection}
                    style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6, userSelect: "text", cursor: "text" }}
                  >
                    {docText}
                  </pre>
                </div>
              </div>

              {/* Right: fields + editor */}
              <div style={{ flex: "1 1 40%", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", flex: "0 0 auto" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      value={manualTitle}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveManualChunk();
                        }
                      }}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="Title (optional)"
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "#0f1420",
                        color: "#eaeaea",
                      }}
                    />
                    <button onClick={saveManualChunk} style={{ padding: "10px 12px" }}>
                      Save chunk
                    </button>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>Preview (stored selection):</div>
                  <div
                    style={{
                      marginTop: 6,
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.03)",
                      maxHeight: 130,
                      overflow: "auto",
                    }}
                  >
                    {manualSel ? (
                      <>
                        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                          start={manualSel.start} end={manualSel.end} ({manualSel.end - manualSel.start} chars)
                        </div>
                        <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5 }}>{manualSel.text}</pre>
                      </>
                    ) : (
                      <div style={{ opacity: 0.7 }}>— no selection</div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
                  {!manualOpenSeg ? (
                    <div ref={manualListScrollRef} style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "auto" }}>
                      <div style={{ padding: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                        <span>Saved manual chunks ({mode})</span>
                        <span style={{ opacity: 0.7, fontWeight: 400 }}>{manualSegments.length}</span>
                      </div>

                      {!manualSegments.length ? (
                        <div style={{ padding: 12, opacity: 0.7 }}>
                          No manual chunks yet for <b>{mode}</b>.
                        </div>
                      ) : (
                        <div style={{ padding: 8, display: "grid", gap: 8 }}>
                          {manualSegments.map((s: any) => (
                            <div
                              key={s.id}
                              onClick={() => manualHandleSelect(s)}
                              onDoubleClick={() => manualHandleOpen(s)}
                              title="Click to select & highlight. Double-click to open. Drag to move to folder."
                              draggable
                              onDragStart={(e) => handleDragStart(e, s)}
                              onDragEnd={handleDragEnd}
                              className={`cursor-move transition-all duration-200 ${
                                draggedSegment?.id === s.id ? 'opacity-50' : ''
                              }`}
                              style={{
                                cursor: "pointer",
                                padding: 10,
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,0.10)",
                                background: "rgba(114,255,191,0.08)",
                                userSelect: "none",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                <b style={{ fontSize: 13 }}>
                                  {s.title}
                                  {folderMap[String(s.id)] ? (
                                    <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7, color: "#72ffbf" }}>
                                      📁 {folders.find((f) => f.id === folderMap[String(s.id)])?.name ?? "?"}
                                    </span>
                                  ) : null}
                                </b>

                                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                  <select
                                    value={folderMap[String(s.id)] ?? "none"}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const folderId = e.target.value === "none" ? null : e.target.value;
                                      setSegmentFolder(docId, s.id, folderId);
                                      setFolderMap(loadFolderMap(docId));
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      border: "1px solid rgba(255,255,255,0.12)",
                                      background: "#0f1420",
                                      color: "#eaeaea",
                                      fontSize: 11,
                                    }}
                                  >
                                    <option value="none">No folder</option>
                                    {folders.map((f) => (
                                      <option key={f.id} value={f.id}>
                                        {f.name}
                                      </option>
                                    ))}
                                  </select>

                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openChunkEditor(s);
                                    }}
                                    style={{ padding: "4px 10px" }}
                                  >
                                    Edit
                                  </button>

                                  {deletingSegId === s.id ? (
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                      <span style={{ fontSize: 11, opacity: 0.7 }}>Delete?</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          confirmDeleteSingle(s);
                                        }}
                                        style={{
                                          padding: "3px 8px",
                                          fontSize: 11,
                                          background: "rgba(239, 68, 68, 0.2)",
                                          border: "1px solid rgba(239, 68, 68, 0.4)",
                                          color: "#ef4444",
                                          borderRadius: 4,
                                          cursor: "pointer",
                                          transition: "all 0.2s",
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.3)";
                                          e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.6)";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                                          e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.4)";
                                        }}
                                      >
                                        ✓
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          cancelDelete();
                                        }}
                                        style={{
                                          padding: "3px 8px",
                                          fontSize: 11,
                                          background: "rgba(255, 255, 255, 0.1)",
                                          border: "1px solid rgba(255, 255, 255, 0.2)",
                                          color: "#eaeaea",
                                          borderRadius: 4,
                                          cursor: "pointer",
                                          transition: "all 0.2s",
                                        }}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
                                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                                          e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                                        }}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSingle(s);
                                    }}
                                      style={{
                                        padding: "4px 10px",
                                        fontSize: 11,
                                        background: "rgba(239, 68, 68, 0.1)",
                                        border: "1px solid rgba(239, 68, 68, 0.2)",
                                        color: "#ef4444",
                                        borderRadius: 6,
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)";
                                        e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
                                        e.currentTarget.style.transform = "scale(1.05)";
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                                        e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.2)";
                                        e.currentTarget.style.transform = "scale(1)";
                                      }}
                                      title="Delete chunk"
                                    >
                                      🗑️ Delete
                                  </button>
                                  )}
                                </div>
                              </div>
                              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{preview120(s.content)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
                      <div
                        style={{
                          padding: 12,
                          borderBottom: "1px solid rgba(255,255,255,0.08)",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          flex: "0 0 auto",
                        }}
                      >
                        <b style={{ flex: 1 }}>{(manualOpenSeg as any).title}</b>

                        <button onClick={() => manualOpenSeg && openChunkEditor(manualOpenSeg)} style={{ padding: "8px 10px" }}>
                          Edit
                        </button>

                        <button onClick={() => setManualOpenSeg(null)} style={{ padding: "8px 10px" }}>
                          Back to list
                        </button>
                      </div>

                      <div style={{ padding: 12, overflow: "auto", flex: "1 1 auto", minHeight: 0 }}>
                        <div
                          style={{ lineHeight: 1.55 }}
                          dangerouslySetInnerHTML={{
                            __html:
                              localStorage.getItem(segHtmlKey((manualOpenSeg as any).id)) ||
                              plainTextToHtml((manualOpenSeg as any).content || ""),
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12, opacity: 0.7 }}>
                  Tip: Manual modal stays open. Save multiple chunks in a row.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Chunk Edit modal */}
      {chunkEditOpen && chunkEditSeg ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            display: "flex",
            padding: "20px",
            zIndex: 60,
            transition: "all 0.2s ease",
          }}
        >
          <div
            style={{
              flex: 1,
              background: "linear-gradient(135deg, rgba(11, 14, 20, 0.98) 0%, rgba(8, 10, 16, 0.98) 100%)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "20px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              maxWidth: chunkEditFullscreen ? "100%" : "1600px",
              margin: chunkEditFullscreen ? "0" : "0 auto",
              width: chunkEditFullscreen ? "100%" : "auto",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                display: "flex",
                alignItems: "center",
                gap: "16px",
                flex: "0 0 auto",
                background: "linear-gradient(135deg, rgba(30, 30, 40, 0.5) 0%, rgba(20, 20, 30, 0.3) 100%)",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
                  borderRadius: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                  fontWeight: 700,
                  fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                  color: "#c7d2fe",
                }}
              >
                #{(chunkEditSeg as any).orderIndex + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                fontSize: "var(--font-size-lg)",
                lineHeight: "var(--line-height-snug)",
                letterSpacing: "var(--letter-spacing-tight)",
                    fontWeight: 700,
                    color: "#eaeaea",
                    marginBottom: "4px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  Edit Chunk: {chunkEditSeg.title}
                </div>
                {chunkEditStatus && (
                  <div
                    style={{
                      fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                      color: "rgba(255, 255, 255, 0.6)",
                      padding: "4px 10px",
                      background: "rgba(99, 102, 241, 0.1)",
                      borderRadius: "6px",
                      display: "inline-block",
                      border: "1px solid rgba(99, 102, 241, 0.2)",
                    }}
                  >
                    {chunkEditStatus}
                  </div>
                )}
              </div>
              <button
                onClick={() => setChunkEditFullscreen(!chunkEditFullscreen)}
                style={{
                  padding: "10px 16px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "10px",
                  color: "#eaeaea",
                  fontWeight: 500,
                  fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                title={chunkEditFullscreen ? "Exit fullscreen" : "Fullscreen"}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                }}
              >
                {chunkEditFullscreen ? "🗗 Exit Fullscreen" : "🗖 Fullscreen"}
              </button>
              <button
                onClick={() => setChunkEditOpen(false)}
                style={{
                  padding: "10px 18px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "10px",
                  color: "#eaeaea",
                  fontWeight: 600,
                  fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                  e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
                  e.currentTarget.style.color = "#fca5a5";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.color = "#eaeaea";
                }}
              >
                <svg style={{ width: "14px", height: "14px", display: "inline", marginRight: "6px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close
              </button>
            </div>

            {/* Editor Toolbar - Full Width */}
            <div
              style={{
                flex: "0 0 auto",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                background: "linear-gradient(135deg, rgba(20, 20, 30, 0.8) 0%, rgba(15, 15, 25, 0.8) 100%)",
                padding: "20px 24px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                      fontWeight: 600,
                      color: "rgba(255, 255, 255, 0.7)",
                      marginBottom: "8px",
                    }}
                  >
                    Title
                  </label>
                  <input
                    value={chunkEditTitle}
                    onChange={(e) => setChunkEditTitle(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "12px",
                      border: "1px solid rgba(255,255,255,0.1)",
                      background: "rgba(0, 0, 0, 0.3)",
                      color: "#eaeaea",
                      fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                      transition: "all 0.2s ease",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.5)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                      fontWeight: 600,
                      color: "rgba(255, 255, 255, 0.7)",
                      marginBottom: "8px",
                    }}
                  >
                    Content
                  </label>
                  <div
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "12px",
                      overflow: "hidden",
                      background: "rgba(0, 0, 0, 0.2)",
                      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2) inset",
                    }}
                  >
                    <RichTextEditor
                      valueHtml={chunkEditHtml}
                      onChange={({ html, text }) => {
                        setChunkEditHtml(html);
                        setChunkEditContent(text);
                        setChunkEditDirty(true);
                      }}
                      placeholder="Edit chunk content..."
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", paddingTop: "8px" }}>
                  <button
                    onClick={() => setChunkEditOpen(false)}
                    style={{
                      padding: "12px 24px",
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                      color: "#eaeaea",
                      fontWeight: 600,
                      fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
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
                    Cancel
                  </button>
                  <button
                    onClick={saveChunkEdit}
                    style={{
                      padding: "12px 24px",
                      background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                      border: "none",
                      borderRadius: "12px",
                      color: "white",
                      fontWeight: 600,
                      fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
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
                    <svg style={{ width: "16px", height: "16px", display: "inline", marginRight: "6px", verticalAlign: "middle" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Changes
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flex: "1 1 auto", minHeight: 0 }}>
              {/* Left: Chunk Details + Optional List */}
              <div
                style={{
                  flex: showChunkListInEdit ? "1 1 16.5%" : "1 1 16.5%",
                  minWidth: 0,
                  minHeight: 0,
                  borderRight: "1px solid rgba(255,255,255,0.10)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Chunk Details */}
                <div
                  style={{
                    padding: "16px",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    flex: "0 0 auto",
                    background: "linear-gradient(135deg, rgba(20, 20, 30, 0.5) 0%, rgba(15, 15, 25, 0.3) 100%)",
                  }}
                >
                  <h4
                    style={{
                      margin: "0 0 16px 0",
                      fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                      fontWeight: 700,
                      color: "#eaeaea",
                    }}
                  >
                    Chunk Details
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      <span
                        style={{
                          padding: "6px 12px",
                          background: "rgba(255, 255, 255, 0.05)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          borderRadius: "8px",
                          fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                          fontWeight: 600,
                          color: "rgba(255, 255, 255, 0.8)",
                        }}
                      >
                        Index: {(chunkEditSeg as any).orderIndex + 1}
                      </span>
                      <span
                        style={{
                          padding: "6px 12px",
                          background: (chunkEditSeg as any).isManual ? "rgba(59, 130, 246, 0.2)" : "rgba(107, 114, 128, 0.2)",
                          border: (chunkEditSeg as any).isManual ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(107, 114, 128, 0.3)",
                          borderRadius: "8px",
                          fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                          fontWeight: 600,
                          color: (chunkEditSeg as any).isManual ? "#93c5fd" : "#9ca3af",
                        }}
                      >
                        {(chunkEditSeg as any).isManual ? "Manual" : "Auto"}
                      </span>
                      <span
                        style={{
                          padding: "6px 12px",
                          background: (chunkEditSeg as any).mode === "qa" ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.2)",
                          border: (chunkEditSeg as any).mode === "qa" ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(16, 185, 129, 0.3)",
                          borderRadius: "8px",
                          fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                          fontWeight: 600,
                          color: (chunkEditSeg as any).mode === "qa" ? "#93c5fd" : "#6ee7b7",
                        }}
                      >
                        Mode: {(chunkEditSeg as any).mode}
                      </span>
                    </div>
                    <div
                      style={{
                        padding: "10px 12px",
                        background: "rgba(0, 0, 0, 0.2)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "8px",
                        fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                        color: "rgba(255, 255, 255, 0.7)",
                      }}
                    >
                      <div style={{ marginBottom: "4px" }}>
                        <strong style={{ color: "#eaeaea" }}>Position:</strong> {chunkEditStart} - {chunkEditEnd}
                      </div>
                      <div>
                        <strong style={{ color: "#eaeaea" }}>Length:</strong> {chunkEditEnd - chunkEditStart} characters
                      </div>
                    </div>
                    {chunkEditDirty && (
                      <div
                        style={{
                          fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
                          color: "#fcd34d",
                          padding: "10px 12px",
                          background: "rgba(251, 191, 36, 0.15)",
                          border: "1px solid rgba(251, 191, 36, 0.3)",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        <svg style={{ width: "16px", height: "16px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Unsaved changes
                      </div>
                    )}
                  </div>
                </div>

                {/* Chunk List (toggleable) */}
                {showChunkListInEdit && (
                  <>
                    <div style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>All Chunks</span>
                      <button
                        onClick={() => setShowChunkListInEdit(false)}
                        style={{ padding: "2px 6px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, fontSize: 10 }}
                      >
                        ✕
                      </button>
                    </div>
                    <div style={{ padding: 8, overflow: "auto", flex: "1 1 auto", minHeight: 0 }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        {(showAllChunksInEdit ? segments : segments.slice(0, 10)).map((s: any) => (
                          <div
                            key={s.id}
                            onClick={() => {
                              if (s.id !== chunkEditSeg?.id) {
                                openChunkEditor(s);
                              }
                            }}
                            style={{
                              padding: 6,
                              borderRadius: 6,
                              border: s.id === chunkEditSeg?.id ? "1px solid #72ffbf" : "1px solid rgba(255,255,255,0.10)",
                              background: s.id === chunkEditSeg?.id ? "rgba(114,255,191,0.1)" : "rgba(255,255,255,0.03)",
                              cursor: "pointer",
                              fontSize: 11,
                            }}
                          >
                            <div style={{ fontWeight: 600, marginBottom: 2 }}>
                              {(s.orderIndex ?? 0) + 1}. {s.title}
                            </div>
                            <div style={{ opacity: 0.7 }}>
                              {s.isManual ? "Manual" : "Auto"} • {s.mode} • {s.end - s.start} chars
                            </div>
                          </div>
                        ))}
                        {segments.length > 10 && (
                          <div 
                            style={{ fontSize: 10, opacity: 0.6, textAlign: "center", paddingTop: 4, cursor: "pointer", textDecoration: "underline" }}
                            onClick={() => setShowAllChunksInEdit(true)}
                          >
                            ... and {segments.length - 10} more
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Show chunk list button when hidden */}
                {!showChunkListInEdit && (
                  <div style={{ padding: 8, flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <button
                      onClick={() => setShowChunkListInEdit(true)}
                      style={{ padding: "8px 12px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, fontSize: 12 }}
                    >
                      📋 Show Chunk List
                    </button>
                  </div>
                )}
              </div>

              {/* Right: Document Text + Chunk List */}
              <div style={{ flex: "1 1 83.5%", minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
                {/* Document Text Selection - 1/3 of space */}
                <div style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 600, fontSize: 12, flex: "0 0 auto" }}>
                  Select text below (drag) to update selection
                </div>
                <div style={{ padding: 12, overflow: "auto", flex: "1 1 auto", minHeight: 0, maxHeight: "40%" }}>
                      <pre
                        ref={chunkEditPreRef}
                        onMouseUp={captureChunkSelection}
                        onKeyUp={captureChunkSelection}
                    style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6, userSelect: "text", cursor: "text", fontSize: 12 }}
                      >
                    {(() => {
                      const parts = splitDocByRange(docText, chunkEditStart, chunkEditEnd);
                      return (
                        <>
                        {parts.before}
                        {parts.mid ? (
                          <span
                            style={{
                              background: "rgba(114,255,191,0.18)",
                              outline: "1px solid rgba(114,255,191,0.45)",
                              borderRadius: 6,
                              padding: "1px 2px",
                            }}
                          >
                            {parts.mid}
                          </span>
                        ) : null}
                        {parts.after}
                        </>
                    );
                  })()}
                  </pre>
              </div>

                {/* Chunk List - 1/6 of space when shown */}
                {showChunkListInEdit && (
                  <>
                    <div style={{ padding: 8, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>All Chunks</span>
                      <button
                        onClick={() => setShowChunkListInEdit(false)}
                        style={{ padding: "2px 6px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, fontSize: 10 }}
                      >
                        ✕
                      </button>
                  </div>
                    <div style={{ padding: 8, overflow: "auto", flex: "1 1 auto", minHeight: 0, maxHeight: "30%" }}>
                      <div style={{ display: "grid", gap: 6 }}>
                        {(showAllChunksInEdit ? segments : segments.slice(0, 10)).map((s: any) => (
                          <div
                            key={s.id}
                            onClick={() => {
                              if (s.id !== chunkEditSeg?.id) {
                                openChunkEditor(s);
                          }
                        }}
                        style={{
                              padding: 6,
                              borderRadius: 6,
                              border: s.id === chunkEditSeg?.id ? "1px solid #72ffbf" : "1px solid rgba(255,255,255,0.10)",
                              background: s.id === chunkEditSeg?.id ? "rgba(114,255,191,0.1)" : "rgba(255,255,255,0.03)",
                              cursor: "pointer",
                              fontSize: 11,
                            }}
                          >
                            <div style={{ fontWeight: 600, marginBottom: 2 }}>
                              {(s.orderIndex ?? 0) + 1}. {s.title}
                    </div>
                            <div style={{ opacity: 0.7 }}>
                              {s.isManual ? "Manual" : "Auto"} • {s.mode} • {s.end - s.start} chars
                      </div>
                      </div>
                        ))}
                        {segments.length > 10 && (
                          <div 
                            style={{ fontSize: 10, opacity: 0.6, textAlign: "center", paddingTop: 4, cursor: "pointer", textDecoration: "underline" }}
                            onClick={() => setShowAllChunksInEdit(true)}
                          >
                            ... and {segments.length - 10} more
                    </div>
                        )}
                  </div>
                </div>
                  </>
                )}

                {/* Show chunk list button when hidden */}
                {!showChunkListInEdit && (
                  <div style={{ padding: 8, flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <button
                      onClick={() => setShowChunkListInEdit(true)}
                      style={{ padding: "8px 12px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, fontSize: 12 }}
                    >
                      📋 Show Chunk List
                      </button>
                    </div>
                )}
                  </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Document Edit modal */}
      {docEditOpen ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", padding: 18, zIndex: 70 }}>
          <div
            style={{
              flex: 1,
              background: "#0b0e14",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <div
              style={{
                padding: 12,
                borderBottom: "1px solid rgba(255,255,255,0.10)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flex: "0 0 auto",
              }}
            >
              <b style={{ flex: 1 }}>Edit document text</b>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{docEditStatus}</span>
              <button onClick={() => setDocEditOpen(false)} style={{ padding: "8px 10px" }}>
                Close
              </button>
            </div>

            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minHeight: 0 }}>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                ⚠ Editing document text can invalidate existing segment start/end offsets. After saving, consider re-running segmentation.
              </div>

              <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
                <RichTextEditor
                  valueHtml={docEditHtml}
                  onChange={({ html, text }) => {
                    setDocEditHtml(html);
                    setDocEditText(text);
                  }}
                  placeholder="Edit document text…"
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button onClick={() => setDocEditOpen(false)} style={{ padding: "10px 12px" }}>
                  Cancel
                </button>
                <button disabled={docEditSaving} onClick={saveDocEdit} style={{ padding: "10px 12px", opacity: docEditSaving ? 0.6 : 1 }}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Folder Manager Drawer */}
      <FolderManagerDrawer
        docId={docId}
        open={foldersOpen}
        onClose={() => setFoldersOpen(false)}
        onChanged={(updatedFolders) => {
          setFolders(updatedFolders);
          setFolderMap(loadFolderMap(docId));
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
