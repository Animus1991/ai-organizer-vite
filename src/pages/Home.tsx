import React, { useState } from "react";
import { useAuth } from "../auth/AuthProvider";

type SegmentRow = {
  id: number;
  orderIndex: number;
  mode: string;
  title: string;
  content: string;
  createdAt?: string | null;
};

export default function Home() {
  const { user, token, logout } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [mode, setMode] = useState<"qa" | "paragraphs">("qa");
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [status, setStatus] = useState<string>("");

  const API = "http://127.0.0.1:8000/api";

  async function uploadFile() {
    if (!file) return;

    setStatus("Uploading...");
    const form = new FormData();
    form.append("file", file);

    const res = await fetch(`${API}/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form,
    });

    if (!res.ok) {
      const txt = await res.text();
      setStatus(`Upload failed: ${res.status} ${txt}`);
      return;
    }

    const data = await res.json();
    setDocumentId(data.documentId);
    setStatus(`Uploaded. documentId=${data.documentId}`);
  }

  async function segmentDoc() {
    if (!documentId) return;

    setStatus("Segmenting...");
    const url = `${API}/documents/${documentId}/segment?mode=${mode}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      setStatus(`Segment failed: ${res.status} ${txt}`);
      return;
    }

    const data = await res.json();
    setStatus(`Segmented: ${data.count} segments`);
  }

  async function loadSegments() {
    if (!documentId) return;

    setStatus("Loading segments...");
    const res = await fetch(`${API}/documents/${documentId}/segments`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const txt = await res.text();
      setStatus(`List failed: ${res.status} ${txt}`);
      return;
    }

    const data = await res.json();
    setSegments(data);
    setStatus(`Loaded ${data.length} segments`);
  }

  return (
    <div style={{ maxWidth: 900, margin: "40px auto", color: "#eaeaea" }}>
      <h1>AI Organizer</h1>
      <p>Logged in as: <b>{user?.email}</b></p>
      <button onClick={logout}>Logout</button>

      <hr style={{ margin: "24px 0" }} />

      <h2>Upload → Segment → List</h2>

      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <button onClick={uploadFile} disabled={!file}>
        Upload
      </button>

      <div style={{ marginTop: 16 }}>
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

      <div style={{ marginTop: 18 }}>
        {segments.map((s) => (
          <div key={s.id} style={{ border: "1px solid #444", borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <b>{s.orderIndex + 1}. {s.title}</b>
              <span style={{ opacity: 0.7 }}>{s.mode}</span>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", marginTop: 10 }}>{s.content}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
