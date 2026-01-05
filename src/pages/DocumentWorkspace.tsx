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

type SourceFilter = "all" | "auto" | "manual";
type SelInfo = { start: number; end: number; text: string };

// Smart Notes Types
interface SmartNote {
  id: string;
  content: string;
  html: string;
  tags: string[];
  category: string;
  timestamp: string;
  chunkId?: number;
  priority: 'low' | 'medium' | 'high';
}

function fmt(dt?: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  return isNaN(d.getTime()) ? dt : d.toLocaleString();
}

function preview120(s: string) {
  const oneLine = (s ?? "").replace(/\s+/g, " ").trim();
  return oneLine.length > 120 ? oneLine.slice(0, 120) + "…" : oneLine;
}

// Smart Notes Functions
function generateTags(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const commonWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by'];
  const keywords = words.filter(word => word.length > 3 && !commonWords.includes(word));
  return [...new Set(keywords)].slice(0, 5);
}

function categorizeNote(text: string): string {
  const technical = ['algorithm', 'data', 'system', 'process', 'function', 'method', 'analysis', 'research'];
  const research = ['study', 'investigation', 'findings', 'results', 'conclusion', 'hypothesis'];
  const ideas = ['concept', 'idea', 'approach', 'solution', 'improvement', 'suggestion'];
  
  const lowerText = text.toLowerCase();
  
  if (technical.some(word => lowerText.includes(word))) return 'Technical';
  if (research.some(word => lowerText.includes(word))) return 'Research';
  if (ideas.some(word => lowerText.includes(word))) return 'Ideas';
  
  return 'General';
}

function saveSmartNote(note: Omit<SmartNote, 'id' | 'timestamp'>, docId: number): SmartNote {
  const smartNote: SmartNote = {
    ...note,
    id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    tags: note.tags.length > 0 ? note.tags : generateTags(note.content),
    category: note.category || categorizeNote(note.content)
  };
  
  const existingNotes = JSON.parse(localStorage.getItem(`smart_notes_${docId}`) || '[]');
  existingNotes.push(smartNote);
  localStorage.setItem(`smart_notes_${docId}`, JSON.stringify(existingNotes));
  
  return smartNote;
}

function loadSmartNotes(docId: number): SmartNote[] {
  return JSON.parse(localStorage.getItem(`smart_notes_${docId}`) || '[]');
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

  // Smart Notes System
  const [smartNotes, setSmartNotes] = useState<SmartNote[]>([]);
  const [noteCategories, setNoteCategories] = useState<string[]>(["General", "Technical", "Research", "Ideas"]);
  const [autoTagging, setAutoTagging] = useState<boolean>(true);
  const [notesMode, setNotesMode] = useState<'simple' | 'smart'>('simple');
  
  // Smart Notes Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [showNotesList, setShowNotesList] = useState<boolean>(false);

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
    setStatus("Loading document...");
    try {
      const d = await getDocument(docId);
      const text = d.text ?? "";
      setDocText(text);

      if (!filename && d.filename) setFilename(d.filename);

      setParseStatus(d.parse_status ?? "pending");
      setParseError((d.parse_error as any) ?? null);
      setSourceType((d.source_type as any) ?? null);

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
    }
  }

  async function loadSummary() {
    try {
      const rows = await listSegmentations(docId);
      setSummary(Array.isArray(rows) ? rows : []);
    } catch {
      setSummary([]);
    }
  }

  async function loadSegs(m?: "qa" | "paragraphs") {
    const useMode = m ?? mode;
    setStatus("Loading segments...");
    try {
      const out = await listSegmentsWithMeta(docId, useMode);
      setSegments(Array.isArray(out.items) ? out.items : []);
      setSegmentsMeta(out.meta ?? null);

      setSelectedSegId(null);
      setOpenSeg(null);

      const last = out.meta?.last_run ? fmt(out.meta.last_run) : "—";
      setStatus(`Loaded ${out.items.length} segments (${useMode}) • last_run: ${last}`);
    } catch (e: any) {
      setStatus(e?.message ?? "List failed");
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
      if (notesMode === 'smart' && noteText.trim()) {
        // Save as Smart Note
        const smartNote = saveSmartNote({
          content: noteText,
          html: noteHtml,
          tags: autoTagging ? generateTags(noteText) : [],
          category: categorizeNote(noteText),
          chunkId: chunkEditSeg?.id || undefined,
          priority: 'medium'
        }, docId);
        
        // Update smart notes list
        const updatedNotes = loadSmartNotes(docId);
        setSmartNotes(updatedNotes);
        
        setNoteDirty(false);
        setNoteStatus(`Smart Note saved ✅ (${smartNote.tags.length} tags, ${smartNote.category})`);
      } else {
        // Save as Simple Note (original behavior)
        localStorage.setItem(`aiorg_note_html_doc_${docId}`, noteHtml);
        setNoteDirty(false);
        setNoteStatus("Notes saved locally ✅");
      }
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

  useEffect(() => {
    if (!Number.isFinite(docId)) return;

    loadDocument();
    loadSummary();

    try {
      setFolders(loadFolders(docId));
      setFolderMap(loadFolderMap(docId));
      setDuplicatedChunks(loadDuplicatedChunks(docId));
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
    const q = query.trim().toLowerCase();
    const folderOk = (segId: number) => {
      const fId = folderMap[String(segId)] ?? null;
      if (folderFilter === "all") return true;
      if (folderFilter === "none") return !fId;
      return fId === folderFilter;
    };

    if (!q) {
      return visibleBySource.filter((s) => folderOk(s.id));
    }

    return visibleBySource.filter((s) => {
      if (!folderOk(s.id)) return false;
      const hay = `${s.title ?? ""} ${s.content ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [visibleBySource, query, folderFilter, folderMap]);

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
        background: "#0b0e14",
        color: "#eaeaea",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      {/* Top bar */}
      <div
        className="bg-surface border-b border-border p-4 flex items-center gap-3 flex-shrink-0 shadow-sm"
        style={{
          padding: 14,
          borderBottom: "1px solid rgba(255,255,255,0.10)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap", // Allow wrapping on smaller screens
          flex: "0 0 auto",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-primary">Document #{docId}</h1>
            <p className="text-sm text-secondary">{filename ?? "—"}</p>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 200 }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={openDocEditor} className="btn-primary px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2 whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit document
          </button>
          <button onClick={() => nav("/")} className="btn-secondary px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors flex items-center gap-2 whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Back to Home
          </button>
        </div>
      </div>

      {/* Ingest banner */}
      <div 
        className="bg-surface-elevated border-b border-border p-3 flex-shrink-0"
        style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", flex: "0 0 auto" }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-primary">Ingest:</span>
            <span className={`status-${parseStatus === "ok" ? "ok" : parseStatus === "failed" ? "failed" : "pending"} px-2 py-1 rounded text-sm`}>
              {badge(parseStatus)}
            </span>
            {sourceType && (
              <span className="text-sm text-secondary bg-surface px-2 py-1 rounded border">
                source: {sourceType}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          {!canSegment ? (
            <span className="text-sm text-red-400 bg-red-900/20 px-3 py-1 rounded border border-red-800">
              ⚠️ Segmentation disabled until parseStatus=ok
            </span>
          ) : (
            <span className="text-sm text-green-400 bg-green-900/20 px-3 py-1 rounded border border-green-800">
              ✅ Ready for segmentation
            </span>
          )}
        </div>
        {parseStatus === "failed" && parseError ? (
          <div className="mt-2 p-3 bg-red-900/20 border border-red-800 rounded text-sm text-red-400">
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
          <div className="bg-surface-elevated border-b border-border p-3 font-semibold text-primary" style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 700 }}>
            Full document
            {selectedSeg ? (
              <span className="ml-2 text-sm text-secondary" style={{ marginLeft: 10, fontWeight: 400, opacity: 0.7, fontSize: 12 }}>
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
          <div className="bg-surface-elevated border-b border-border p-3 ws-top" style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-primary">Workspace</span>
              <div style={{ flex: 1 }} />
              <span className="text-sm text-secondary opacity-75" style={{ opacity: 0.75, fontSize: 12 }}>{status}</span>
            </div>

            <div className="mt-2 flex items-center gap-2 flex-wrap" style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label className="text-sm text-secondary opacity-85" style={{ opacity: 0.85 }}>Mode:</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="px-3 py-2 bg-surface border border-border rounded" style={{ padding: "8px 10px" }}>
                <option value="qa">qa</option>
                <option value="paragraphs">paragraphs</option>
              </select>

              <button onClick={() => loadSegs()} className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2" style={{ padding: "8px 10px" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                List segments
              </button>

              <button
                onClick={runSegmentation}
                disabled={!canSegment}
                className={`btn-primary px-3 py-2 rounded transition-colors flex items-center gap-2 ${!canSegment ? "opacity-50 cursor-not-allowed bg-gray-600" : "bg-indigo-600 hover:bg-indigo-700 text-white"}`}
                style={{ padding: "8px 10px", opacity: canSegment ? 1 : 0.6 }}
                title={!canSegment ? "parseStatus must be ok." : ""}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Segment now
              </button>

              <button onClick={deleteModeSegments} className="btn-danger px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center gap-2" style={{ padding: "8px 10px" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                style={{ padding: "8px 10px" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Manual chunk
              </button>

              <div className="flex items-center gap-2">
                <select 
                  value={notesMode} 
                  onChange={(e) => setNotesMode(e.target.value as any)} 
                  className="px-2 py-1 bg-surface border border-border rounded text-xs"
                  style={{ padding: "4px 6px", fontSize: "11px" }}
                >
                  <option value="simple">Simple</option>
                  <option value="smart">Smart Notes</option>
                </select>
                <button 
                  onClick={() => setNotesOpen((v) => !v)} 
                  className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors flex items-center gap-2" 
                  style={{ padding: "8px 10px" }}
                  title={notesMode === 'smart' ? 'Smart Notes with auto-categorization and tagging' : 'Simple notes editor'}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {notesOpen ? `Hide ${notesMode === 'smart' ? 'Smart Notes' : 'Word editor'}` : `${notesMode === 'smart' ? 'Smart Notes' : 'Word editor'}`}
                </button>
              </div>
            </div>

            {/* Compact one-liner summary */}
            <SegmentationSummaryBar
              qa={{ count: summaryByMode.qa?.count ?? 0, last: summaryByMode.qa?.lastSegmentedAt ?? null }}
              paragraphs={{ count: summaryByMode.paragraphs?.count ?? 0, last: summaryByMode.paragraphs?.lastSegmentedAt ?? null }}
              metaLine={
                segmentsMeta
                  ? `list: count=${segmentsMeta.count} mode=${segmentsMeta.mode} last_run=${segmentsMeta.last_run ?? "—"}`
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
                Outline Wizard
              </button>

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chunks..."
                className="flex-1 min-w-0 px-3 py-2 bg-surface border border-border rounded"
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#0f1420",
                  color: "#eaeaea",
                }}
              />
              <button onClick={() => setQuery("")} disabled={!query} className="btn-secondary px-3 py-2 bg-surface border border-border rounded hover:bg-surface-elevated transition-colors" style={{ padding: "8px 10px", opacity: query ? 1 : 0.6 }}>
                Clear
              </button>
            </div>
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
                    {folderFilter !== "all" && folderFilter !== "none" && folders.find(f => f.id === folderFilter) ? (
                      // Show folder view when a specific folder is selected
                      <FolderView
                        docId={docId}
                        folder={folders.find(f => f.id === folderFilter)!}
                        onBack={() => setFolderFilter("all")}
                        onChunkUpdated={() => {
                          setDuplicatedChunks(loadDuplicatedChunks(docId));
                          setFolders(loadFolders(docId));
                        }}
                      />
                    ) : (
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
                                      {(s.orderIndex ?? 0) + 1}. {s.title}
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
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
                  {notesMode === 'smart' ? '🧠 Smart Notes Editor' : '📝 Notes Editor'}
                </h2>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => setNotesOpen(false)}
                  style={{
                    padding: "8px 12px",
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: "pointer"
                  }}
                >
                  ✕ Close
                </button>
              </div>

              {/* Mode Selector */}
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                <span style={{ fontSize: 14, opacity: 0.9 }}>Mode:</span>
                <select 
                  value={notesMode} 
                  onChange={(e) => setNotesMode(e.target.value as any)} 
                  style={{
                    padding: "8px 12px",
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    fontSize: 14,
                    color: "white",
                    minWidth: "200px"
                  }}
                >
                  <option value="simple">📝 Simple Notes - Basic text editing</option>
                  <option value="smart">🧠 Smart Notes - Auto-tagging & categorization</option>
                </select>
                
                {notesMode === 'smart' && (
                  <span style={{ fontSize: 13, opacity: 0.7, marginLeft: 12 }}>
                    ✨ Auto-tagging & categorization enabled
                  </span>
                )}
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
                    fontSize: 14,
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
                    fontSize: 14,
                    cursor: "pointer"
                  }}
                >
                  📄 Copy from Document
                </button>
                
                <button 
                  onClick={applyNoteToDocumentText} 
                  style={{
                    padding: "10px 16px",
                    background: "rgba(239,68,68,0.2)",
                    border: "1px solid rgba(239,68,68,0.5)",
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: "pointer"
                  }}
                  title="⚠️ This will overwrite the entire document text!"
                >
                  ⚠️ Apply to Document
                </button>
              </div>

              {/* Status */}
              <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
                Status: {noteStatus} {noteDirty && '• Unsaved changes'}
              </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", padding: 20, gap: 20 }}>
                
                {/* Left: Editor */}
                <div style={{ flex: "1 1 60%", display: "flex", flexDirection: "column" }}>
                  {/* Smart Features */}
                  {notesMode === 'smart' && (
                    <div style={{ 
                      marginBottom: 16, 
                      padding: 16, 
                      background: "rgba(255,255,255,0.02)", 
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.1)"
                    }}>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                        🏷️ Smart Features
                      </div>
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
                        <button 
                          onClick={() => setAutoTagging(!autoTagging)}
                          style={{
                            padding: "8px 12px",
                            background: autoTagging ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.1)",
                            border: autoTagging ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.2)",
                            borderRadius: 6,
                            fontSize: 12
                          }}
                        >
                          {autoTagging ? '✓ Auto-tagging ON' : 'Auto-tagging OFF'}
                        </button>
                        
                        <select 
                          value="General" 
                          onChange={(e) => console.log('Category:', e.target.value)}
                          style={{
                            padding: "8px 12px",
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: 6,
                            fontSize: 12
                          }}
                        >
                          <option value="General">📁 General</option>
                          <option value="Technical">🔧 Technical</option>
                          <option value="Research">🔬 Research</option>
                          <option value="Ideas">💡 Ideas</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Rich Text Editor */}
                  <div style={{ flex: 1, minHeight: 300 }}>
                    <RichTextEditor
                      valueHtml={noteHtml}
                      onChange={({ html, text }) => {
                        setNoteHtml(html);
                        setNoteText(text);
                        setNoteDirty(true);
                      }}
                      placeholder={notesMode === 'smart' 
                        ? '🧠 Write your smart notes here... Tags and categories will be added automatically!' 
                        : '📝 Write your notes here...'
                      }
                    />
                  </div>
                </div>

                {/* Right: Smart Notes List */}
                {notesMode === 'smart' && (
                  <div style={{ flex: "1 1 40%", display: "flex", flexDirection: "column" }}>
                    <div style={{ 
                      padding: 16, 
                      background: "rgba(255,255,255,0.02)", 
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.1)",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column"
                    }}>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
                        📚 Smart Notes ({smartNotes.length})
                      </div>

                      {/* Search Bar */}
                      <div style={{ marginBottom: 12 }}>
                        <input
                          type="text"
                          placeholder="🔍 Search notes..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px",
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: 8,
                            fontSize: 14,
                            color: "white"
                          }}
                        />
                      </div>

                      {/* Filters */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          style={{
                            padding: "6px 10px",
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: 6,
                            fontSize: 12,
                            color: "white"
                          }}
                        >
                          <option value="all">📁 All Categories</option>
                          <option value="General">📁 General</option>
                          <option value="Technical">🔧 Technical</option>
                          <option value="Research">🔬 Research</option>
                          <option value="Ideas">💡 Ideas</option>
                        </select>

                        <select
                          value={selectedTag}
                          onChange={(e) => setSelectedTag(e.target.value)}
                          style={{
                            padding: "6px 10px",
                            background: "rgba(255,255,255,0.1)",
                            border: "1px solid rgba(255,255,255,0.2)",
                            borderRadius: 6,
                            fontSize: 12,
                            color: "white"
                          }}
                        >
                          <option value="">🏷️ All Tags</option>
                          {[...new Set(smartNotes.flatMap(note => note.tags))].map(tag => (
                            <option key={tag} value={tag}>🏷️ {tag}</option>
                          ))}
                        </select>
                      </div>

                      {/* Notes List */}
                      <div style={{ flex: 1, overflowY: "auto" }}>
                        {(() => {
                          let filteredNotes = smartNotes;
                          if (searchQuery) filteredNotes = searchSmartNotes(filteredNotes, searchQuery);
                          if (selectedCategory !== 'all') filteredNotes = filterSmartNotesByCategory(filteredNotes, selectedCategory);
                          if (selectedTag) filteredNotes = filterSmartNotesByTag(filteredNotes, selectedTag);

                          return filteredNotes.length > 0 ? (
                            filteredNotes.map(note => (
                              <div
                                key={note.id}
                                style={{
                                  padding: 12,
                                  marginBottom: 8,
                                  background: "rgba(255,255,255,0.05)",
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  borderRadius: 8,
                                  fontSize: 12,
                                  cursor: "pointer"
                                }}
                                onClick={() => {
                                  setNoteHtml(note.html);
                                  setNoteText(note.content);
                                  setNoteDirty(false);
                                }}
                              >
                                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                                  {note.content.slice(0, 80)}...
                                </div>
                                <div style={{ opacity: 0.7, fontSize: 11 }}>
                                  📁 {note.category} • 🏷️ {note.tags.join(', ')} • {new Date(note.timestamp).toLocaleDateString()}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div style={{ textAlign: "center", opacity: 0.5, fontSize: 13, padding: 20 }}>
                              No notes found. Start writing to create your first smart note!
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Help Section */}
              <div style={{ 
                padding: 20, 
                borderTop: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                flex: "0 0 auto"
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                  💡 {notesMode === 'smart' ? 'Smart Notes Help' : 'Notes Help'}
                </div>
                {notesMode === 'smart' ? (
                  <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.9 }}>
                    <strong>🧠 Smart Notes Features:</strong><br/>
                    • <strong>Auto-tagging:</strong> Automatically extracts relevant keywords from your notes<br/>
                    • <strong>Auto-categorization:</strong> Organizes notes by topic (Technical, Research, Ideas, General)<br/>
                    • <strong>Smart Search:</strong> Search by content, tags, or categories<br/>
                    • <strong>Click to Edit:</strong> Click any note in the list to load it for editing<br/>
                    • <strong>Context-Aware:</strong> Notes are linked to current chunk for better organization
                  </div>
                ) : (
                  <div style={{ fontSize: 13, lineHeight: 1.5, opacity: 0.9 }}>
                    <strong>📝 Simple Notes Features:</strong><br/>
                    • <strong>Rich Text Editing:</strong> Full formatting support with toolbar<br/>
                    • <strong>Local Storage:</strong> Notes are saved in your browser<br/>
                    • <strong>Copy from Document:</strong> Quickly copy the entire document text<br/>
                    • <strong>Apply to Document:</strong> Replace document content with your notes (⚠️ use carefully)<br/>
                    • <strong>Auto-save:</strong> Changes are saved when you click the Save button
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
          </div>
        </div>
      </div>

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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", padding: 18, zIndex: 60 }}>
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
              maxWidth: chunkEditFullscreen ? "100%" : "1400px",
              margin: chunkEditFullscreen ? "0" : "0 auto",
              width: chunkEditFullscreen ? "100%" : "auto",
            }}
          >
            {/* Header */}
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
              <b style={{ flex: 1 }}>Edit Chunk: {chunkEditSeg.title}</b>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{chunkEditStatus}</span>
              <button
                onClick={() => setChunkEditFullscreen(!chunkEditFullscreen)}
                style={{ padding: "6px 10px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, color: "#eaeaea" }}
                title={chunkEditFullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                {chunkEditFullscreen ? "🗗" : "🗖"}
              </button>
              <button onClick={() => setChunkEditOpen(false)} style={{ padding: "8px 10px" }}>
                Close
              </button>
            </div>

            {/* Editor Toolbar - Full Width */}
            <div style={{ flex: "0 0 auto", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ padding: "10px 12px" }}>
                <label style={{ display: "block", fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Title</label>
                <input
                  value={chunkEditTitle}
                  onChange={(e) => setChunkEditTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "#0f1420",
                    color: "#eaeaea",
                    fontSize: 13,
                    marginBottom: 10,
                  }}
                />
                <label style={{ display: "block", fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Content</label>
                <div style={{ border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, overflow: "hidden" }}>
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
                <div style={{ display: "flex", gap: 10, marginTop: 10, justifyContent: "flex-end" }}>
                  <button onClick={() => setChunkEditOpen(false)} style={{ padding: "8px 16px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6 }}>
                    Cancel
                  </button>
                  <button onClick={saveChunkEdit} style={{ padding: "8px 16px", background: "#72ffbf", color: "#0b0e14", border: "none", borderRadius: 6, fontWeight: 600 }}>
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
                <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", flex: "0 0 auto" }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 600 }}>Chunk Details</h4>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                    <strong>Index:</strong> {(chunkEditSeg as any).orderIndex + 1} | 
                    <strong> Type:</strong> {(chunkEditSeg as any).isManual ? "Manual" : "Auto"} | 
                    <strong> Mode:</strong> {(chunkEditSeg as any).mode}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
                    <strong>Position:</strong> {chunkEditStart} - {chunkEditEnd} ({chunkEditEnd - chunkEditStart} chars)
                  </div>
                  {chunkEditDirty && (
                    <div style={{ fontSize: 12, color: "#72ffbf", marginTop: 6 }}>
                      ⚠️ Unsaved changes
                    </div>
                  )}
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
