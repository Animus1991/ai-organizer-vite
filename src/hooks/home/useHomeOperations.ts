import { useCallback } from "react";
import {
  listUploads,
  listSegments,
  segmentDocument,
  listSegmentations,
  deleteUpload,
  UploadResponseDTO,
} from "../../lib/api";
import type { SegSummaryRow } from "./useHomeState";

// Define HomeState interface based on what useHomeState returns
export interface HomeState {
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  hasFetchedRef: React.MutableRefObject<boolean>;
  segSummary: SegSummaryRow[];
  setSegSummary: (summary: SegSummaryRow[]) => void;
  file: File | null;
  setFile: (file: File | null) => void;
  fileError: string | null;
  setFileError: (error: string | null) => void;
  documentId: number | null;
  setDocumentId: (id: number | null) => void;
  mode: "qa" | "paragraphs";
  setMode: (mode: "qa" | "paragraphs") => void;
  segments: any[];
  setSegments: (segments: any[]) => void;
  status: string;
  setStatus: (status: string) => void;
  uploads: any[];
  setUploads: (uploads: any[]) => void;
  openSeg: any | null;
  setOpenSeg: (seg: any | null) => void;
  copied: boolean;
  setCopied: (copied: boolean) => void;
  query: string;
  setQuery: (query: string) => void;
  modeFilter: "all" | "qa" | "paragraphs";
  setModeFilter: (filter: "all" | "qa" | "paragraphs") => void;
  selectedUpload: any | null;
  localDuplicateHint: any | null;
  canSegment: boolean;
  filteredSegments: any[];
  segSummaryByMode: Record<string, SegSummaryRow>;
}

export interface HomeOperations {
  fetchUploads: () => Promise<void>;
  loadSegmentationSummary: (docId: number) => Promise<void>;
  doUpload: () => Promise<void>;
  segmentDoc: () => Promise<void>;
  loadSegments: () => Promise<void>;
  deleteSelectedUpload: () => Promise<void>;
  copyOpenSegment: (withTitle: boolean) => Promise<void>;
  exportOpenSegmentTxt: () => void;
  extractCount: (payload: any) => number | null;
}

export function useHomeOperations(
  state: HomeState,
  setLoading: (key: string, loading: boolean) => void,
  uploadWithProgress: (file: File) => Promise<UploadResponseDTO>,
  resetUpload: () => void,
  uploadError: string | null,
  executeFetch: <T>(fn: () => Promise<T>) => Promise<T | null>
): HomeOperations {
  const {
    setUploads,
    setSegSummary,
    file,
    setStatus,
    setOpenSeg,
    documentId,
    setDocumentId,
    mode,
    setModeFilter,
    setSegments,
    setQuery,
    uploads,
    selectedUpload,
    openSeg,
    setCopied,
  } = state;

  const fetchUploads = useCallback(async () => {
    const data = await executeFetch(async () => {
      return await listUploads(1, 100); // Get first 100 uploads (backend max is 1000, but 100 is reasonable)
    });

    if (data) {
      // Handle both old array format and new paginated format
      if (Array.isArray(data)) {
        setUploads(data);
      } else {
        setUploads(data.items || []);
      }
    } else {
      setStatus("Failed to load uploads");
    }
  }, [executeFetch, setUploads, setStatus]);

  const loadSegmentationSummary = useCallback(
    async (docId: number) => {
      try {
        const rows = await listSegmentations(docId);
        setSegSummary(Array.isArray(rows) ? (rows as SegSummaryRow[]) : []);
      } catch {
        setSegSummary([]);
      }
    },
    [setSegSummary]
  );

  const extractCount = useCallback((payload: any): number | null => {
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
  }, []);

  const doUpload = useCallback(async () => {
    if (!file) return;

    setStatus("Uploading...");
    setOpenSeg(null);

    try {
      const data = await uploadWithProgress(file);

      // Reset upload state after a short delay to show completion
      setTimeout(() => {
        resetUpload();
      }, 1000);

      if (data.parseStatus === "failed") {
        setStatus(
          `Uploaded, but parse FAILED (${data.filename}). Reason: ${data.parseError ?? "unknown error"}`
        );
      } else if (data.deduped) {
        setStatus(`File deduped: ${data.filename}. Existing document used.`);
      } else {
        setStatus(`Uploaded: ${data.filename}`);
      }

      const newDocumentId = data.documentId || null;
      setDocumentId(newDocumentId);
      
      // Immediately fetch uploads to update the list
      await fetchUploads();

      // After fetching uploads, check parseStatus and poll if needed
      if (newDocumentId) {
        // Small delay to ensure backend has processed the upload
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Fetch uploads again to get the latest parseStatus
        const latestData = await executeFetch(async () => {
          return await listUploads(1, 100);
        });
        
        if (latestData) {
          const items = Array.isArray(latestData) ? latestData : (latestData.items || []);
          setUploads(items);
          const upload = items.find((u: any) => u.documentId === newDocumentId);
          
          if (upload) {
            if (upload.parseStatus === "ok") {
              setStatus(`Upload complete. Document is ready for segmentation.`);
              // Load segmentation summary for the new document
              const { listSegmentations } = await import("../../lib/api");
              try {
                const rows = await listSegmentations(newDocumentId);
                state.setSegSummary(Array.isArray(rows) ? rows : []);
              } catch {
                // Ignore errors
              }
            } else if (upload.parseStatus === "pending") {
              setStatus(`Upload complete. Parsing in progress... Please wait.`);
              // Poll for parseStatus update (max 30 seconds)
              let pollCount = 0;
              const maxPolls = 30;
              const pollInterval = setInterval(async () => {
                pollCount++;
                const pollData = await executeFetch(async () => {
                  return await listUploads(1, 100);
                });
                if (pollData) {
                  const pollItems = Array.isArray(pollData) ? pollData : (pollData.items || []);
                  const pollUpload = pollItems.find((u: any) => u.documentId === newDocumentId);
                  if (pollUpload) {
                    setUploads(pollItems);
                    if (pollUpload.parseStatus === "ok") {
                      clearInterval(pollInterval);
                      setStatus(`Parsing complete! Document is ready for segmentation.`);
                      // Ensure uploads state is updated
                      setUploads(pollItems);
                      // Load segmentation summary
                      const { listSegmentations } = await import("../../lib/api");
                      try {
                        const rows = await listSegmentations(newDocumentId);
                        state.setSegSummary(Array.isArray(rows) ? rows : []);
                      } catch {
                        // Ignore errors
                      }
                    } else if (pollUpload.parseStatus === "failed") {
                      clearInterval(pollInterval);
                      setStatus(`Parsing failed. Please check the document or re-upload.`);
                    }
                  }
                }
                if (pollCount >= maxPolls) {
                  clearInterval(pollInterval);
                  setStatus(`Parsing is taking longer than expected. Please refresh manually.`);
                }
              }, 1000); // Poll every second
            } else {
              setStatus(
                `Upload complete. Parse status: ${upload.parseStatus}. Parsing failed. Please check the document or re-upload.`
              );
            }
          }
        }
      }
    } catch (e: any) {
      setStatus(e?.message ?? uploadError ?? "Upload failed");
      resetUpload();
    }
  }, [file, uploadWithProgress, resetUpload, uploadError, setStatus, setOpenSeg, setDocumentId, fetchUploads, executeFetch, setUploads, state]);

  const segmentDoc = useCallback(async () => {
    if (!documentId) {
      setStatus("No document selected. Please select a document from the dropdown first.");
      return;
    }

    // Refresh uploads to get latest parseStatus before segmenting
    await fetchUploads();

    // Get the latest upload data
    const latestData = await executeFetch(async () => {
      return await listUploads(1, 100);
    });

    let currentUpload = selectedUpload;
    if (latestData) {
      const items = Array.isArray(latestData) ? latestData : (latestData.items || []);
      currentUpload = items.find((u: any) => u.documentId === documentId) ?? null;
      if (currentUpload && !selectedUpload) {
        // Update uploads if we found the document
        setUploads(items);
      }
    }

    if (!currentUpload) {
      setStatus("Document not found. Please refresh the document list and try again.");
      return;
    }

    if (currentUpload.parseStatus !== "ok") {
      setStatus(
        `Cannot segment: document parseStatus is "${currentUpload.parseStatus}". ${currentUpload.parseStatus === "pending" ? "Please wait for parsing to complete, then try again." : "Parsing failed. Please check the document or re-upload."}`
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
  }, [documentId, fetchUploads, executeFetch, selectedUpload, setUploads, mode, setStatus, setOpenSeg, loadSegmentationSummary, extractCount]);

  const loadSegments = useCallback(async () => {
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
  }, [documentId, mode, setStatus, setOpenSeg, setModeFilter, setSegments]);

  const deleteSelectedUpload = useCallback(async () => {
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
  }, [selectedUpload, setQuery, setModeFilter, fetchUploads, setStatus]);

  const copyOpenSegment = useCallback(
    async (withTitle: boolean) => {
      if (!openSeg) return;
      const text = withTitle ? `${openSeg.title}\n\n${openSeg.content ?? ""}` : openSeg.content ?? "";
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 900);
      } catch {
        setStatus("Copy failed (clipboard blocked by browser).");
      }
    },
    [openSeg, setStatus, setCopied]
  );

  const exportOpenSegmentTxt = useCallback(() => {
    if (!openSeg || !selectedUpload || !documentId) return;

    // Helper function for safe file names
    const safeFileName = (name: string) => {
      return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 120).trim() || "export";
    };

    const docLabel = selectedUpload.filename ? safeFileName(selectedUpload.filename) : `doc_${documentId ?? "unknown"}`;
    const segLabel = safeFileName(`${openSeg.orderIndex + 1}_${openSeg.title || "segment"}`);
    const fileName = `${docLabel}__${segLabel}.txt`;

    const content = `${openSeg.title}\n(mode: ${openSeg.mode}, order: ${openSeg.orderIndex + 1})\n\n${openSeg.content ?? ""}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 300);
  }, [openSeg, selectedUpload, documentId]);

  return {
    fetchUploads,
    loadSegmentationSummary,
    doUpload,
    segmentDoc,
    loadSegments,
    deleteSelectedUpload,
    copyOpenSegment,
    exportOpenSegmentTxt,
    extractCount,
  };
}
