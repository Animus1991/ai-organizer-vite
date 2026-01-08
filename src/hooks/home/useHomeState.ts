import { useState, useRef, useMemo } from "react";
import { UploadItemDTO } from "../../lib/api";

export type SegmentRow = {
  id: number;
  orderIndex: number;
  mode: string;
  title: string;
  content: string;
  start?: number;
  end?: number;
  createdAt?: string | null;
};

export type SegSummaryRow = {
  mode: "qa" | "paragraphs";
  count: number;
  lastSegmentedAt?: string | null;
};

export function useHomeState() {
  // UI state
  const [searchOpen, setSearchOpen] = useState(false);
  const hasFetchedRef = useRef(false);

  // Segmentation summary
  const [segSummary, setSegSummary] = useState<SegSummaryRow[]>([]);

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [mode, setMode] = useState<"qa" | "paragraphs">("qa");

  // Segments state
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [status, setStatus] = useState<string>("");

  // Uploads list
  const [uploads, setUploads] = useState<UploadItemDTO[]>([]);

  // Side panel state
  const [openSeg, setOpenSeg] = useState<SegmentRow | null>(null);
  const [copied, setCopied] = useState(false);

  // QoL state (filters)
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "qa" | "paragraphs">("all");

  // Computed values
  const selectedUpload = useMemo(() => {
    if (!documentId) return null;
    return uploads.find((u) => u.documentId === documentId) ?? null;
  }, [documentId, uploads]);

  const localDuplicateHint = useMemo(() => {
    if (!file) return null;
    const hit = uploads.find((u) => u.filename === file.name && u.sizeBytes === file.size);
    return hit ?? null;
  }, [file, uploads]);

  const canSegment = useMemo(() => {
    if (!selectedUpload) return false;
    return selectedUpload.parseStatus === "ok";
  }, [selectedUpload]);

  const filteredSegments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return segments.filter((s) => {
      const modeOk = modeFilter === "all" ? true : s.mode === modeFilter;
      if (!modeOk) return false;
      if (!q) return true;
      const hay = `${s.title ?? ""} ${s.content ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [segments, query, modeFilter]);

  const segSummaryByMode = useMemo(() => {
    const map: Record<string, SegSummaryRow> = {};
    for (const r of segSummary) map[r.mode] = r;
    return map;
  }, [segSummary]);

  return {
    // UI state
    searchOpen,
    setSearchOpen,
    hasFetchedRef,

    // Segmentation summary
    segSummary,
    setSegSummary,

    // Upload state
    file,
    setFile,
    fileError,
    setFileError,
    documentId,
    setDocumentId,
    mode,
    setMode,

    // Segments state
    segments,
    setSegments,
    status,
    setStatus,

    // Uploads list
    uploads,
    setUploads,

    // Side panel state
    openSeg,
    setOpenSeg,
    copied,
    setCopied,

    // QoL state (filters)
    query,
    setQuery,
    modeFilter,
    setModeFilter,

    // Computed values
    selectedUpload,
    localDuplicateHint,
    canSegment,
    filteredSegments,
    segSummaryByMode,
  };
}

