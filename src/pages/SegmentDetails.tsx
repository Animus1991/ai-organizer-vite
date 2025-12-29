// src/pages/SegmentDetails.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSegment, SegmentDTO, deleteSegment } from "../lib/api";

export default function SegmentDetails() {
  const { segmentId } = useParams();
  const nav = useNavigate();
  const id = Number(segmentId);

  const [seg, setSeg] = useState<SegmentDTO | null>(null);
  const [status, setStatus] = useState("");

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
                id={seg.id} • mode={seg.mode} • order={seg.orderIndex + 1} • {seg.isManual ? "manual" : "auto"}
              </div>
            </div>

            <button onClick={onDelete} style={{ padding: "8px 10px" }}>
              Delete
            </button>
          </div>

          <hr style={{ margin: "14px 0", borderColor: "rgba(255,255,255,0.10)" }} />

          <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.6 }}>{seg.content}</pre>
        </div>
      )}
    </div>
  );
}
