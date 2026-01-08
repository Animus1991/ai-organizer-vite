import { useState, useRef } from "react";
import type { SegmentDTO, SegmentsListMeta, SegmentationSummary } from "../../lib/api";
import type { FolderDTO } from "../../lib/segmentFolders";
import type { SourceFilter } from "../../components/workspace";
import type { SelInfo } from "../../lib/documentWorkspace/selection";
import type { SmartNote } from "../../lib/documentWorkspace/smartNotes";

export interface WorkspaceState {
  // Basic state
  status: string;
  setStatus: (status: string) => void;
  docText: string;
  setDocText: (text: string) => void;
  filename: string | null;
  setFilename: (filename: string | null) => void;

  // Ingest fields
  parseStatus: string;
  setParseStatus: (status: string) => void;
  parseError: string | null;
  setParseError: (error: string | null) => void;
  sourceType: string | null;
  setSourceType: (type: string | null) => void;

  // Summary + list
  summary: SegmentationSummary[];
  setSummary: (summary: SegmentationSummary[]) => void;
  mode: "qa" | "paragraphs";
  setMode: (mode: "qa" | "paragraphs") => void;
  segments: SegmentDTO[];
  setSegments: (segments: SegmentDTO[]) => void;
  segmentsMeta: SegmentsListMeta | null;
  setSegmentsMeta: (meta: SegmentsListMeta | null) => void;
  query: string;
  setQuery: (query: string) => void;
  sourceFilter: SourceFilter;
  setSourceFilter: (filter: SourceFilter) => void;
  advancedFiltersOpen: boolean;
  setAdvancedFiltersOpen: (open: boolean) => void;
  minLength: number | undefined;
  setMinLength: (length: number | undefined) => void;
  maxLength: number | undefined;
  setMaxLength: (length: number | undefined) => void;
  activePreset: string;
  setActivePreset: (preset: string) => void;

  // Selection / viewer
  selectedSegId: number | null;
  setSelectedSegId: (id: number | null) => void;
  openSeg: SegmentDTO | null;
  setOpenSeg: (seg: SegmentDTO | null) => void;
  highlightRef: React.RefObject<HTMLSpanElement | null>;
  listScrollRef: React.RefObject<HTMLDivElement | null>;
  lastScrollTopRef: React.MutableRefObject<number>;
  clickTimerRef: React.MutableRefObject<number | null>;

  // Manual modal
  manualOpen: boolean;
  setManualOpen: (open: boolean) => void;
  manualTitle: string;
  setManualTitle: (title: string) => void;
  manualPreRef: React.RefObject<HTMLPreElement | null>;
  manualSel: SelInfo | null;
  setManualSel: (sel: SelInfo | null) => void;
  manualStatus: string;
  setManualStatus: (status: string) => void;
  manualOpenSeg: SegmentDTO | null;
  setManualOpenSeg: (seg: SegmentDTO | null) => void;
  manualListScrollRef: React.RefObject<HTMLDivElement | null>;
  manualLastScrollTopRef: React.MutableRefObject<number>;
  manualClickTimerRef: React.MutableRefObject<number | null>;

  // Chunk edit modal
  chunkEditOpen: boolean;
  setChunkEditOpen: (open: boolean) => void;
  chunkEditSeg: SegmentDTO | null;
  setChunkEditSeg: (seg: SegmentDTO | null) => void;
  chunkEditTitle: string;
  setChunkEditTitle: (title: string) => void;
  chunkEditStart: number;
  setChunkEditStart: (start: number) => void;
  chunkEditEnd: number;
  setChunkEditEnd: (end: number) => void;
  chunkEditContent: string;
  setChunkEditContent: (content: string) => void;
  chunkEditHtml: string;
  setChunkEditHtml: (html: string) => void;
  chunkEditDirty: boolean;
  setChunkEditDirty: (dirty: boolean) => void;
  chunkEditStatus: string;
  setChunkEditStatus: (status: string) => void;
  chunkEditFolderId: string | null;
  setChunkEditFolderId: (id: string | null) => void;
  chunkEditPreRef: React.RefObject<HTMLPreElement | null>;
  chunkEditSyncFromDoc: boolean;
  setChunkEditSyncFromDoc: (sync: boolean) => void;

  // Document edit modal
  docEditOpen: boolean;
  setDocEditOpen: (open: boolean) => void;
  docEditText: string;
  setDocEditText: (text: string) => void;
  docEditHtml: string;
  setDocEditHtml: (html: string) => void;
  docEditStatus: string;
  setDocEditStatus: (status: string) => void;
  docEditSaving: boolean;
  setDocEditSaving: (saving: boolean) => void;

  // Chunk editing layout state
  chunkEditFullscreen: boolean;
  setChunkEditFullscreen: (fullscreen: boolean) => void;
  showChunkListInEdit: boolean;
  setShowChunkListInEdit: (show: boolean) => void;
  showAllChunksInEdit: boolean;
  setShowAllChunksInEdit: (show: boolean) => void;

  // Notes (Word-like)
  notesOpen: boolean;
  setNotesOpen: (open: boolean) => void;
  noteHtml: string;
  setNoteHtml: (html: string) => void;
  noteText: string;
  setNoteText: (text: string) => void;
  noteStatus: string;
  setNoteStatus: (status: string) => void;
  noteDirty: boolean;
  setNoteDirty: (dirty: boolean) => void;

  // Smart Notes
  smartNotesOpen: boolean;
  setSmartNotesOpen: (open: boolean) => void;
  smartNotes: SmartNote[];
  setSmartNotes: (notes: SmartNote[]) => void;
  currentSmartNote: SmartNote | null;
  setCurrentSmartNote: (note: SmartNote | null) => void;
  smartNoteHtml: string;
  setSmartNoteHtml: (html: string) => void;
  smartNoteText: string;
  setSmartNoteText: (text: string) => void;
  smartNoteTags: string[];
  setSmartNoteTags: (tags: string[]) => void;
  smartNoteCategory: string;
  setSmartNoteCategory: (category: string) => void;
  smartNoteChunkId: number | undefined;
  setSmartNoteChunkId: (id: number | undefined) => void;
  smartNoteDirty: boolean;
  setSmartNoteDirty: (dirty: boolean) => void;
  smartNoteStatus: string;
  setSmartNoteStatus: (status: string) => void;
  smartNoteSearchQuery: string;
  setSmartNoteSearchQuery: (query: string) => void;
  smartNoteSelectedCategory: string;
  setSmartNoteSelectedCategory: (category: string) => void;
  smartNoteSelectedTag: string;
  setSmartNoteSelectedTag: (tag: string) => void;
  newTagInput: string;
  setNewTagInput: (input: string) => void;

  // Folders
  foldersOpen: boolean;
  setFoldersOpen: (open: boolean) => void;
  folders: FolderDTO[];
  setFolders: (folders: FolderDTO[]) => void;
  folderFilter: string;
  setFolderFilter: (filter: string) => void;
  folderMap: Record<string, string>;
  setFolderMap: (map: Record<string, string>) => void;

  // Drag and drop
  draggedSegment: SegmentDTO | null;
  setDraggedSegment: (seg: SegmentDTO | null) => void;
  dragOverFolder: string | null;
  setDragOverFolder: (folderId: string | null) => void;

  // Deletion confirmation
  deletingSegId: number | null;
  setDeletingSegId: (id: number | null) => void;
  deletingManualSegId: number | null;
  setDeletingManualSegId: (id: number | null) => void;

  // Other
  wizardOpen: boolean;
  setWizardOpen: (open: boolean) => void;
  recycleBinOpen: boolean;
  setRecycleBinOpen: (open: boolean) => void;
  duplicatedChunks: any[];
  setDuplicatedChunks: (chunks: any[]) => void;
  currentFolder: FolderDTO | null;
  setCurrentFolder: (folder: FolderDTO | null) => void;

  // Computed
  canSegment: boolean;
  segHtmlKey: (segId: number) => string;
}

export function useWorkspaceState(docId: number, initialFilename?: string | null): WorkspaceState {
  // Basic state
  const [status, setStatus] = useState<string>("");
  const [docText, setDocText] = useState<string>("");
  const [filename, setFilename] = useState<string | null>(initialFilename ?? null);

  // Ingest fields
  const [parseStatus, setParseStatus] = useState<string>("pending");
  const [parseError, setParseError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<string | null>(null);

  // Summary + list
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

  // Selection / viewer
  const [selectedSegId, setSelectedSegId] = useState<number | null>(null);
  const [openSeg, setOpenSeg] = useState<SegmentDTO | null>(null);
  const highlightRef = useRef<HTMLSpanElement | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef<number>(0);
  const clickTimerRef = useRef<number | null>(null);

  // Manual modal
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const manualPreRef = useRef<HTMLPreElement | null>(null);
  const [manualSel, setManualSel] = useState<SelInfo | null>(null);
  const [manualStatus, setManualStatus] = useState<string>("");
  const [manualOpenSeg, setManualOpenSeg] = useState<SegmentDTO | null>(null);
  const manualListScrollRef = useRef<HTMLDivElement | null>(null);
  const manualLastScrollTopRef = useRef<number>(0);
  const manualClickTimerRef = useRef<number | null>(null);

  // Chunk edit modal
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

  // Document edit modal
  const [docEditOpen, setDocEditOpen] = useState(false);
  const [docEditText, setDocEditText] = useState("");
  const [docEditHtml, setDocEditHtml] = useState<string>("<p></p>");
  const [docEditStatus, setDocEditStatus] = useState("");
  const [docEditSaving, setDocEditSaving] = useState(false);

  // Chunk editing layout state
  const [chunkEditFullscreen, setChunkEditFullscreen] = useState(false);
  const [showChunkListInEdit, setShowChunkListInEdit] = useState(true);
  const [showAllChunksInEdit, setShowAllChunksInEdit] = useState(false);

  // Notes (Word-like)
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteHtml, setNoteHtml] = useState<string>("<p></p>");
  const [noteText, setNoteText] = useState<string>("");
  const [noteStatus, setNoteStatus] = useState<string>("");
  const [noteDirty, setNoteDirty] = useState<boolean>(false);

  // Smart Notes
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
  const [smartNoteSearchQuery, setSmartNoteSearchQuery] = useState<string>("");
  const [smartNoteSelectedCategory, setSmartNoteSelectedCategory] = useState<string>("all");
  const [smartNoteSelectedTag, setSmartNoteSelectedTag] = useState<string>("");
  const [newTagInput, setNewTagInput] = useState<string>("");

  // Folders
  const [foldersOpen, setFoldersOpen] = useState(false);
  const [folders, setFolders] = useState<FolderDTO[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [folderMap, setFolderMap] = useState<Record<string, string>>({});

  // Drag and drop
  const [draggedSegment, setDraggedSegment] = useState<SegmentDTO | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  // Deletion confirmation
  const [deletingSegId, setDeletingSegId] = useState<number | null>(null);
  const [deletingManualSegId, setDeletingManualSegId] = useState<number | null>(null);

  // Other
  const [wizardOpen, setWizardOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [duplicatedChunks, setDuplicatedChunks] = useState<any[]>([]);
  const [currentFolder, setCurrentFolder] = useState<FolderDTO | null>(null);

  // Computed values
  const canSegment = parseStatus === "ok";
  const segHtmlKey = (segId: number) => `aiorg_seg_html_${segId}`;

  return {
    // Basic state
    status,
    setStatus,
    docText,
    setDocText,
    filename,
    setFilename,

    // Ingest fields
    parseStatus,
    setParseStatus,
    parseError,
    setParseError,
    sourceType,
    setSourceType,

    // Summary + list
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

    // Selection / viewer
    selectedSegId,
    setSelectedSegId,
    openSeg,
    setOpenSeg,
    highlightRef,
    listScrollRef,
    lastScrollTopRef,
    clickTimerRef,

    // Manual modal
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

    // Chunk edit modal
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

    // Document edit modal
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

    // Chunk editing layout state
    chunkEditFullscreen,
    setChunkEditFullscreen,
    showChunkListInEdit,
    setShowChunkListInEdit,
    showAllChunksInEdit,
    setShowAllChunksInEdit,

    // Notes
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

    // Smart Notes
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

    // Folders
    foldersOpen,
    setFoldersOpen,
    folders,
    setFolders,
    folderFilter,
    setFolderFilter,
    folderMap,
    setFolderMap,

    // Drag and drop
    draggedSegment,
    setDraggedSegment,
    dragOverFolder,
    setDragOverFolder,

    // Deletion confirmation
    deletingSegId,
    setDeletingSegId,
    deletingManualSegId,
    setDeletingManualSegId,

    // Other
    wizardOpen,
    setWizardOpen,
    recycleBinOpen,
    setRecycleBinOpen,
    duplicatedChunks,
    setDuplicatedChunks,
    currentFolder,
    setCurrentFolder,

    // Computed
    canSegment,
    segHtmlKey,
  };
}

