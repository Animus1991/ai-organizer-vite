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
  createManualSegment,
  deleteSegment,
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

type SourceFilter = "all" | "auto" | "manual";
type SelInfo = { start: number; end: number; text: string };

function badge(parseStatus?: string) {
  if (parseStatus === "ok") return "✅ ok";
  if (parseStatus === "failed") return "⛔ failed";
  if (parseStatus === "pending") return "⏳ pending";
  return parseStatus ? `• ${parseStatus}` : "—";
}

export default function DocumentWorkspace() {
  const nav = useNavigate();
  const { documentId } = useParams();
  const docId = Number(documentId);
  const location = useLocation() as any;

  const [status, setStatus] = useState<string>("");
  const [docText, setDocText] = useState<string>("");
  const [filename, setFilename] = useState<string | null>(location?.state?.filename ?? null);

  // ✅ ingest fields
  const [parseStatus, setParseStatus] = useState<string>("pending");
  const [parseError, setParseError] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<string | null>(null);

  const [summary, setSummary] = useState<SegmentationSummary[]>([]);
  const [mode, setMode] = useState<"qa" | "paragraphs">("qa");
  const [segments, setSegments] = useState<SegmentDTO[]>([]);
  const [query, setQuery] = useState("");

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  // selection / viewer
  const [selectedSegId, setSelectedSegId] = useState<number | null>(null);
  const [openSeg, setOpenSeg] = useState<SegmentDTO | null>(null);
  const highlightRef = useRef<HTMLSpanElement | null>(null);

  // list scroll memory
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef<number>(0);
  const clickTimerRef = useRef<number | null>(null);

  // manual modal
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const manualPreRef = useRef<HTMLPreElement | null>(null);
  const [manualSel, setManualSel] = useState<SelInfo | null>(null);
  const [manualStatus, setManualStatus] = useState<string>("");

  // manual modal viewer
  const [manualOpenSeg, setManualOpenSeg] = useState<SegmentDTO | null>(null);
  const manualListScrollRef = useRef<HTMLDivElement | null>(null);
  const manualLastScrollTopRef = useRef<number>(0);
  const manualClickTimerRef = useRef<number | null>(null);

  const canSegment = parseStatus === "ok";

  async function loadDocument() {
    setStatus("Loading document...");
    try {
      const d = await getDocument(docId);
      setDocText(d.text ?? "");
      if (!filename && d.filename) setFilename(d.filename);

      setParseStatus(d.parse_status ?? "pending");
      setParseError((d.parse_error as any) ?? null);
      setSourceType((d.source_type as any) ?? null);

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
    if (!canSegment) {
      setStatus(`Cannot segment: parseStatus="${parseStatus}". Fix upload/parse first.`);
      return;
    }

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
    const ok = window.confirm(`Delete AUTO segments for mode "${mode}"? (Manual chunks will stay)`);
    if (!ok) return;

    setStatus("Deleting segments...");
    try {
      await deleteSegments(docId, mode);
      await loadSummary();
      await loadSegs(mode);
      setSelectedSegId(null);
      setOpenSeg(null);
      setStatus(`Deleted auto segments (${mode}).`);
    } catch (e: any) {
      setStatus(e?.message ?? "Delete failed");
    }
  }

  async function handleDeleteSingle(seg: SegmentDTO) {
    const ok = window.confirm(`Delete chunk: "${seg.title}"?`);
    if (!ok) return;

    setStatus("Deleting chunk...");
    try {
      await deleteSegment(seg.id);
      setSegments((prev) => prev.filter((x) => x.id !== seg.id));
      if (selectedSegId === seg.id) setSelectedSegId(null);
      if (openSeg?.id === seg.id) setOpenSeg(null);
      setStatus("Chunk deleted.");
      await loadSummary();
    } catch (e: any) {
      setStatus(e?.message ?? "Delete failed");
    }
  }

  useEffect(() => {
    if (!Number.isFinite(docId)) return;
    loadDocument();
    loadSummary();

    return () => {
      if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
      if (manualClickTimerRef.current) window.clearTimeout(manualClickTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  const summaryByMode = useMemo(() => {
    const map: Record<string, SegmentationSummary> = {};
    for (const r of summary) map[r.mode] = r;
    return map;
  }, [summary]);

  const visibleBySource = useMemo(() => {
    if (sourceFilter === "all") return segments;
    if (sourceFilter === "manual") return segments.filter((s) => !!s.isManual);
    return segments.filter((s) => !s.isManual);
  }, [segments, sourceFilter]);

  const filteredSegments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleBySource;
    return visibleBySource.filter((s) => {
      const hay = `${s.title ?? ""} ${s.content ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [visibleBySource, query]);

  const selectedSeg = useMemo(() => {
    if (!selectedSegId) return null;
    return segments.find((s) => s.id === selectedSegId) ?? null;
  }, [selectedSegId, segments]);

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

  useEffect(() => {
    if (!highlightRef.current) return;
    highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [selectedSegId]);

  useEffect(() => {
    if (openSeg) return;
    if (listScrollRef.current) {
      listScrollRef.current.scrollTop = lastScrollTopRef.current;
    }
  }, [openSeg]);

  function handleSelect(seg: SegmentDTO) {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    clickTimerRef.current = window.setTimeout(() => {
      setSelectedSegId(seg.id);
    }, 170);
  }

  function handleOpen(seg: SegmentDTO) {
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current);
    setSelectedSegId(seg.id);

    if (listScrollRef.current) {
      lastScrollTopRef.current = listScrollRef.current.scrollTop;
    }
    setOpenSeg(seg);
  }

  // ---- Manual modal selection capture ----
  function computeSelectionFromPre(): SelInfo | null {
    const pre = manualPreRef.current;
    if (!pre) return null;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    const range = sel.getRangeAt(0);
    if (!pre.contains(range.startContainer) || !pre.contains(range.endContainer)) return null;

    const r1 = document.createRange();
    r1.setStart(pre, 0);
    r1.setEnd(range.startContainer, range.startOffset);
    let a = r1.toString().length;

    const r2 = document.createRange();
    r2.setStart(pre, 0);
    r2.setEnd(range.endContainer, range.endOffset);
    let b = r2.toString().length;

    const start = Math.min(a, b);
    const end = Math.max(a, b);
    if (end <= start) return null;

    const text = docText.slice(start, end);
    return { start, end, text };
  }

  function captureManualSelection() {
    const info = computeSelectionFromPre();
    setManualSel(info);
    setManualStatus(info ? `Selected ${info.end - info.start} chars.` : "No selection.");
  }

  async function saveManualChunk() {
    if (!manualSel) {
      setManualStatus("Pick some text (drag) first.");
      return;
    }

    try {
      setManualStatus("Saving...");
      const created = await createManualSegment(docId, {
        mode,
        title: manualTitle.trim() ? manualTitle.trim() : null,
        start: manualSel.start,
        end: manualSel.end,
      });

      await loadSummary();
      await loadSegs(mode);

      setSelectedSegId(created.id);
      setManualStatus(`Saved: ${created.title}`);
      setManualTitle("");
      setManualSel(null);
      setManualOpenSeg(null);
    } catch (e: any) {
      setManualStatus(e?.message ?? "Manual save failed");
    }
  }

  const manualSegments = useMemo(() => {
    return segments.filter((s) => !!s.isManual && s.mode === mode);
  }, [segments, mode]);

  useEffect(() => {
    if (manualOpenSeg) return;
    if (manualListScrollRef.current) {
      manualListScrollRef.current.scrollTop = manualLastScrollTopRef.current;
    }
  }, [manualOpenSeg]);

  function manualHandleSelect(seg: SegmentDTO) {
    if (manualClickTimerRef.current) window.clearTimeout(manualClickTimerRef.current);
    manualClickTimerRef.current = window.setTimeout(() => {
      setSelectedSegId(seg.id);
      setManualStatus(`Selected saved chunk: ${seg.title}`);
    }, 170);
  }

  function manualHandleOpen(seg: SegmentDTO) {
    if (manualClickTimerRef.current) window.clearTimeout(manualClickTimerRef.current);
    setSelectedSegId(seg.id);
    if (manualListScrollRef.current) {
      manualLastScrollTopRef.current = manualListScrollRef.current.scrollTop;
    }
    setManualOpenSeg(seg);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#0b0e14",
        color: "#eaeaea",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: 14,
          borderBottom: "1px solid rgba(255,255,255,0.10)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <b style={{ fontSize: 16 }}>Document #{docId}</b>
        <span style={{ opacity: 0.7 }}>{filename ?? "—"}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => nav("/")} style={{ padding: "8px 10px" }}>
          Back to Home
        </button>
      </div>

      {/* Ingest banner */}
      <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <b>Ingest:</b> {badge(parseStatus)}
            {sourceType ? <span style={{ marginLeft: 10, opacity: 0.75 }}>source: {sourceType}</span> : null}
          </div>
          <div style={{ flex: 1 }} />
          {!canSegment ? (
            <span style={{ color: "#ffb3b3", opacity: 0.95 }}>
              Segmentation disabled until parseStatus=ok.
            </span>
          ) : (
            <span style={{ color: "#bfffdc", opacity: 0.95 }}>Ready for segmentation.</span>
          )}
        </div>
        {parseStatus === "failed" && parseError ? (
          <div style={{ marginTop: 8, color: "#ffb3b3", whiteSpace: "pre-wrap" }}>
            <b>Parse error:</b> {parseError}
          </div>
        ) : null}
      </div>

      {/* 50/50 split */}
      <div style={{ display: "flex", height: "calc(100vh - 56px - 60px)" }}>
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
                — selected: #{(selectedSeg.orderIndex ?? 0) + 1} ({selectedSeg.mode}){" "}
                {selectedSeg.isManual ? "• manual" : "• auto"}
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

              <button
                onClick={runSegmentation}
                disabled={!canSegment}
                style={{ padding: "8px 10px", opacity: canSegment ? 1 : 0.6 }}
                title={!canSegment ? "parseStatus must be ok." : ""}
              >
                Segment now
              </button>

              <button onClick={deleteModeSegments} style={{ padding: "8px 10px" }}>
                Delete mode segments
              </button>

              <button
                onClick={() => {
                  setManualOpen(true);
                  setManualStatus("Select text (drag) on the left, then Save.");
                  setManualSel(null);
                  setManualTitle("");
                  setManualOpenSeg(null);
                }}
                style={{ padding: "8px 10px" }}
              >
                Manual chunk
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

            {/* Search + Source filter */}
            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center" }}>
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)} style={{ padding: "8px 10px" }}>
                <option value="all">All chunks</option>
                <option value="auto">Auto only</option>
                <option value="manual">Manual only</option>
              </select>

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
            {!openSeg ? (
              <div ref={listScrollRef} style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
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
                          onClick={() => handleSelect(s)}
                          onDoubleClick={() => handleOpen(s)}
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
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                            <b style={{ fontSize: 13 }}>
                              {s.orderIndex + 1}. {s.title}
                              <span style={{ marginLeft: 8, fontSize: 11, opacity: 0.7 }}>
                                {s.isManual ? "manual" : "auto"}
                              </span>
                            </b>

                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <span style={{ fontSize: 12, opacity: 0.7 }}>{s.mode}</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteSingle(s);
                                }}
                                style={{ padding: "4px 10px" }}
                              >
                                Delete
                              </button>
                            </div>
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
                    {openSeg.orderIndex + 1}. {openSeg.title}{" "}
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{openSeg.isManual ? "• manual" : "• auto"}</span>
                  </b>
                  <button onClick={() => setOpenSeg(null)} style={{ padding: "8px 10px" }}>
                    Back to list
                  </button>
                </div>

                <div style={{ padding: 12, overflow: "auto" }}>
                  <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.55 }}>{openSeg.content}</pre>
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12, opacity: 0.7 }}>
            Tip: Click = highlight. Double-click = open. Filter = All/Auto/Manual.
          </div>
        </div>
      </div>

      {/* Manual modal */}
      {manualOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            padding: 18,
            zIndex: 50,
          }}
        >
          <div
            style={{
              flex: 1,
              background: "#0b0e14",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 14,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: 12,
                borderBottom: "1px solid rgba(255,255,255,0.10)",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <b style={{ flex: 1 }}>Create manual chunk</b>
              <span style={{ fontSize: 12, opacity: 0.7 }}>{manualStatus}</span>
              <button onClick={() => setManualOpen(false)} style={{ padding: "8px 10px" }}>
                Close
              </button>
            </div>

            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
              <div
                style={{
                  flex: "1 1 50%",
                  minWidth: 0,
                  borderRight: "1px solid rgba(255,255,255,0.10)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ padding: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", fontWeight: 700 }}>
                  Select text below (drag). Then Save.
                </div>

                <div style={{ padding: 12, overflow: "auto" }}>
                  <pre
                    ref={manualPreRef}
                    onMouseUp={captureManualSelection}
                    onKeyUp={captureManualSelection}
                    style={{
                      whiteSpace: "pre-wrap",
                      margin: 0,
                      lineHeight: 1.6,
                      userSelect: "text",
                      cursor: "text",
                    }}
                  >
                    {docText}
                  </pre>
                </div>
              </div>

              <div style={{ flex: "1 1 50%", minWidth: 0, display: "flex", flexDirection: "column" }}>
                <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="Title (optional)"
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "#0f1420",
                        color: "#eaeaea",
                      }}
                    />
                    <button onClick={saveManualChunk} style={{ padding: "10px 12px" }}>
                      Save chunk
                    </button>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                    Preview (stored selection):
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.03)",
                      maxHeight: 130,
                      overflow: "auto",
                    }}
                  >
                    {manualSel ? (
                      <>
                        <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
                          start={manualSel.start} end={manualSel.end} ({manualSel.end - manualSel.start} chars)
                        </div>
                        <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.5 }}>{manualSel.text}</pre>
                      </>
                    ) : (
                      <div style={{ opacity: 0.7 }}>— no selection</div>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
                  {!manualOpenSeg ? (
                    <div ref={manualListScrollRef} style={{ flex: 1, minWidth: 0, overflow: "auto" }}>
                      <div style={{ padding: 12, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                        <span>Saved manual chunks ({mode})</span>
                        <span style={{ opacity: 0.7, fontWeight: 400 }}>{manualSegments.length}</span>
                      </div>

                      {!manualSegments.length ? (
                        <div style={{ padding: 12, opacity: 0.7 }}>
                          No manual chunks yet for <b>{mode}</b>.
                        </div>
                      ) : (
                        <div style={{ padding: 8, display: "grid", gap: 8 }}>
                          {manualSegments.map((s) => (
                            <div
                              key={s.id}
                              onClick={() => manualHandleSelect(s)}
                              onDoubleClick={() => manualHandleOpen(s)}
                              title="Click to select & highlight. Double-click to open."
                              style={{
                                cursor: "pointer",
                                padding: 10,
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,0.10)",
                                background: "rgba(114,255,191,0.08)",
                                userSelect: "none",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                <b style={{ fontSize: 13 }}>{s.title}</b>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSingle(s);
                                  }}
                                  style={{ padding: "4px 10px" }}
                                >
                                  Delete
                                </button>
                              </div>
                              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>{preview120(s.content)}</div>
                            </div>
                          ))}
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
                        <b style={{ flex: 1 }}>{manualOpenSeg.title}</b>
                        <button onClick={() => setManualOpenSeg(null)} style={{ padding: "8px 10px" }}>
                          Back to list
                        </button>
                      </div>

                      <div style={{ padding: 12, overflow: "auto" }}>
                        <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.55 }}>{manualOpenSeg.content}</pre>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ padding: 10, borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12, opacity: 0.7 }}>
                  Tip: Manual modal stays open. Save multiple chunks in a row.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
