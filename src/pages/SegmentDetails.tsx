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
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #0f0f1a 50%, #0a0a0a 100%)",
        maxWidth: 1000,
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
          padding: "28px 32px",
          marginBottom: "32px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              onClick={() => nav(-1)}
              style={{
                padding: "12px 20px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                color: "#eaeaea",
                fontWeight: 500,
                fontSize: "14px",
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            <div>
              <h2
                style={{
                  fontSize: "28px",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  margin: 0,
                  marginBottom: "6px",
                  letterSpacing: "-0.5px",
                }}
              >
                Segment Details
              </h2>
              <p style={{ margin: 0, fontSize: "15px", color: "rgba(255, 255, 255, 0.6)", fontWeight: 400 }}>View and edit segment information</p>
            </div>
          </div>
        </div>
      </div>

      {status ? (
        <div
          style={{
            background: "rgba(99, 102, 241, 0.1)",
            border: "1px solid rgba(99, 102, 241, 0.2)",
            borderRadius: "12px",
            padding: "14px 18px",
            marginBottom: "24px",
            color: "#c7d2fe",
            fontSize: "14px",
            fontWeight: 500,
          }}
        >
          {status}
        </div>
      ) : null}

      {!seg ? null : (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(15, 15, 25, 0.95) 100%)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "20px",
            padding: "32px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "20px" }}>
            <div style={{ flex: "1 1 400px" }}>
              <h3 style={{ fontSize: "24px", fontWeight: 700, color: "#eaeaea", marginBottom: "16px", lineHeight: "1.3" }}>{seg.title}</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <span
                  style={{
                    padding: "6px 12px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "rgba(255, 255, 255, 0.8)",
                  }}
                >
                  id: {seg.id}
                </span>
                <span
                  style={{
                    padding: "6px 12px",
                    background: seg.mode === "qa" ? "rgba(59, 130, 246, 0.2)" : "rgba(16, 185, 129, 0.2)",
                    border: seg.mode === "qa" ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(16, 185, 129, 0.3)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: seg.mode === "qa" ? "#93c5fd" : "#6ee7b7",
                  }}
                >
                  mode: {seg.mode}
                </span>
                <span
                  style={{
                    padding: "6px 12px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "rgba(255, 255, 255, 0.8)",
                  }}
                >
                  order: {seg.orderIndex + 1}
                </span>
                <span
                  style={{
                    padding: "6px 12px",
                    background: seg.isManual ? "rgba(59, 130, 246, 0.2)" : "rgba(107, 114, 128, 0.2)",
                    border: seg.isManual ? "1px solid rgba(59, 130, 246, 0.3)" : "1px solid rgba(107, 114, 128, 0.3)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: seg.isManual ? "#93c5fd" : "#9ca3af",
                  }}
                >
                  {seg.isManual ? "manual" : "auto"}
                </span>
                <span
                  style={{
                    padding: "6px 12px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "rgba(255, 255, 255, 0.8)",
                  }}
                >
                  start: {seg.start}
                </span>
                <span
                  style={{
                    padding: "6px 12px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "rgba(255, 255, 255, 0.8)",
                  }}
                >
                  end: {seg.end}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {seg.isManual ? (
                <button
                  onClick={openEdit}
                  style={{
                    padding: "12px 20px",
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    border: "none",
                    borderRadius: "12px",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s ease",
                    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(99, 102, 241, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.3)";
                  }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              ) : null}
              <button
                onClick={onDelete}
                style={{
                  padding: "12px 20px",
                  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  border: "none",
                  borderRadius: "12px",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(239, 68, 68, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.3)";
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>

          <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "24px" }}>
            <h4 style={{ fontSize: "18px", fontWeight: 700, color: "#eaeaea", marginBottom: "16px" }}>Content</h4>
            <div
              style={{
                whiteSpace: "pre-wrap",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                padding: "24px",
                lineHeight: "1.8",
                fontSize: "14px",
                color: "#eaeaea",
                fontFamily: "inherit",
                margin: 0,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2) inset",
              }}
            >
              {seg.content}
            </div>
          </div>
        </div>
      )}

      {editOpen && seg ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(8px)",
            display: "grid",
            placeItems: "center",
            padding: "16px",
            zIndex: 1000,
          }}
          onClick={() => setEditOpen(false)}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              background: "linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(15, 15, 25, 0.98) 100%)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "20px",
              padding: "32px",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
              <h3 style={{ fontSize: "24px", fontWeight: 700, color: "#eaeaea", margin: 0 }}>Edit Manual Segment</h3>
              <button
                onClick={() => setEditOpen(false)}
                style={{
                  padding: "10px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "10px",
                  color: "#eaeaea",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {err ? (
              <div
                style={{
                  marginBottom: "20px",
                  padding: "14px 18px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "12px",
                  color: "#fca5a5",
                  fontSize: "14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {err}
                </div>
              </div>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "rgba(255, 255, 255, 0.7)", marginBottom: "8px" }}>
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "14px 18px",
                    background: "rgba(0, 0, 0, 0.3)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    color: "#eaeaea",
                    fontSize: "14px",
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
                  placeholder="Enter segment title"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "rgba(255, 255, 255, 0.7)", marginBottom: "8px" }}>
                    Start
                  </label>
                  <input
                    type="number"
                    value={start}
                    onChange={(e) => setStart(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                      color: "#eaeaea",
                      fontSize: "14px",
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
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "rgba(255, 255, 255, 0.7)", marginBottom: "8px" }}>
                    End
                  </label>
                  <input
                    type="number"
                    value={end}
                    onChange={(e) => setEnd(Number(e.target.value))}
                    style={{
                      width: "100%",
                      padding: "14px 18px",
                      background: "rgba(0, 0, 0, 0.3)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                      color: "#eaeaea",
                      fontSize: "14px",
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
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", paddingTop: "20px", borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                <button
                  onClick={() => setEditOpen(false)}
                  disabled={saving}
                  style={{
                    padding: "12px 24px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    color: "#eaeaea",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: saving ? "not-allowed" : "pointer",
                    transition: "all 0.2s ease",
                    opacity: saving ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!saving) {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  style={{
                    padding: "12px 24px",
                    background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                    border: "none",
                    borderRadius: "12px",
                    color: "white",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: saving ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s ease",
                    boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                    opacity: saving ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!saving) {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 6px 16px rgba(99, 102, 241, 0.4)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.3)";
                  }}
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
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
