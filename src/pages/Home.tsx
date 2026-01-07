// src/pages/Home.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { ErrorBoundary } from "../components/ErrorBoundary";
import {
  listUploads,
  listSegments,
  segmentDocument,
  listSegmentations,
  deleteUpload,
  UploadItemDTO,
  UploadResponseDTO,
} from "../lib/api";
import { useNavigate } from "react-router-dom";
import SegmentationSummaryBar from "../components/SegmentationSummaryBar";
import { useLoading } from "../hooks/useLoading";
import { useFileUpload } from "../hooks/useFileUpload";
import { FileUploadProgress } from "../components/ui/ProgressBar";
import { validateFile } from "../lib/validation";
import SearchModal from "../components/SearchModal";
import { SearchResultItem } from "../lib/api";
import { BatchOperations } from "../components/BatchOperations";
import { useBatchOperations } from "../hooks/useBatchOperations";

type SegmentRow = {
  id: number;
  orderIndex: number;
  mode: string;
  title: string;
  content: string;
  start?: number;
  end?: number;
  createdAt?: string | null;
};

type SegSummaryRow = {
  mode: "qa" | "paragraphs";
  count: number;
  lastSegmentedAt?: string | null;
};

function preview120(s: string) {
  const oneLine = (s ?? "").replace(/\s+/g, " ").trim();
  return oneLine.length > 120 ? oneLine.slice(0, 120) + "…" : oneLine;
}

function safeFileName(name: string) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 120).trim() || "export";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function statusBadge(parseStatus?: string) {
  if (parseStatus === "ok") return "✅ ok";
  if (parseStatus === "failed") return "⛔ failed";
  if (parseStatus === "pending") return "⏳ pending";
  return parseStatus ? `• ${parseStatus}` : "—";
}

export default function Home() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);

  const { loading: uploadsLoading } = useLoading();
  const { loading: deleteLoading } = useLoading();
  const { uploading, progress, upload: uploadWithProgress, reset: resetUpload, error: uploadError } = useFileUpload();

  const [segSummary, setSegSummary] = useState<SegSummaryRow[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [mode, setMode] = useState<"qa" | "paragraphs">("qa");

  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [status, setStatus] = useState<string>("");

  const [uploads, setUploads] = useState<UploadItemDTO[]>([]);

  // side panel state
  const [openSeg, setOpenSeg] = useState<SegmentRow | null>(null);
  const [copied, setCopied] = useState(false);

  // QoL state
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "qa" | "paragraphs">("all");

  const { loading: fetchLoading, execute: executeFetch } = useLoading();

  async function fetchUploads() {
    const data = await executeFetch(async () => {
      return await listUploads();
    });
    
    if (data) {
      setUploads(Array.isArray(data) ? data : []);
    } else {
      setStatus("Failed to load uploads");
    }
  }

  async function loadSegmentationSummary(docId: number) {
    try {
      const rows = await listSegmentations(docId);
      setSegSummary(Array.isArray(rows) ? (rows as SegSummaryRow[]) : []);
    } catch {
      setSegSummary([]);
    }
  }

  useEffect(() => {
    if (user) fetchUploads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (documentId) loadSegmentationSummary(documentId);
    else setSegSummary([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

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

  async function doUpload() {
    if (!file) return;

    setStatus("Uploading...");
    setOpenSeg(null);

    try {
      const data = await uploadWithProgress(file) as UploadResponseDTO;
      
      // Reset upload state after a short delay to show completion
      setTimeout(() => {
        resetUpload();
      }, 1000);

      if (data.parseStatus === "failed") {
        setStatus(
          `Uploaded, but parse FAILED (${data.filename}). Reason: ${data.parseError ?? "unknown error"}`
        );
      } else if (data.deduped) {
        setStatus(
          `File deduped: ${data.filename}. Existing document used.`
        );
      } else {
        setStatus(`Uploaded: ${data.filename}`);
      }

      setDocumentId(data.documentId || null);
      await fetchUploads();
    } catch (e: any) {
      setStatus(e?.message ?? uploadError ?? "Upload failed");
      resetUpload();
    }
  }

  function extractCount(payload: any): number | null {
    if (!payload) return null;
    if (typeof payload.count === "number") return payload.count;
    if (typeof payload.inserted === "number") return payload.inserted;
    if (typeof payload.created === "number") return payload.created;
    if (typeof payload.segments_created === "number") return payload.segments_created;
    if (typeof payload.total === "number") return payload.total;
    if (Array.isArray(payload)) return payload.length;
    if (Array.isArray(payload.items)) return payload.items.length;
    if (typeof payload.segments === "number") return payload.segments;
    return null;
  }

  async function segmentDoc() {
    if (!documentId) return;

    if (!canSegment) {
      setStatus(
        `Cannot segment: document parseStatus is "${selectedUpload?.parseStatus}". Fix upload/parse first.`
      );
      return;
    }

    setStatus("Segmenting...");
    setOpenSeg(null);

    try {
      const data = await segmentDocument(documentId, mode);
      await loadSegmentationSummary(documentId);

      const count = extractCount(data);
      setStatus(
        count !== null ? `Segmented: ${count} segments` : `Segment response: ${JSON.stringify(data)}`
      );
    } catch (e: any) {
      setStatus(e?.message ?? "Segment failed");
    }
  }

  async function loadSegments() {
    if (!documentId) return;

    setStatus("Loading segments...");
    setOpenSeg(null);

    try {
      const response = await listSegments(documentId, mode);
      const items = Array.isArray(response.items) ? response.items : [];
      setModeFilter(mode);
      setSegments(items);
      setStatus(`Loaded ${items.length} segments`);
    } catch (e: any) {
      setStatus(e?.message ?? "List failed");
    }
  }

  async function deleteSelectedUpload() {
    if (!selectedUpload) return;

    const ok = window.confirm(`Delete upload "${selectedUpload.filename}"?`);
    if (!ok) return;

    try {
      await deleteUpload(selectedUpload.uploadId);
      setQuery("");
      setModeFilter("all");
      await fetchUploads();
    } catch (e: any) {
      setStatus(e?.message ?? "Delete failed");
    }
  }

  async function copyOpenSegment(withTitle: boolean) {
    if (!openSeg) return;
    const text = withTitle ? `${openSeg.title}\n\n${openSeg.content ?? ""}` : openSeg.content ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      setStatus("Copy failed (clipboard blocked by browser).");
    }
  }

  function exportOpenSegmentTxt() {
    if (!openSeg) return;

    const docLabel = selectedUpload?.filename
      ? safeFileName(selectedUpload.filename)
      : `doc_${documentId ?? "unknown"}`;
    const segLabel = safeFileName(`${openSeg.orderIndex + 1}_${openSeg.title || "segment"}`);
    const fileName = `${docLabel}__${segLabel}.txt`;

    const content = `${openSeg.title}\n(mode: ${openSeg.mode}, order: ${
      openSeg.orderIndex + 1
    })\n\n${openSeg.content ?? ""}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 300);
  }

  const segSummaryByMode = useMemo(() => {
    const map: Record<string, SegSummaryRow> = {};
    for (const row of segSummary) map[row.mode] = row;
    return map;
  }, [segSummary]);

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #0f0f1a 50%, #0a0a0a 100%)",
        maxWidth: 1600,
        margin: "0 auto",
        color: "#eaeaea",
        padding: "32px 32px",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(15, 15, 25, 0.95) 100%)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "20px",
          padding: "32px 40px",
          marginBottom: "40px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                borderRadius: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(99, 102, 241, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset",
                transform: "translateY(0)",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px) scale(1.05)";
                e.currentTarget.style.boxShadow = "0 12px 32px rgba(99, 102, 241, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0) scale(1)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(99, 102, 241, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset";
              }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "32px", height: "32px" }}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <h1
                style={{
                  fontSize: "var(--font-size-2xl)",
                  lineHeight: "var(--line-height-snug)",
                  letterSpacing: "var(--letter-spacing-tight)",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  margin: 0,
                  letterSpacing: "-0.5px",
                }}
              >
                AI Organizer
              </h1>
              <p style={{ marginTop: "8px", fontSize: "16px", color: "rgba(255, 255, 255, 0.6)", fontWeight: 400 }}>
                Document management and segmentation platform
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <div
              style={{
                textAlign: "right",
                background: "rgba(255, 255, 255, 0.03)",
                padding: "12px 20px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                backdropFilter: "blur(10px)",
              }}
            >
              <p style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.5)", margin: 0, marginBottom: "4px" }}>Logged in as</p>
              <p style={{ fontSize: "var(--font-size-base)", lineHeight: "var(--line-height-normal)", fontWeight: 600, color: "#eaeaea", margin: 0 }}>{user?.email}</p>
            </div>
            <button
              onClick={logout}
              style={{
                padding: "12px 24px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                color: "#eaeaea",
                fontWeight: 500,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </button>
            <button
              onClick={() => setSearchOpen(true)}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                borderRadius: "12px",
                color: "#a5b4fc",
                fontWeight: 500,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 8px rgba(99, 102, 241, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.3) 100%)";
                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.4)";
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)";
                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.3)";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(99, 102, 241, 0.2)";
              }}
              title="Search (Ctrl+K)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(99, 102, 241, 0.2)",
            }}
          >
            <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "20px", height: "20px", color: "#6366f1" }}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#eaeaea", margin: 0 }}>Pick existing document</h2>
        </div>
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20, 20, 30, 0.8) 0%, rgba(15, 15, 25, 0.8) 100%)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
          }}
        >
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={documentId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setDocumentId(v ? Number(v) : null);
            setSegments([]);
            setOpenSeg(null);
            setQuery("");
            setModeFilter("all");
          }}
              style={{
                flex: "1 1 400px",
                minWidth: "400px",
                padding: "14px 18px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(0, 0, 0, 0.3)",
                color: "#eaeaea",
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                fontWeight: 400,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
                transition: "all 0.2s ease",
                cursor: "pointer",
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.5)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99, 102, 241, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
              }}
        >
          <option value="">-- Select uploaded document --</option>
          {uploads.map((u) => (
            <option key={u.documentId} value={u.documentId}>
              {u.filename} • {statusBadge(u.parseStatus)} (docId={u.documentId})
            </option>
          ))}
        </select>

        <button
              onClick={fetchUploads}
              disabled={uploadsLoading}
          style={{
                padding: "14px 20px",
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                border: "none",
                borderRadius: "12px",
                color: "white",
                fontWeight: 600,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: uploadsLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                opacity: uploadsLoading ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!uploadsLoading) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(99, 102, 241, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.3)";
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {uploadsLoading ? "Refreshing..." : "Refresh list"}
        </button>

        <button
              onClick={deleteSelectedUpload}
              disabled={!selectedUpload || deleteLoading}
          style={{
                padding: "14px 20px",
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                border: "none",
                borderRadius: "12px",
                color: "white",
                fontWeight: 600,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: !selectedUpload || deleteLoading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
                boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
                opacity: !selectedUpload || deleteLoading ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (selectedUpload && !deleteLoading) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(239, 68, 68, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.3)";
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              {deleteLoading ? "Deleting..." : "Delete selected"}
        </button>
          </div>
        </div>
      </div>

      {/* Parse details */}
      {selectedUpload && (
        <div
          style={{
            marginTop: "24px",
            padding: "24px",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background: "linear-gradient(135deg, rgba(20, 20, 30, 0.8) 0%, rgba(15, 15, 25, 0.8) 100%)",
            backdropFilter: "blur(20px)",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                background: "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(59, 130, 246, 0.2)",
              }}
            >
              <svg className="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px", color: "#60a5fa" }}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 style={{ fontSize: "var(--font-size-lg)", lineHeight: "var(--line-height-snug)", letterSpacing: "var(--letter-spacing-tight)", fontWeight: 600, color: "#eaeaea", margin: 0 }}>Document Details</h3>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 300px" }}>
              <div style={{ marginBottom: "8px" }}>
                <span style={{ fontWeight: 600, color: "rgba(255, 255, 255, 0.8)" }}>Parse status:</span>{" "}
                <span style={{ color: "#eaeaea" }}>{statusBadge(selectedUpload.parseStatus)}</span>
              </div>
              {selectedUpload.parseStatus === "failed" && selectedUpload.parseError ? (
                <div
                  style={{
                    marginTop: "12px",
                    padding: "12px",
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: "8px",
                    color: "#fca5a5",
                    whiteSpace: "pre-wrap",
                    fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Parse error:</span> {selectedUpload.parseError}
                </div>
              ) : null}
            </div>

            <div style={{ opacity: 0.8, fontSize: "var(--font-size-base)", lineHeight: "var(--line-height-normal)" }}>
              <div style={{ marginBottom: "6px" }}>
                <span style={{ fontWeight: 600, color: "rgba(255, 255, 255, 0.8)" }}>Type:</span>{" "}
                <span style={{ color: "#eaeaea" }}>{selectedUpload.contentType}</span>
              </div>
              <div>
                <span style={{ fontWeight: 600, color: "rgba(255, 255, 255, 0.8)" }}>Size:</span>{" "}
                <span style={{ color: "#eaeaea" }}>{selectedUpload.sizeBytes.toLocaleString()} bytes</span>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              background: "rgba(255, 255, 255, 0.03)",
              borderRadius: "8px",
                  fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
              color: "rgba(255, 255, 255, 0.7)",
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            Supported for now: <span style={{ fontWeight: 600, color: "#eaeaea" }}>.txt .md .json (ChatGPT export) .docx</span> • Not supported:{" "}
            <span style={{ fontWeight: 600, color: "#eaeaea" }}>.doc</span> (upload .docx).
          </div>
        </div>
      )}

      {/* Segmentation summary */}
      {documentId && (
        <div style={{ marginTop: 14 }}>
          <SegmentationSummaryBar
            qa={{
              count: segSummaryByMode.qa?.count ?? 0,
              last: segSummaryByMode.qa?.lastSegmentedAt ?? null,
            }}
            paragraphs={{
              count: segSummaryByMode.paragraphs?.count ?? 0,
              last: segSummaryByMode.paragraphs?.lastSegmentedAt ?? null,
            }}
            onRefresh={() => {
              if (documentId) loadSegmentationSummary(documentId);
            }}
            drawerTitle={`Document #${documentId} • Segmentation`}
          />
          
          {/* Document Action Buttons */}
          <div style={{ marginTop: "16px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              onClick={() => {
                nav(`/documents/${documentId}/view`);
              }}
              disabled={!documentId}
              style={{
                padding: "12px 20px",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                border: "none",
                borderRadius: "12px",
                color: "white",
                fontWeight: 600,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: !documentId ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                opacity: !documentId ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (documentId) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(59, 130, 246, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Document
            </button>
            <button
              onClick={() => {
                nav(`/documents/${documentId}`);
              }}
              disabled={!documentId}
              style={{
                padding: "12px 20px",
                background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                border: "none",
                borderRadius: "12px",
                color: "white",
                fontWeight: 600,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: !documentId ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
                boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                opacity: !documentId ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (documentId) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(99, 102, 241, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.3)";
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Open Workspace
            </button>
          </div>
        </div>
      )}

      <div style={{ margin: "40px 0", height: "1px", background: "linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)" }}></div>

      <div style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid rgba(16, 185, 129, 0.2)",
            }}
          >
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "20px", height: "20px", color: "#10b981" }}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <h2 style={{ fontSize: "24px", fontWeight: 700, color: "#eaeaea", margin: 0 }}>Upload → Segment → List</h2>
        </div>

        <div
          style={{
            background: "linear-gradient(135deg, rgba(20, 20, 30, 0.8) 0%, rgba(15, 15, 25, 0.8) 100%)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 300px", minWidth: "300px" }}>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "rgba(255, 255, 255, 0.7)", marginBottom: "8px" }}>
                Choose file to upload
              </label>
              <input
                type="file"
                accept=".docx,.doc"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0] ?? null;
                  setFile(selectedFile);
                  setFileError(null);
                  
                  if (selectedFile) {
                    const error = validateFile(selectedFile, {
                      maxSizeMB: 50,
                      allowedTypes: ['.docx', '.doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
                    });
                    if (error) {
                      setFileError(error);
                    }
                  }
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "12px",
                  border: `1px solid ${fileError ? "rgba(239, 68, 68, 0.5)" : "rgba(255, 255, 255, 0.1)"}`,
                  background: "rgba(0, 0, 0, 0.3)",
                  color: "#eaeaea",
                  fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = fileError ? "rgba(239, 68, 68, 0.7)" : "rgba(99, 102, 241, 0.5)";
                  e.currentTarget.style.boxShadow = fileError ? "0 0 0 3px rgba(239, 68, 68, 0.1)" : "0 0 0 3px rgba(99, 102, 241, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = fileError ? "rgba(239, 68, 68, 0.5)" : "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {fileError && (
                <p style={{ fontSize: 12, color: "#ef4444", marginTop: 8, marginBottom: 0 }}>
                  {fileError}
                </p>
              )}
              {file && !fileError && (
                <p style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.6)", marginTop: 8, marginBottom: 0 }}>
                  Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button
                onClick={doUpload}
                disabled={!file || uploading}
                style={{
                  padding: "14px 28px",
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  border: "none",
                  borderRadius: "12px",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
                  cursor: !file || uploading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                  opacity: !file || uploading ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (file && !uploading) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(99, 102, 241, 0.4)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.3)";
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
          
          {/* Upload Progress Bar */}
          {uploading && progress && (
            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                background: "linear-gradient(135deg, rgba(20, 20, 30, 0.8) 0%, rgba(15, 15, 25, 0.8) 100%)",
                backdropFilter: "blur(20px)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
              }}
            >
              {file?.name && (
                <div
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "rgba(255, 255, 255, 0.7)",
                    marginBottom: "12px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {file.name}
                </div>
              )}
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  marginBottom: "8px",
                }}
              >
                <div
                  style={{
                    width: `${progress.percentage}%`,
                    height: "100%",
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    transition: "width 0.3s ease",
                    borderRadius: "4px",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "var(--font-size-xs)",
                  color: "rgba(255, 255, 255, 0.6)",
                }}
              >
                <span>{formatBytes(progress.loaded)}</span>
                <span>{formatBytes(progress.total)}</span>
                <span>{progress.percentage}%</span>
              </div>
            </div>
          )}
          
          {/* Upload Error */}
          {uploadError && (
            <div
              style={{
                marginTop: "12px",
                padding: "12px 16px",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "12px",
                color: "#fca5a5",
                fontSize: "var(--font-size-sm)",
              }}
            >
              {uploadError}
            </div>
          )}
        </div>

      {localDuplicateHint && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px 16px",
              background: "rgba(251, 191, 36, 0.1)",
              border: "1px solid rgba(251, 191, 36, 0.2)",
              borderRadius: "12px",
              color: "#fcd34d",
                  fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
            }}
          >
            Hint: This looks already uploaded as <span style={{ fontWeight: 600 }}>docId={localDuplicateHint.documentId}</span>. Select it from the dropdown to avoid duplicates.
          </div>
        )}

        <div
          style={{
            background: "linear-gradient(135deg, rgba(20, 20, 30, 0.8) 0%, rgba(15, 15, 25, 0.8) 100%)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            padding: "24px",
            boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "var(--font-size-base)", lineHeight: "var(--line-height-normal)", fontWeight: 500, color: "rgba(255, 255, 255, 0.7)" }}>Segmentation mode:</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "rgba(0, 0, 0, 0.3)",
                  color: "#eaeaea",
                  fontSize: "var(--font-size-sm)",
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
            </div>

        <button
          onClick={segmentDoc}
          disabled={!documentId || !canSegment}
              style={{
                padding: "12px 20px",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                border: "none",
                borderRadius: "12px",
                color: "white",
                fontWeight: 600,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: !documentId || !canSegment ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                opacity: !documentId || !canSegment ? 0.6 : 1,
              }}
          title={!canSegment ? "Document must be parseStatus=ok to segment." : ""}
              onMouseEnter={(e) => {
                if (documentId && canSegment) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(59, 130, 246, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
          Segment
        </button>

            <button
              onClick={loadSegments}
              disabled={!documentId}
              style={{
                padding: "12px 20px",
                background: "linear-gradient(135deg, #a855f7 0%, #9333ea 100%)",
                border: "none",
                borderRadius: "12px",
                color: "white",
                fontWeight: 600,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: !documentId ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
                boxShadow: "0 4px 12px rgba(168, 85, 247, 0.3)",
                opacity: !documentId ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (documentId) {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(168, 85, 247, 0.4)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(168, 85, 247, 0.3)";
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
          List Segments
        </button>
          </div>
      </div>

        {status && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px 16px",
              background: "rgba(99, 102, 241, 0.1)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              borderRadius: "12px",
              color: "#c7d2fe",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            {status}
          </div>
        )}

        <div
          style={{
            marginTop: "32px",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
            background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(15, 15, 25, 0.95) 100%)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div
            style={{
              padding: "24px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              background: "linear-gradient(135deg, rgba(30, 30, 40, 0.5) 0%, rgba(20, 20, 30, 0.3) 100%)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    background: "linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(168, 85, 247, 0.2)",
                  }}
                >
                  <svg className="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px", color: "#a78bfa" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: 700, color: "#eaeaea", margin: 0 }}>Segments</h3>
              </div>
              <span
                style={{
                  fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
                  fontWeight: 600,
                  padding: "6px 14px",
                  borderRadius: "20px",
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
                  color: "#c7d2fe",
                  border: "1px solid rgba(99, 102, 241, 0.3)",
                }}
              >
                {segments.length ? `${filteredSegments.length}/${segments.length} segments` : "No segments"}
              </span>
          </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
              <div style={{ flex: "1 1 300px", minWidth: "300px", position: "relative" }}>
                <svg
                  style={{
                    position: "absolute",
                    left: "14px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: "16px",
                    height: "16px",
                    color: "rgba(255, 255, 255, 0.4)",
                  }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search segments..."
              style={{
                    width: "100%",
                    paddingLeft: "40px",
                    paddingRight: "16px",
                    paddingTop: "12px",
                    paddingBottom: "12px",
                    borderRadius: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    background: "rgba(0, 0, 0, 0.3)",
                color: "#eaeaea",
                    fontSize: "var(--font-size-sm)",
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

            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value as any)}
              style={{
                  padding: "12px 16px",
                  borderRadius: "12px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: "rgba(0, 0, 0, 0.3)",
                color: "#eaeaea",
                  fontSize: "var(--font-size-sm)",
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
              <option value="all">All modes</option>
                <option value="qa">Q&A</option>
                <option value="paragraphs">Paragraphs</option>
            </select>

            <button
              onClick={() => {
                setQuery("");
                setModeFilter("all");
              }}
              disabled={!query && modeFilter === "all"}
                style={{
                  padding: "12px 18px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  color: "#eaeaea",
                  fontWeight: 500,
                  fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
                  cursor: !query && modeFilter === "all" ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                  opacity: !query && modeFilter === "all" ? 0.4 : 1,
                }}
                onMouseEnter={(e) => {
                  if (query || modeFilter !== "all") {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              Clear
            </button>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
                <tr
                  style={{
                    textAlign: "left",
                    background: "linear-gradient(135deg, rgba(30, 30, 40, 0.5) 0%, rgba(20, 20, 30, 0.3) 100%)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <th style={{ padding: "16px 24px", width: "80px", fontWeight: 600, color: "rgba(255, 255, 255, 0.6)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    #
                  </th>
                  <th style={{ padding: "16px 24px", width: "140px", fontWeight: 600, color: "rgba(255, 255, 255, 0.6)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Type
                  </th>
                  <th style={{ padding: "16px 24px", width: "380px", fontWeight: 600, color: "rgba(255, 255, 255, 0.6)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Title
                  </th>
                  <th style={{ padding: "16px 24px", fontWeight: 600, color: "rgba(255, 255, 255, 0.6)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Preview
                  </th>
              </tr>
            </thead>
            <tbody>
              {!segments.length ? (
                <tr>
                    <td colSpan={4} style={{ padding: "48px 24px", textAlign: "center", opacity: 0.6 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                        <div
                          style={{
                            width: "64px",
                            height: "64px",
                            background: "rgba(255, 255, 255, 0.05)",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                          }}
                        >
                          <svg style={{ width: "32px", height: "32px", color: "rgba(255, 255, 255, 0.4)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                          </svg>
                        </div>
                        <div>
                          <p style={{ color: "rgba(255, 255, 255, 0.7)", fontWeight: 600, fontSize: "16px", margin: 0, marginBottom: "8px" }}>
                            No segments loaded yet
                          </p>
                          <p style={{ fontSize: "13px", opacity: 0.7, margin: 0, color: "rgba(255, 255, 255, 0.5)" }}>
                            Click <span style={{ color: "#6366f1", fontWeight: 600 }}>List Segments</span> to get started
                          </p>
                        </div>
                      </div>
                  </td>
                </tr>
              ) : !filteredSegments.length ? (
                <tr>
                    <td colSpan={4} style={{ padding: "48px 24px", textAlign: "center", opacity: 0.6 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                        <div
                          style={{
                            width: "64px",
                            height: "64px",
                            background: "rgba(255, 255, 255, 0.05)",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            border: "1px solid rgba(255, 255, 255, 0.1)",
                          }}
                        >
                          <svg style={{ width: "32px", height: "32px", color: "rgba(255, 255, 255, 0.4)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <div>
                          <p style={{ color: "rgba(255, 255, 255, 0.7)", fontWeight: 600, fontSize: "16px", margin: 0, marginBottom: "8px" }}>
                            No results found
                          </p>
                          <p style={{ fontSize: "13px", opacity: 0.7, margin: 0, color: "rgba(255, 255, 255, 0.5)" }}>Try adjusting your search or filter</p>
                        </div>
                      </div>
                  </td>
                </tr>
              ) : (
                filteredSegments.map((s) => {
                  const isActive = openSeg?.id === s.id;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setOpenSeg(s)}
                      style={{
                        cursor: "pointer",
                          transition: "all 0.15s ease",
                          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                          background: isActive ? "rgba(99, 102, 241, 0.1)" : "transparent",
                          borderLeft: isActive ? "4px solid #6366f1" : "4px solid transparent",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "transparent";
                          }
                        }}
                      >
                        <td style={{ padding: "16px 24px", opacity: 0.9 }}>
                          <span
                            style={{
                              fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
                              fontFamily: "monospace",
                              background: "rgba(255, 255, 255, 0.05)",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              border: "1px solid rgba(255, 255, 255, 0.1)",
                            }}
                          >
                            #{s.orderIndex + 1}
                          </span>
                      </td>
                        <td style={{ padding: "16px 24px" }}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "6px 12px",
                              borderRadius: "20px",
                              fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
                              fontWeight: 600,
                              ...(s.mode === "qa"
                                ? {
                                    background: "rgba(59, 130, 246, 0.2)",
                                    color: "#93c5fd",
                                    border: "1px solid rgba(59, 130, 246, 0.3)",
                                  }
                                : {
                                    background: "rgba(16, 185, 129, 0.2)",
                                    color: "#6ee7b7",
                                    border: "1px solid rgba(16, 185, 129, 0.3)",
                                  }),
                            }}
                          >
                            {s.mode === "qa" ? "Q&A" : "Paragraph"}
                          </span>
                        </td>
                        <td style={{ padding: "16px 24px" }}>
                          <div style={{ fontWeight: 600, color: "#eaeaea", transition: "color 0.2s ease" }}>{s.title}</div>
                        </td>
                        <td style={{ padding: "16px 24px", opacity: 0.75, fontSize: "13px" }}>
                          <div style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {preview120(s.content)}
                          </div>
                        </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side panel */}
      {openSeg && (
        <>
          <div
            onClick={() => setOpenSeg(null)}
            style={{
              position: "fixed",
              inset: 0,
                background: "rgba(0, 0, 0, 0.7)",
                backdropFilter: "blur(4px)",
              zIndex: 50,
                transition: "all 0.2s ease",
            }}
          />

          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              height: "100vh",
                width: "min(640px, 92vw)",
                background: "linear-gradient(135deg, rgba(11, 14, 20, 0.98) 0%, rgba(8, 10, 16, 0.98) 100%)",
                backdropFilter: "blur(20px)",
                borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
              zIndex: 60,
              display: "flex",
              flexDirection: "column",
                boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
                animation: "slideIn 0.3s ease-out",
              }}
            >
              <style>{`
                @keyframes slideIn {
                  from {
                    transform: translateX(100%);
                  }
                  to {
                    transform: translateX(0);
                  }
                }
              `}</style>
              <div
                style={{
                  padding: "28px 32px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  background: "linear-gradient(135deg, rgba(30, 30, 40, 0.6) 0%, rgba(20, 20, 30, 0.4) 100%)",
                  display: "flex",
                  gap: "20px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 200px", minWidth: "200px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                    <div
                      style={{
                        width: "40px",
                        height: "40px",
                        background: "linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid rgba(99, 102, 241, 0.3)",
                        fontWeight: 700,
                        fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-relaxed)",
                        color: "#c7d2fe",
                      }}
                    >
                      #{openSeg.orderIndex + 1}
                </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "22px", color: "#eaeaea", lineHeight: "1.3" }}>
                        {openSeg.title}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                        background: "rgba(255, 255, 255, 0.05)",
                        border: "1px solid rgba(255, 255, 255, 0.1)",
                        color: "rgba(255, 255, 255, 0.7)",
                      }}
                    >
                      Mode
                    </span>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "4px 12px",
                        borderRadius: "20px",
                        fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
                        fontWeight: 600,
                        ...(openSeg.mode === "qa"
                          ? {
                              background: "rgba(59, 130, 246, 0.2)",
                              color: "#93c5fd",
                              border: "1px solid rgba(59, 130, 246, 0.3)",
                            }
                          : {
                              background: "rgba(16, 185, 129, 0.2)",
                              color: "#6ee7b7",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                            }),
                      }}
                    >
                      {openSeg.mode === "qa" ? "Q&A" : "Paragraphs"}
                    </span>
                  </div>
              </div>

                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    onClick={() => copyOpenSegment(false)}
                    style={{
                      padding: "11px 18px",
                      background: copied ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.06)",
                      border: copied ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "12px",
                      color: copied ? "#6ee7b7" : "#eaeaea",
                      fontWeight: 600,
                      fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: copied ? "0 2px 8px rgba(16, 185, 129, 0.2)" : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!copied) {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.18)";
                        e.currentTarget.style.transform = "translateY(-1px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!copied) {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }
                    }}
                  >
                    <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                {copied ? "Copied!" : "Copy"}
              </button>

                  <button
                    onClick={() => copyOpenSegment(true)}
                    style={{
                      padding: "11px 18px",
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "12px",
                      color: "#eaeaea",
                      fontWeight: 600,
                      fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.18)";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                Copy Title+Text
              </button>

                  <button
                    onClick={exportOpenSegmentTxt}
                    style={{
                      padding: "11px 18px",
                      background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                      border: "none",
                      borderRadius: "12px",
                      color: "white",
                      fontWeight: 600,
                      fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 10px rgba(99, 102, 241, 0.35)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 16px rgba(99, 102, 241, 0.45)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 10px rgba(99, 102, 241, 0.35)";
                    }}
                  >
                    <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                Export .txt
              </button>

                  <button
                    onClick={() => setOpenSeg(null)}
                    style={{
                      padding: "11px 18px",
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      borderRadius: "12px",
                      color: "#eaeaea",
                      fontWeight: 600,
                      fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                      e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)";
                      e.currentTarget.style.color = "#fca5a5";
                      e.currentTarget.style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.12)";
                      e.currentTarget.style.color = "#eaeaea";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                  >
                    <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                Close
              </button>

                  <button
                    onClick={() => nav(`/segments/${openSeg.id}`)}
                    style={{
                      padding: "11px 18px",
                      background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                      border: "none",
                      borderRadius: "12px",
                      color: "white",
                      fontWeight: 600,
                      fontSize: "var(--font-size-sm)",
                  lineHeight: "var(--line-height-normal)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 10px rgba(16, 185, 129, 0.35)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 4px 16px rgba(16, 185, 129, 0.45)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 10px rgba(16, 185, 129, 0.35)";
                    }}
                  >
                    <svg style={{ width: "14px", height: "14px" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                Open details
              </button>
                </div>
            </div>

              <div
                style={{
                  padding: "32px",
                  overflow: "auto",
                  flex: "1 1 auto",
                  minHeight: 0,
                  background: "linear-gradient(180deg, rgba(15, 15, 20, 0.5) 0%, rgba(10, 10, 15, 0.8) 100%)",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    maxWidth: "100%",
                    color: "#eaeaea",
                    fontSize: "15px",
                    lineHeight: "1.8",
                    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
                    whiteSpace: "pre-wrap",
                    wordWrap: "break-word",
                    padding: "24px",
                    background: "rgba(255, 255, 255, 0.02)",
                    borderRadius: "12px",
                    border: "1px solid rgba(255, 255, 255, 0.05)",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2) inset",
                  }}
                >
                  {openSeg.content}
                </div>
            </div>
          </div>
        </>
      )}
      </div>

      {/* Search Modal */}
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectResult={(result: SearchResultItem) => {
          if (result.type === "document") {
            nav(`/documents/${result.documentId}/view`);
          } else if (result.documentId) {
            nav(`/documents/${result.documentId}`);
          }
        }}
      />
    </div>
  );
}
