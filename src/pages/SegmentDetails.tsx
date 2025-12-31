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
    <div style={{ maxWidth: 920, margin: "40px auto", color: "#eaeaea", padding: "0 16px" }}>
      <button onClick={() => nav(-1)} style={{ padding: "8px 10px" }}>
        Back
      </button>

      <h2 style={{ marginTop: 18 }}>Segment details</h2>
      {status ? <p style={{ opacity: 0.8 }}>{status}</p> : null}

      {!seg ? null : (
        <div style={{ marginTop: 14, border: "1px solid #333", borderRadius: 12, padding: 14, background: "rgba(255,255,255,0.03)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 800 }}>{seg.title}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>
                id={seg.id} • mode={seg.mode} • order={seg.orderIndex + 1} • {seg.isManual ? "manual" : "auto"} • start={seg.start} end={seg.end}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {seg.isManual ? (
                <button onClick={openEdit} style={{ padding: "8px 10px" }}>
                  Edit
                </button>
              ) : null}
              <button onClick={onDelete} style={{ padding: "8px 10px" }}>
                Delete
              </button>
            </div>
          </div>

          <hr style={{ margin: "14px 0", borderColor: "rgba(255,255,255,0.10)" }} />

          <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>{seg.content}</pre>
        </div>
      )}

      {editOpen && seg ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
          onClick={() => setEditOpen(false)}
        >
          <div
            style={{
              width: "min(720px, 100%)",
              background: "#0b0e14",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
              padding: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <b style={{ flex: 1 }}>Edit manual segment</b>
              <button onClick={() => setEditOpen(false)} style={{ padding: "8px 10px" }}>Close</button>
            </div>

            {err ? <div style={{ marginTop: 10, color: "#ffb3b3" }}>{err}</div> : null}

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={{ opacity: 0.85 }}>Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: "10px 12px" }} />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ opacity: 0.85 }}>Start</span>
                  <input type="number" value={start} onChange={(e) => setStart(Number(e.target.value))} style={{ padding: "10px 12px" }} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ opacity: 0.85 }}>End</span>
                  <input type="number" value={end} onChange={(e) => setEnd(Number(e.target.value))} style={{ padding: "10px 12px" }} />
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={() => setEditOpen(false)} disabled={saving} style={{ padding: "10px 12px" }}>
                  Cancel
                </button>
                <button onClick={saveEdit} disabled={saving} style={{ padding: "10px 12px" }}>
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
