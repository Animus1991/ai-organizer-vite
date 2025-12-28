// src/pages/DocumentWorkspace.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  deleteSegments,
  getDocument,
  listSegmentations,
  listSegments,
  segmentDocument,
  SegmentDTO,
  SegmentationSummary,
} from "../lib/api";

function fmt(dt?: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  return isNaN(d.getTime()) ? dt : d.toLocaleString();
}

function preview120(s: string) {
  const oneLine = (s ?? "").replace(/\s+/g, " ").trim();
  return oneLine.length > 120 ? oneLine.slice(0, 120) + "…" : oneLine;
}

export default function DocumentWorkspace() {
  const nav = useNavigate();
  const { documentId } = useParams();
  const docId = Number(documentId);
  const location = useLocation() as any;

  const [status, setStatus] = useState<string>("");
  const [docText, setDocText] = useState<string>("");
  const [filename, setFilename] = useState<string | null>(location?.state?.filename ?? null);

  const [summary, setSummary] = useState<SegmentationSummary[]>([]);
  const [mode, setMode] = useState<"qa" | "paragraphs">("qa");
  const [segments, setSegments] = useState<SegmentDTO[]>([]);
  const [query, setQuery] = useState("");

  // ✅ 1-click selection (for highlight)
  const [selectedSegId, setSelectedSegId] = useState<number | null>(null);

  // ✅ 2-click open viewer (full chunk view)
  const [openSeg, setOpenSeg] = useState<SegmentDTO | null>(null);

  const highlightRef = useRef<HTMLSpanElement | null>(null);

  async function loadDocument() {
    setStatus("Loading document...");
    try {
      const d = await getDocument(docId);
      setDocText(d.text ?? "");
      if (!filename && d.filename) setFilename(d.filename);
      setStatus("");
    } catch (e: any) {
      setStatus(`Failed to load document: ${e?.message ?? String(e)}`);
    }
  }

  async function loadSummary() {
    try {
      const rows = await listSegmentations(docId);
      setSummary(Array.isArray(rows) ? rows : []);
    } catch {
      setSummary([]);
    }
  }

  async function loadSegs(m?: "qa" | "paragraphs") {
    const useMode = m ?? mode;
    setStatus("Loading segments...");
    try {
      const items = await listSegments(docId, useMode);
      setSegments(Array.isArray(items) ? items : []);
      setSelectedSegId(null);
      setOpenSeg(null);
      setStatus(`Loaded ${items.length} segments (${useMode})`);
    } catch (e: any) {
      setStatus(e?.message ?? "List failed");
    }
  }

  async function runSegmentation() {
    setStatus("Segmenting...");
    try {
      await segmentDocument(docId, mode);
      await loadSummary();
      await loadSegs(mode);
      setStatus(`Segmented (${mode})`);
    } catch (e: any) {
      setStatus(e?.message ?? "Segment failed");
    }
  }

  async function deleteModeSegments() {
    const ok = window.confirm(`Delete segments for mode "${mode}"?`);
    if (!ok) return;

    setStatus("Deleting segments...");
    try {
      await deleteSegments(docId, mode);
      await loadSummary();
      setSegments([]);
      setSelectedSegId(null);
      setOpenSeg(null);
      setStatus(`Deleted segments (${mode}).`);
    } catch (e: any) {
      setStatus(e?.message ?? "Delete failed");
    }
  }

  useEffect(() => {
    if (!Number.isFinite(docId)) return;
    loadDocument();
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const summaryByMode = useMemo(() => {
    const map: Record<string, SegmentationSummary> = {};
    for (const r of summary) map[r.mode] = r;
    return map;
  }, [summary]);

  const filteredSegments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((s) => {
      const hay = `${s.title ?? ""} ${s.content ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [segments, query]);

  const selectedSeg = useMemo(() => {
    if (!selectedSegId) return null;
    return segments.find((s) => s.id === selectedSegId) ?? null;
  }, [selectedSegId, segments]);

  // ✅ highlight render based on start/end (fast, no DOM selection API needed)
  const highlightedDoc = useMemo(() => {
    if (!docText) return { before: "", mid: "", after: "" };

    const s = selectedSeg;
    const start = typeof s?.start === "number" ? s!.start! : null;
    const end = typeof s?.end === "number" ? s?.end! : null;

    if (start === null || end === null || start < 0 || end <= start || end > docText.length) {
      return { before: docText, mid: "", after: "" };
    }

    return {
      before: docText.slice(0, start),
      mid: docText.slice(start, end),
      after: docText.slice(end),
    };
  }, [docText, selectedSeg]);

  // ✅ scroll highlight into view when selection changes
  useEffect(() => {
    if (!highlightRef.current) return;
    highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedSegId]);

  function handleSelect(seg: SegmentDTO) {
    setSelectedSegId(seg.id);
    // δεν ανοίγει viewer εδώ (single click)
  }

  function handleOpen(seg: SegmentDTO) {
    setSelectedSegId(seg.id);
    setOpenSeg(seg);
  }

  return (
    <div style={{ height: "100vh", background: "#0b0e14", color: "#eaeaea" }}>
      {/* Top bar */}
      <div style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,0.10)", display: "flex", alignItems: "center", gap: 12 }}>
        <b style={{ fontSize: 16 }}>Document #{docId}</b>
        <span style={{ opacity: 0.7 }}>{filename ?? "—"}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => nav("/")} style={{ padding: "8px 10px" }}>
          Back to Home
        </button>
      </div>

      {/* 50/50 split */}
      <div style={{ display: "flex", height: "calc(100vh - 56px)" }}>
        {/* Left: full document */}
        <div
          style={{
            flex: "1 1 50%",
            minWidth: 0,
            borderRight: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 700 }}>
            Full document
            {selectedSeg ? (
              <span style={{ marginLeft: 10, fontWeight: 400, opacity: 0.7, fontSize: 12 }}>
                — selected: #{(selectedSeg.orderIndex ?? 0) + 1} ({selectedSeg.mode})
              </span>
            ) : null}
          </div>

          <div style={{ padding: 12, overflow: "auto" }}>
            {docText ? (
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.55 }}>
                {highlightedDoc.before}
                {highlightedDoc.mid ? (
                  <span
                    ref={highlightRef}
                    style={{
                      background: "rgba(114,255,191,0.18)",
                      outline: "1px solid rgba(114,255,191,0.45)",
                      borderRadius: 6,
                      padding: "1px 2px",
                    }}
                  >
                    {highlightedDoc.mid}
                  </span>
                ) : null}
                {highlightedDoc.after}
              </pre>
            ) : (
              <div style={{ opacity: 0.7 }}>—</div>
            )}
          </div>
        </div>

        {/* Right: workspace */}
        <div style={{ flex: "1 1 50%", minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <b>Workspace</b>
              <div style={{ flex: 1 }} />
              <span style={{ opacity: 0.75, fontSize: 12 }}>{status}</span>
            </div>

            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ opacity: 0.85 }}>Mode:</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as any)} style={{ padding: "8px 10px" }}>
                <option value="qa">qa</option>
                <option value="paragraphs">paragraphs</option>
              </select>

              <button onClick={() => loadSegs()} style={{ padding: "8px 10px" }}>
                List segments
              </button>

              <button onClick={runSegmentation} style={{ padding: "8px 10px" }}>
                Segment now
              </button>

              <button onClick={deleteModeSegments} style={{ padding: "8px 10px" }}>
                Delete mode segments
              </button>
            </div>

            {/* Summary */}
            <div
              style={{
                marginTop: 12,
                padding: 10,
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b style={{ fontSize: 13 }}>Segmentation summary</b>
                <button onClick={loadSummary} style={{ padding: "6px 10px" }}>
                  Refresh
                </button>
              </div>

              <div style={{ marginTop: 8, display: "grid", gap: 6, fontSize: 13 }}>
                {(["qa", "paragraphs"] as const).map((m) => {
                  const row = summaryByMode[m];
                  return (
                    <div key={m} style={{ opacity: 0.9 }}>
                      <span style={{ fontWeight: 700 }}>{m}</span>{" "}
                      <span style={{ opacity: 0.8 }}>({row?.count ?? 0})</span>
                      <span style={{ opacity: 0.7 }}> — last: {fmt(row?.lastSegmentedAt ?? null)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Search */}
            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chunks..."
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "#0f1420",
                  color: "#eaeaea",
                }}
              />
              <button onClick={() => setQuery("")} disabled={!query} style={{ padding: "8px 10px", opacity: query ? 1 : 0.6 }}>
                Clear
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
            {/* List OR Viewer (toggle) */}
            {!openSeg ? (
              <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
                <div style={{ padding: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                  <span>Chunks</span>
                  <span style={{ opacity: 0.7, fontWeight: 400 }}>
                    {segments.length ? `${filteredSegments.length}/${segments.length}` : "—"}
                  </span>
                </div>

                {!segments.length ? (
                  <div style={{ padding: 12, opacity: 0.7 }}>No chunks loaded. Click “List segments”.</div>
                ) : !filteredSegments.length ? (
                  <div style={{ padding: 12, opacity: 0.7 }}>No results.</div>
                ) : (
                  <div style={{ padding: 8, display: "grid", gap: 8 }}>
                    {filteredSegments.map((s) => {
                      const active = selectedSegId === s.id;
                      return (
                        <div
                          key={s.id}
                          onClick={() => handleSelect(s)}          // ✅ single click select
                          onDoubleClick={() => handleOpen(s)}     // ✅ double click open
                          title="Click to select & highlight. Double-click to open."
                          style={{
                            cursor: "pointer",
                            padding: 10,
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.10)",
                            background: active ? "rgba(114,255,191,0.10)" : "rgba(255,255,255,0.03)",
                            userSelect: "none",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                            <b style={{ fontSize: 13 }}>
                              {s.orderIndex + 1}. {s.title}
                            </b>
                            <span style={{ fontSize: 12, opacity: 0.7 }}>{s.mode}</span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{preview120(s.content)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    padding: 12,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <b style={{ flex: 1 }}>
                    {openSeg.orderIndex + 1}. {openSeg.title}
                  </b>
                  <button
                    onClick={() => setOpenSeg(null)} // ✅ close viewer -> back to list
                    style={{ padding: "8px 10px" }}
                  >
                    Close
                  </button>
                </div>

                <div style={{ padding: 12, overflow: "auto" }}>
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.55 }}>{openSeg.content}</pre>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12, opacity: 0.7 }}>
            Tip: Click = highlight in document. Double-click = open chunk viewer.
          </div>
        </div>
      </div>
    </div>
  );
}
