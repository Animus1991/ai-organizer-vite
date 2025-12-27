// src/pages/Home.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { authFetch, listSegments, segmentDocument } from "../lib/api";

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

type UploadItem = {
  uploadId: number;
  documentId: number;
  filename: string;
  sizeBytes: number;
  contentType: string;
};

type UploadResponse = {
  uploadId: number;
  documentId: number;
  sourceType: string;
  filename: string;
  deduped?: boolean;
};

export default function Home() {
  const { user, logout } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [mode, setMode] = useState<"qa" | "paragraphs">("qa");

  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [status, setStatus] = useState<string>("");

  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // side panel state
  const [openSeg, setOpenSeg] = useState<SegmentRow | null>(null);
  const [copied, setCopied] = useState(false);

  async function fetchUploads() {
    setLoadingUploads(true);
    try {
      const res = await authFetch("/uploads");
      if (!res.ok) {
        const txt = await res.text();
        setStatus(`Failed to load uploads: ${res.status} ${txt}`);
        return;
      }
      const data = await res.json();
      setUploads(Array.isArray(data) ? data : []);
    } finally {
      setLoadingUploads(false);
    }
  }

  useEffect(() => {
    fetchUploads();
  }, []);

  const selectedUpload = useMemo(() => {
    if (!documentId) return null;
    return uploads.find((u) => u.documentId === documentId) ?? null;
  }, [documentId, uploads]);

  const localDuplicateHint = useMemo(() => {
    if (!file) return null;
    const hit = uploads.find((u) => u.filename === file.name && u.sizeBytes === file.size);
    return hit ?? null;
  }, [file, uploads]);

  async function uploadFile() {
    if (!file) return;

    setStatus("Uploading...");
    const form = new FormData();
    form.append("file", file);

    const res = await authFetch("/upload", {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const txt = await res.text();
      setStatus(`Upload failed: ${res.status} ${txt}`);
      return;
    }

    const data: UploadResponse = await res.json();
    setDocumentId(data.documentId);

    if (data.deduped) {
      setStatus(`Already uploaded (deduped). Using documentId=${data.documentId}`);
    } else {
      setStatus(`Uploaded. documentId=${data.documentId}`);
    }

    await fetchUploads();
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

    setStatus("Segmenting...");
    setOpenSeg(null);

    try {
      const data = await segmentDocument(documentId, mode);
      const count = extractCount(data);
      setStatus(count !== null ? `Segmented: ${count} segments` : `Segment response: ${JSON.stringify(data)}`);
    } catch (e: any) {
      setStatus(e?.message ?? "Segment failed");
    }
  }

  async function loadSegments() {
    if (!documentId) return;

    setStatus("Loading segments...");
    setOpenSeg(null);

    try {
      const items = await listSegments(documentId);
      setSegments(items);
      setStatus(`Loaded ${items.length} segments`);
    } catch (e: any) {
      setStatus(e?.message ?? "List failed");
    }
  }

  async function deleteSelectedUpload() {
    if (!selectedUpload) return;

    const ok = window.confirm(
      `Delete upload "${selectedUpload.filename}" (docId=${selectedUpload.documentId})?\nThis will remove documents + segments + the file from disk.`
    );
    if (!ok) return;

    setDeleting(true);
    setStatus("Deleting upload...");

    try {
      const res = await authFetch(`/uploads/${selectedUpload.uploadId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const txt = await res.text();
        setStatus(`Delete failed: ${res.status} ${txt}`);
        return;
      }

      setStatus(`Deleted uploadId=${selectedUpload.uploadId}`);
      setDocumentId(null);
      setSegments([]);
      setOpenSeg(null);
      await fetchUploads();
    } finally {
      setDeleting(false);
    }
  }

  function preview120(s: string) {
    const oneLine = (s ?? "").replace(/\s+/g, " ").trim();
    return oneLine.length > 120 ? oneLine.slice(0, 120) + "…" : oneLine;
  }

  async function copyOpenSegment() {
    if (!openSeg) return;
    try {
      await navigator.clipboard.writeText(openSeg.content ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      setStatus("Copy failed (clipboard blocked by browser).");
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", color: "#eaeaea", padding: "0 16px" }}>
      <h1>AI Organizer</h1>
      <p>
        Logged in as: <b>{user?.email}</b>
      </p>
      <button onClick={logout}>Logout</button>

      <hr style={{ margin: "24px 0" }} />

      <h2>Pick existing document (no duplicates)</h2>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <select
          value={documentId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setDocumentId(v ? Number(v) : null);
            setSegments([]);
            setOpenSeg(null);
          }}
          style={{ minWidth: 520 }}
        >
          <option value="">-- Select uploaded document --</option>
          {uploads.map((u) => (
            <option key={u.documentId} value={u.documentId}>
              {u.filename} (docId={u.documentId})
            </option>
          ))}
        </select>

        <button onClick={fetchUploads} disabled={loadingUploads}>
          {loadingUploads ? "Refreshing..." : "Refresh list"}
        </button>

        <button
          onClick={deleteSelectedUpload}
          disabled={!selectedUpload || deleting}
          style={{
            marginLeft: 6,
            padding: "8px 12px",
            opacity: !selectedUpload || deleting ? 0.6 : 1,
            cursor: !selectedUpload || deleting ? "not-allowed" : "pointer",
          }}
        >
          {deleting ? "Deleting..." : "Delete selected"}
        </button>
      </div>

      <hr style={{ margin: "24px 0" }} />

      <h2>Upload → Segment → List</h2>

      <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button onClick={uploadFile} disabled={!file} style={{ marginLeft: 10 }}>
        Upload
      </button>

      {localDuplicateHint && (
        <p style={{ marginTop: 10, color: "#ffcc66" }}>
          Hint: This looks already uploaded as <b>docId={localDuplicateHint.documentId}</b>. Select it from the dropdown
          to avoid duplicates.
        </p>
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label>Segmentation mode: </label>
        <select value={mode} onChange={(e) => setMode(e.target.value as any)}>
          <option value="qa">qa</option>
          <option value="paragraphs">paragraphs</option>
        </select>

        <button onClick={segmentDoc} disabled={!documentId} style={{ marginLeft: 10 }}>
          Segment
        </button>

        <button onClick={loadSegments} disabled={!documentId} style={{ marginLeft: 10 }}>
          List Segments
        </button>
      </div>

      <p style={{ marginTop: 12, opacity: 0.85 }}>{status}</p>

      {/* Segments table */}
      <div style={{ marginTop: 18, border: "1px solid #3a3a3a", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid #3a3a3a", display: "flex", justifyContent: "space-between" }}>
          <b>Segments</b>
          <span style={{ opacity: 0.7 }}>{segments.length ? `${segments.length} items` : "—"}</span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", background: "rgba(255,255,255,0.04)" }}>
                <th style={{ padding: 10, width: 90, borderBottom: "1px solid #3a3a3a" }}>#</th>
                <th style={{ padding: 10, width: 180, borderBottom: "1px solid #3a3a3a" }}>Mode</th>
                <th style={{ padding: 10, width: 320, borderBottom: "1px solid #3a3a3a" }}>Title</th>
                <th style={{ padding: 10, borderBottom: "1px solid #3a3a3a" }}>Preview (120 chars)</th>
              </tr>
            </thead>
            <tbody>
              {!segments.length ? (
                <tr>
                  <td colSpan={4} style={{ padding: 14, opacity: 0.7 }}>
                    No segments loaded yet. Click <b>List Segments</b>.
                  </td>
                </tr>
              ) : (
                segments.map((s) => {
                  const isActive = openSeg?.id === s.id;
                  return (
                    <tr
                      key={s.id}
                      onClick={() => setOpenSeg(s)}
                      style={{
                        cursor: "pointer",
                        background: isActive ? "rgba(114,255,191,0.10)" : "transparent",
                      }}
                    >
                      <td style={{ padding: 10, borderBottom: "1px solid #2f2f2f", opacity: 0.9 }}>
                        {s.orderIndex + 1}
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid #2f2f2f", opacity: 0.75 }}>{s.mode}</td>
                      <td style={{ padding: 10, borderBottom: "1px solid #2f2f2f" }}>
                        <b>{s.title}</b>
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid #2f2f2f", opacity: 0.85 }}>
                        {preview120(s.content)}
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
          {/* backdrop */}
          <div
            onClick={() => setOpenSeg(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 50,
            }}
          />

          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              height: "100vh",
              width: "min(560px, 92vw)",
              background: "#111",
              borderLeft: "1px solid #333",
              zIndex: 60,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: 14, borderBottom: "1px solid #333", display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>
                  {openSeg.orderIndex + 1}. {openSeg.title}
                </div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>mode: {openSeg.mode}</div>
              </div>

              <button onClick={copyOpenSegment} style={{ padding: "8px 10px" }}>
                {copied ? "Copied!" : "Copy"}
              </button>
              <button onClick={() => setOpenSeg(null)} style={{ padding: "8px 10px" }}>
                Close
              </button>
            </div>

            <div style={{ padding: 14, overflow: "auto" }}>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5 }}>{openSeg.content}</pre>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
