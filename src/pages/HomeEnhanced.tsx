// src/pages/HomeEnhanced.tsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  listUploads,
  uploadFile as apiUploadFile,
  listSegments,
  segmentDocument,
  listSegmentations,
  deleteUpload,
  UploadItemDTO,
  UploadResponseDTO,
} from "../lib/api";
import { useNavigate } from "react-router-dom";
import SegmentationSummaryBar from "../components/SegmentationSummaryBar";
import { getErrorMessage } from "../lib/errorHandler";
import { useLoading } from "../hooks/useLoading";
import { LoadingSpinner } from "../components/ui/Spinner";
import { SkeletonList } from "../components/ui/Skeleton";
import { useFileUpload } from "../hooks/useFileUpload";
import { FileUploadProgress } from "../components/ui/ProgressBar";

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

function fmt(dt?: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  return isNaN(d.getTime()) ? dt : d.toLocaleString();
}

function statusBadge(parseStatus?: string) {
  if (parseStatus === "ok") return "✅ ok";
  if (parseStatus === "failed") return "⛔ failed";
  if (parseStatus === "pending") return "⏳ pending";
  return parseStatus ? `• ${parseStatus}` : "—";
}

export default function HomeEnhanced() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const { loading: uploadsLoading, execute: executeWithLoading } = useLoading();
  const { loading: deleteLoading, execute: executeDelete } = useLoading();
  const { uploading, progress, upload, reset: resetUpload } = useFileUpload();

  const [segSummary, setSegSummary] = useState<SegSummaryRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [mode, setMode] = useState<"qa" | "paragraphs">("qa");
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [status, setStatus] = useState<string>("");
  const [uploads, setUploads] = useState<UploadItemDTO[]>([]);
  const [openSeg, setOpenSeg] = useState<SegmentRow | null>(null);
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "qa" | "paragraphs">("all");

  async function fetchUploads() {
    const result = await executeWithLoading(async () => {
      const data = await listUploads();
      setUploads(Array.isArray(data) ? data : []);
      return data;
    });
    
    if (!result) {
      setStatus(getErrorMessage(new Error("Failed to load uploads")));
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

  async function doUpload() {
    if (!file) return;

    try {
      const data = await upload(file);
      if (data) {
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

        setDocumentId(data.documentId || data.document_id || null);
        await fetchUploads();
      }
    } catch (error) {
      setStatus(getErrorMessage(error));
    } finally {
      resetUpload();
    }
  }

  async function doSegment() {
    if (!documentId) return;

    const result = await executeWithLoading(async () => {
      const data = await segmentDocument(documentId, mode);
      setStatus(
        `Segmented: ${data.count || 'unknown'} segments`
      );
      return data;
    });

    if (!result) {
      setStatus(getErrorMessage(new Error("Segment failed")));
    }
  }

  async function loadSegments() {
    if (!documentId) return;

    const result = await executeWithLoading(async () => {
      const out = await listSegments(documentId, mode === "all" ? undefined : mode);
      setModeFilter(mode);
      setSegments(out.items || []);
      setStatus(`Loaded ${out.items?.length || 0} segments`);
      return out;
    });

    if (!result) {
      setStatus(getErrorMessage(new Error("List failed")));
    }
  }

  async function doDelete() {
    if (!documentId) return;

    const result = await executeDelete(async () => {
      await deleteUpload(documentId);
      setQuery("");
      setModeFilter("all");
      await fetchUploads();
      return true;
    });

    if (!result) {
      setStatus(getErrorMessage(new Error("Delete failed")));
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      setStatus("Copy failed (clipboard blocked by browser).");
    }
  }

  const filteredSegments = useMemo(() => {
    let filtered = segments;
    if (query) {
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(query.toLowerCase()) ||
          s.content.toLowerCase().includes(query.toLowerCase())
      );
    }
    if (modeFilter !== "all") {
      filtered = filtered.filter((s) => s.mode === modeFilter);
    }
    return filtered;
  }, [segments, query, modeFilter]);

  const selectedUpload = uploads.find((u) => u.documentId === documentId);

  useEffect(() => {
    fetchUploads();
  }, []);

  useEffect(() => {
    if (documentId) {
      loadSegmentationSummary(documentId);
    }
  }, [documentId]);

  useEffect(() => {
    if (documentId) {
      loadSegments();
    }
  }, [documentId, mode]);

  return (
    <div className="min-h-screen bg-background text-primary p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">AI Organizer</h1>
            <p className="text-secondary">Document management and segmentation platform</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-secondary">Logged in as {user?.email || 'unknown'}</span>
            <button
              onClick={logout}
              className="px-4 py-2 bg-surface-elevated border border-border rounded-lg hover:bg-surface transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {status && (
          <div className="mb-4 p-3 bg-surface-elevated border border-border rounded-lg text-secondary">
            {status}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Upload & Document Management */}
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-surface border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Upload → Segment → List</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Choose file to upload
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg"
                    disabled={uploading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Segmentation mode
                  </label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as "qa" | "paragraphs")}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg"
                  >
                    <option value="qa">Q&A</option>
                    <option value="paragraphs">Paragraphs</option>
                  </select>
                </div>

                <button
                  onClick={doUpload}
                  disabled={!file || uploading}
                  className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <LoadingSpinner text="Uploading..." />
                  ) : (
                    "Upload"
                  )}
                </button>

                {/* Upload Progress */}
                {uploading && progress && (
                  <FileUploadProgress
                    progress={progress}
                    fileName={file?.name}
                  />
                )}
              </div>
            </div>

            {/* Existing Documents */}
            <div className="bg-surface border border-border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Pick existing document</h2>
              
              <div className="space-y-4">
                <select
                  value={documentId || ""}
                  onChange={(e) => setDocumentId(Number(e.target.value) || null)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg"
                >
                  <option value="">-- Select uploaded document --</option>
                  {uploads.map((upload) => (
                    <option key={upload.uploadId} value={upload.documentId}>
                      {upload.filename} ({statusBadge(upload.parseStatus)})
                    </option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <button
                    onClick={fetchUploads}
                    disabled={uploadsLoading}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                  >
                    {uploadsLoading ? (
                      <LoadingSpinner text="Refreshing..." />
                    ) : (
                      "Refresh list"
                    )}
                  </button>

                  <button
                    onClick={doDelete}
                    disabled={!documentId || deleteLoading}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-2"
                  >
                    {deleteLoading ? (
                      <LoadingSpinner text="Deleting..." />
                    ) : (
                      "Delete selected"
                    )}
                  </button>
                </div>

                {/* Loading Skeleton */}
                {uploadsLoading && <SkeletonList items={3} />}
              </div>
            </div>
          </div>

          {/* Right Column - Segments */}
          <div className="space-y-6">
            {selectedUpload && (
              <>
                <div className="bg-surface border border-border rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Document: {selectedUpload.filename}</h2>
                  
                  <div className="space-y-2 text-sm">
                    <div><strong>Size:</strong> {(selectedUpload.sizeBytes / 1024).toFixed(1)} KB</div>
                    <div><strong>Type:</strong> {selectedUpload.contentType}</div>
                    <div><strong>Parse status:</strong> {statusBadge(selectedUpload.parseStatus)}</div>
                    {selectedUpload.parseStatus === "failed" && selectedUpload.parseError && (
                      <div className="text-red-400">
                        <strong>Parse error:</strong> {selectedUpload.parseError}
                      </div>
                    )}
                  </div>

                  {segSummary.length > 0 && (
                    <div className="mt-4">
                      <SegmentationSummaryBar
                        summary={segSummary}
                        onModeChange={(newMode) => setMode(newMode)}
                        currentMode={mode}
                      />
                    </div>
                  )}

                  <button
                    onClick={doSegment}
                    disabled={!documentId || uploadsLoading}
                    className="w-full mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploadsLoading ? (
                      <LoadingSpinner text="Segmenting..." />
                    ) : (
                      `Segment (${mode})`
                    )}
                  </button>
                </div>

                {/* Segments List */}
                <div className="bg-surface border border-border rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Segments</h2>
                  
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Search segments..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg"
                    />

                    <select
                      value={modeFilter}
                      onChange={(e) => setModeFilter(e.target.value as any)}
                      className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg"
                    >
                      <option value="all">All modes</option>
                      <option value="qa">Q&A</option>
                      <option value="paragraphs">Paragraphs</option>
                    </select>

                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {filteredSegments.map((segment) => (
                        <div
                          key={segment.id}
                          className="p-3 bg-surface-elevated border border-border rounded-lg cursor-pointer hover:bg-surface transition-colors"
                          onClick={() => setOpenSeg(segment)}
                        >
                          <div className="font-medium">{segment.title}</div>
                          <div className="text-sm text-secondary">{preview120(segment.content)}</div>
                          <div className="text-xs text-secondary mt-1">
                            {segment.mode} • {segment.orderIndex}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Segment Detail Modal */}
        {openSeg && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-surface border border-border rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold">{openSeg.title}</h3>
                <button
                  onClick={() => setOpenSeg(null)}
                  className="text-secondary hover:text-primary"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="text-sm text-secondary">
                  Mode: {openSeg.mode} • Index: {openSeg.orderIndex}
                </div>
                
                <div className="bg-surface-elevated border border-border rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-sm">{openSeg.content}</pre>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => copyToClipboard(openSeg.content)}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  <button
                    onClick={() => nav(`/segments/${openSeg.id}`)}
                    className="px-4 py-2 bg-surface-elevated border border-border rounded-lg hover:bg-surface"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
