// src/pages/HomeNew.tsx - Modern Redesign
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  listUploads,
  uploadFile as apiUploadFile,
  listSegments,
  segmentDocument,
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

export default function HomeNew() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const { preferences } = usePreferences();

  // Simplified state management
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

  // Core functions
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
      setStatus(`✅ Uploaded: ${data.filename}`);
      setFile(null);
      await fetchUploads();
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? "Upload failed"}`);
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
      setStatus("✅ Document deleted successfully");
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? "Delete failed"}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSegment() {
    if (!selectedDocument) return;
    
    setIsLoading(true);
    try {
      await segmentDocument(selectedDocument.documentId, mode);
      setStatus(`✅ Document segmented in ${mode} mode`);
      const segmentData = await listSegments(selectedDocument.documentId);
      setSegments(Array.isArray(segmentData) ? segmentData : []);
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? "Segmentation failed"}`);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSegments(documentId: number) {
    try {
      const data = await listSegments(documentId);
      setSegments(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setStatus(`❌ ${e?.message ?? "Failed to load segments"}`);
    }
  }

  useEffect(() => {
    if (user) fetchUploads();
  }, [user]);

  // Utility functions
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
      failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Modern Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  AI Organizer
                </h1>
              </div>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {uploads.length} documents
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreferences(true)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
                title="Preferences"
              >
                <svg className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              
              <div className="flex items-center gap-3 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Logged in as</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-32">
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-red-500"
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

      {/* Status Notification */}
      {status && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">{status}</p>
            <button
              onClick={() => setStatus("")}
              className="ml-auto text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Upload & Documents */}
          <div className="lg:col-span-2 space-y-8">
            {/* Upload Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Upload Document</h2>
                    <p className="text-blue-100 text-sm">Drag & drop or click to browse</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6">
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 bg-slate-50 dark:bg-slate-900/50">
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {file ? (
                      <div className="space-y-3">
                        <div className="w-16 h-16 mx-auto bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                          <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="font-medium text-slate-900 dark:text-white">{file.name}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{formatFileSize(file.size)}</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setFile(null);
                          }}
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
                          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <p className="text-slate-900 dark:text-white font-medium">Choose a file or drag it here</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Support for PDF, DOC, DOCX, TXT files</p>
                      </div>
                    )}
                  </label>
                </div>
                
                <button
                  onClick={handleUpload}
                  disabled={!file || isLoading}
                  className="w-full mt-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
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

            {/* Documents Card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Documents</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{uploads.length} files</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={fetchUploads}
                    disabled={isLoading}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title="Refresh"
                  >
                    <svg className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-6">
                {uploads.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                      <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">No documents yet</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Upload your first document to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {uploads.map((doc) => (
                      <div
                        key={doc.documentId}
                        onClick={() => {
                          setSelectedDocument(doc);
                          loadSegments(doc.documentId);
                        }}
                        className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:shadow-md ${
                          selectedDocument?.documentId === doc.documentId
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </div>
                              <p className="font-medium text-slate-900 dark:text-white truncate">{doc.filename}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              {getStatusBadge(doc.parseStatus)}
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {formatFileSize(doc.sizeBytes)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowExportDialog(true);
                              }}
                              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              title="Export"
                            >
                              <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDocument(doc);
                                handleDelete();
                              }}
                              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
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
          </div>

          {/* Right Column - Actions & Segments */}
          <div className="space-y-8">
            {/* Actions Card */}
            {selectedDocument && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Actions</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{selectedDocument.filename}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">Segmentation Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setMode("qa")}
                        className={`py-2.5 px-3 rounded-xl border-2 transition-all duration-200 font-medium ${
                          mode === "qa"
                            ? "border-blue-500 bg-blue-500 text-white shadow-lg"
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600"
                        }`}
                      >
                        Q&A
                      </button>
                      <button
                        onClick={() => setMode("paragraphs")}
                        className={`py-2.5 px-3 rounded-xl border-2 transition-all duration-200 font-medium ${
                          mode === "paragraphs"
                            ? "border-blue-500 bg-blue-500 text-white shadow-lg"
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600"
                        }`}
                      >
                        Paragraphs
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={handleSegment}
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
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
                      className="py-2.5 px-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setShowExportDialog(true)}
                      className="py-2.5 px-3 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
                    >
                      Export
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Segments Card */}
            {segments.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                      <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Segments</h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{segments.length} items</p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {segments.slice(0, 5).map((segment) => (
                      <div key={segment.id} className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-slate-900 dark:text-white text-sm line-clamp-1 flex-1">
                            {segment.title}
                          </h4>
                          <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 rounded-full ml-2">
                            {segment.mode}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                          {segment.content}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            #{segment.orderIndex + 1}
                          </span>
                        </div>
                      </div>
                    ))}
                    
                    {segments.length > 5 && (
                      <button
                        onClick={() => nav(`/documents/${selectedDocument?.documentId}/view`)}
                        className="w-full py-2 text-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors"
                      >
                        View all {segments.length} segments →
                      </button>
                    )}
                  </div>
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
