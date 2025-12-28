// src/pages/SegmentDetails.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getSegment } from "../lib/api";

type Segment = {
  id: number;
  documentId?: number;
  orderIndex?: number;
  mode: string;
  title: string;
  content: string;
  start?: number;
  end?: number;
  createdAt?: string | null;
};

export default function SegmentDetails() {
  const { segmentId } = useParams();
  const nav = useNavigate();

  const [seg, setSeg] = useState<Segment | null>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    const id = Number(segmentId);
    if (!id) {
      setErr("Invalid segment id.");
      return;
    }

    (async () => {
      try {
        const data = await getSegment(id);
        setSeg(data);
      } catch (e: any) {
        setErr(e?.message ?? "Failed");
      }
    })();
  }, [segmentId]);

  if (err) {
    return (
      <div style={{ maxWidth: 900, margin: "40px auto", padding: 16, color: "#eaeaea" }}>
        <button onClick={() => nav(-1)} style={{ padding: "8px 10px" }}>
          ← Back
        </button>
        <p style={{ marginTop: 16, opacity: 0.85 }}>Error: {err}</p>
      </div>
    );
  }

  if (!seg) {
    return (
      <div style={{ maxWidth: 900, margin: "40px auto", padding: 16, color: "#eaeaea", opacity: 0.85 }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "40px auto", color: "#eaeaea", padding: "0 16px" }}>
      <button onClick={() => nav(-1)} style={{ padding: "8px 10px" }}>
        ← Back
      </button>

      <h2 style={{ marginTop: 16 }}>{seg.title}</h2>
      <div style={{ opacity: 0.7, fontSize: 12 }}>
        mode: {seg.mode} {typeof seg.orderIndex === "number" ? `— #${seg.orderIndex + 1}` : ""}{" "}
        {seg.documentId ? `— docId: ${seg.documentId}` : ""}
      </div>

      <div style={{ marginTop: 16, border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 14, background: "rgba(255,255,255,0.03)" }}>
        <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.55 }}>{seg.content}</pre>
      </div>
    </div>
  );
}
