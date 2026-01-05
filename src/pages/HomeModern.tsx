// src/pages/HomeModern.tsx
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
} from "../lib/api";
import { useNavigate } from "react-router-dom";
import { LoadingSpinner } from "../components/ui/Spinner";
import { ExportDialog } from "../components/ExportDialog";
import { BatchOperations } from "../components/BatchOperations";
import { PreferencesDialog } from "../components/PreferencesDialog";
import { usePreferences } from "../hooks/usePreferences";

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

export default function HomeModern() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { preferences } = usePreferences();

  const [uploads, setUploads] = useState<UploadItemDTO[]>([]);
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<UploadItemDTO | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"qa" | "paragraphs">("qa");
  const [status, setStatus] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Dialog states
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);

  async function fetchUploads() {
    setIsLoading(true);
    try {
      const data = await listUploads();
      setUploads(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setStatus(e?.message ?? "Failed to load uploads");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpload() {
    if (!file) return;
    
    setIsLoading(true);
    try {
      const data = await apiUploadFile(file);
      setStatus(`Uploaded: ${data.filename}`);
      setFile(null);
      await fetchUploads();
    } catch (e: any) {
      setStatus(e?.message ?? "Upload failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!selectedDocument) return;
    
    const confirmed = window.confirm(`Delete "${selectedDocument.filename}"?`);
    if (!confirmed) return;
    
    setIsLoading(true);
    try {
      await deleteUpload(selectedDocument.uploadId);
      setSelectedDocument(null);
      setSegments([]);
      await fetchUploads();
      setStatus("Document deleted successfully");
    } catch (e: any) {
      setStatus(e?.message ?? "Delete failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSegment() {
    if (!selectedDocument) return;
    
    setIsLoading(true);
    try {
      await segmentDocument(selectedDocument.documentId, mode);
      setStatus(`Document segmented in ${mode} mode`);
      // Refresh segments
      const segmentData = await listSegments(selectedDocument.documentId);
      setSegments(Array.isArray(segmentData) ? segmentData : []);
    } catch (e: any) {
      setStatus(e?.message ?? "Segmentation failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSegments(documentId: number) {
    try {
      const data = await listSegments(documentId);
      setSegments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setStatus(e?.message ?? "Failed to load segments");
    }
  }

  useEffect(() => {
    if (user) fetchUploads();
  }, [user]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ok": return "text-green-500";
      case "failed": return "text-red-500";
      case "pending": return "text-yellow-500";
      default: return "text-gray-500";
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      ok: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface to-surface-elevated">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                AI Organizer
              </h1>
              <span className="text-sm text-secondary">
                {uploads.length} documents
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreferences(true)}
                className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
                title="Preferences"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              
              <div className="flex items-center gap-3 px-4 py-2 bg-surface-elevated rounded-lg">
                <div className="text-right">
                  <p className="text-xs text-secondary">Logged in as</p>
                  <p className="text-sm font-medium">{user?.email}</p>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg hover:bg-surface transition-colors text-red-500"
                  title="Logout"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Bar */}
        {status && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">{status}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Upload & Document Selection */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-border p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold">Upload Document</h2>
              </div>
              
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm text-secondary mb-2">
                      {file ? file.name : "Click to upload or drag and drop"}
                    </p>
                    {file && (
                      <p className="text-xs text-secondary">
                        {formatFileSize(file.size)}
                      </p>
                    )}
                  </label>
                </div>
                
                <button
                  onClick={handleUpload}
                  disabled={!file || isLoading}
                  className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <LoadingSpinner text="Uploading..." />
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Upload Document
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Document Selection Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold">Documents</h2>
                </div>
                
                <button
                  onClick={fetchUploads}
                  disabled={isLoading}
                  className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
                  title="Refresh"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>

              {uploads.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-secondary">No documents uploaded yet</p>
                  <p className="text-sm text-secondary mt-1">Upload your first document to get started</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {uploads.map((doc) => (
                    <div
                      key={doc.documentId}
                      onClick={() => {
                        setSelectedDocument(doc);
                        loadSegments(doc.documentId);
                      }}
                      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                        selectedDocument?.documentId === doc.documentId
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{doc.filename}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(doc.parseStatus)}
                            <span className="text-xs text-secondary">
                              {formatFileSize(doc.sizeBytes)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowExportDialog(true);
                            }}
                            className="p-1.5 rounded hover:bg-surface-elevated transition-colors"
                            title="Export"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDocument(doc);
                              handleDelete();
                            }}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                            title="Delete"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Actions & Segments */}
          <div className="space-y-6">
            {/* Actions Card */}
            {selectedDocument && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold">Actions</h2>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-secondary mb-2">Segmentation Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setMode("qa")}
                        className={`py-2 px-3 rounded-lg border transition-colors ${
                          mode === "qa"
                            ? "border-primary bg-primary text-white"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        Q&A
                      </button>
                      <button
                        onClick={() => setMode("paragraphs")}
                        className={`py-2 px-3 rounded-lg border transition-colors ${
                          mode === "paragraphs"
                            ? "border-primary bg-primary text-white"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        Paragraphs
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleSegment}
                    disabled={isLoading}
                    className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <LoadingSpinner text="Segmenting..." />
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Segment Document
                      </>
                    )}
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => nav(`/documents/${selectedDocument.documentId}/view`)}
                      className="py-2 px-3 border border-border rounded-lg hover:bg-surface-elevated transition-colors"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setShowExportDialog(true)}
                      className="py-2 px-3 border border-border rounded-lg hover:bg-surface-elevated transition-colors"
                    >
                      Export
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Segments Card */}
            {segments.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-border p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold">Segments ({segments.length})</h2>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {segments.slice(0, 5).map((segment) => (
                    <div key={segment.id} className="p-3 bg-surface-elevated rounded-lg">
                      <p className="font-medium text-sm mb-1">{segment.title}</p>
                      <p className="text-xs text-secondary line-clamp-2">{segment.content}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded">
                          {segment.mode}
                        </span>
                        <span className="text-xs text-secondary">
                          #{segment.orderIndex + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {segments.length > 5 && (
                    <button
                      onClick={() => nav(`/documents/${selectedDocument?.documentId}/view`)}
                      className="w-full py-2 text-center text-sm text-primary hover:underline"
                    >
                      View all {segments.length} segments →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Batch Operations */}
        <div className="mt-8">
          <BatchOperations
            documents={uploads}
            segmentsMap={new Map()}
            onRefresh={fetchUploads}
          />
        </div>
      </main>

      {/* Dialogs */}
      {selectedDocument && (
        <ExportDialog
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          document={selectedDocument}
          segments={segments}
        />
      )}

      <PreferencesDialog
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
      />
    </div>
  );
}
