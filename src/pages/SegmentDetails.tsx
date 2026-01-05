// C:\Users\anast\PycharmProjects\AI_ORGANIZER_VITE\src\pages\SegmentDetails.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSegment, SegmentDTO, deleteSegment, patchManualSegment } from "../lib/api";

export default function SegmentDetails() {
  const { segmentId } = useParams();
  const nav = useNavigate();
  const id = Number(segmentId);

  const [seg, setSeg] = useState<SegmentDTO | null>(null);
  const [status, setStatus] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [start, setStart] = useState<number>(0);
  const [end, setEnd] = useState<number>(0);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setStatus("Invalid segment id.");
      return;
    }

    setStatus("Loading...");
    getSegment(id)
      .then((s) => {
        setSeg(s);
        setStatus("");
      })
      .catch((e: any) => setStatus(e?.message ?? "Failed to load segment"));
  }, [id]);

  async function onDelete() {
    if (!seg) return;
    const ok = window.confirm(`Delete segment "${seg.title}"?`);
    if (!ok) return;

    setStatus("Deleting...");
    try {
      await deleteSegment(seg.id);
      nav(-1);
    } catch (e: any) {
      setStatus(e?.message ?? "Delete failed");
    }
  }

  function openEdit() {
    if (!seg?.isManual) return;
    setErr(null);
    setTitle(seg.title ?? "");
    setStart(typeof seg.start === "number" ? seg.start : 0);
    setEnd(typeof seg.end === "number" ? seg.end : 0);
    setSaving(false);
    setEditOpen(true);
  }

  async function saveEdit() {
    if (!seg) return;
    setSaving(true);
    setErr(null);

    if (!title.trim()) {
      setErr("Title cannot be empty.");
      setSaving(false);
      return;
    }
    if (end <= start) {
      setErr("End must be > Start.");
      setSaving(false);
      return;
    }

    try {
      const updated = await patchManualSegment(seg.id, { title: title.trim(), start, end });
      setSeg({ ...seg, ...updated });
      setEditOpen(false);
      setStatus("Updated.");
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background" style={{ maxWidth: 920, margin: "40px auto", color: "#eaeaea", padding: "0 16px" }}>
      {/* Header */}
      <div className="bg-surface border border-border rounded-xl shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => nav(-1)} className="btn-secondary px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            <div>
              <h2 className="text-2xl font-bold text-primary">Segment Details</h2>
              <p className="text-secondary">View and edit segment information</p>
            </div>
          </div>
        </div>
      </div>

      {status ? (
        <div className="bg-surface border border-border rounded-lg p-4 mb-6">
          <p className="text-secondary">{status}</p>
        </div>
      ) : null}

      {!seg ? null : (
        <div className="bg-surface border border-border rounded-xl shadow-lg p-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-primary mb-2">{seg.title}</h3>
              <div className="flex flex-wrap gap-2 text-sm text-secondary">
                <span className="px-2 py-1 bg-surface-elevated rounded border">id: {seg.id}</span>
                <span className="px-2 py-1 bg-surface-elevated rounded border">mode: {seg.mode}</span>
                <span className="px-2 py-1 bg-surface-elevated rounded border">order: {seg.orderIndex + 1}</span>
                <span className={`px-2 py-1 rounded border ${seg.isManual ? "bg-blue-900/20 text-blue-400 border-blue-800" : "bg-gray-900/20 text-gray-400 border-gray-800"}`}>
                  {seg.isManual ? "manual" : "auto"}
                </span>
                <span className="px-2 py-1 bg-surface-elevated rounded border">start: {seg.start}</span>
                <span className="px-2 py-1 bg-surface-elevated rounded border">end: {seg.end}</span>
              </div>
            </div>

            <div className="flex gap-2">
              {seg.isManual ? (
                <button onClick={openEdit} className="btn-primary px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              ) : null}
              <button onClick={onDelete} className="btn-danger px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <h4 className="text-lg font-semibold text-primary mb-4">Content</h4>
            <pre className="whitespace-pre-wrap bg-surface-elevated border border-border rounded-lg p-4 leading-relaxed text-sm" style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>
              {seg.content}
            </pre>
          </div>
        </div>
      )}

      {editOpen && seg ? (
        <div
          className="modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(4px)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 1000,
          }}
          onClick={() => setEditOpen(false)}
        >
          <div
            className="modal-content bg-surface border border-border rounded-xl shadow-xl"
            style={{
              width: "min(720px, 100%)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: 14,
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-primary">Edit Manual Segment</h3>
              <button onClick={() => setEditOpen(false)} className="btn-secondary p-2 bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {err ? (
              <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {err}
                </div>
              </div>
            ) : null}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Title</label>
                <input 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                  style={{ padding: "10px 12px" }}
                  placeholder="Enter segment title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">Start</label>
                  <input 
                    type="number" 
                    value={start} 
                    onChange={(e) => setStart(Number(e.target.value))} 
                    className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    style={{ padding: "10px 12px" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">End</label>
                  <input 
                    type="number" 
                    value={end} 
                    onChange={(e) => setEnd(Number(e.target.value))} 
                    className="w-full px-4 py-3 bg-surface-elevated border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    style={{ padding: "10px 12px" }}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button 
                  onClick={() => setEditOpen(false)} 
                  disabled={saving} 
                  className="btn-secondary px-6 py-2 bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors"
                  style={{ padding: "10px 12px" }}
                >
                  Cancel
                </button>
                <button 
                  onClick={saveEdit} 
                  disabled={saving} 
                  className="btn-primary px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  style={{ padding: "10px 12px" }}
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
