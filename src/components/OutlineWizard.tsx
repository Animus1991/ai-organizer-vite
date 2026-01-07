// src/components/OutlineWizard.tsx
import React, { useMemo, useState } from "react";
import Drawer from "./Drawer";

type Seg = {
  id: number;
  title: string;
  content: string;
  mode?: string;
  isManual?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  documentId: number;
  segments: Seg[];
};

function safeLine(s: string) {
  return (s ?? "").replace(/\s+/g, " ").trim();
}

function genOutline(segs: Seg[]) {
  const lines: string[] = [];
  lines.push(`# Document Structure`);
  lines.push("");
  lines.push(`Generated from ${segs.length} selected chunk${segs.length !== 1 ? 's' : ''}`);
  lines.push("");
  lines.push(`## Overview`);
  lines.push(`- This outline was generated from your document chunks`);
  lines.push(`- Use it as a template for summaries, reports, or presentations`);
  lines.push("");
  lines.push(`## Document Structure`);
  lines.push("");

  segs.forEach((s, i) => {
    const t = safeLine(s.title || `Chunk ${i + 1}`);
    const preview = safeLine((s.content || "").slice(0, 220));
    lines.push(`### ${i + 1}. ${t}`);
    lines.push(`- **Source:** ${s.mode ?? "—"} • ${s.isManual ? "manual" : "auto"} chunk`);
    if (preview) lines.push(`- **Summary:** ${preview}${(s.content || "").length > 220 ? "…" : ""}`);
    lines.push(`- **Key Points:**`);
    lines.push(`  - (Add main points here)`);
    lines.push(`- **Details:**`);
    lines.push(`  - (Add supporting details here)`);
    lines.push("");
  });

  lines.push(`## Additional Notes`);
  lines.push(`- (Add any additional information, references, or citations here)`);
  lines.push("");
  return lines.join("\n");
}

export default function OutlineWizard({ open, onClose, documentId, segments }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [outline, setOutline] = useState<string>("");

  const pickedList = useMemo(() => {
    const ids = Object.keys(picked).filter((k) => picked[k]);
    return segments.filter((s) => ids.includes(String(s.id)));
  }, [picked, segments]);

  function toggleAll(on: boolean) {
    const next: Record<string, boolean> = {};
    segments.forEach((s) => (next[String(s.id)] = on));
    setPicked(next);
  }

  function exportMd() {
    const blob = new Blob([outline], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doc_${documentId}__outline.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 300);
  }

  return (
    <Drawer
      open={open}
      onClose={() => {
        setStep(1);
        setPicked({});
        setOutline("");
        onClose();
      }}
      title={`Document Structure • Document #${documentId}`}
      width={820}
      footer={
        <div style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <div style={{ opacity: 0.75, fontSize: 12 }}>Step {step}/3</div>
          <div style={{ display: "flex", gap: 10 }}>
            {step > 1 ? (
              <button onClick={() => setStep((s) => (s === 3 ? 2 : 1))} style={{ padding: "10px 12px" }}>
                Back
              </button>
            ) : null}
            {step < 3 ? (
              <button
                onClick={() => {
                  if (step === 1) setStep(2);
                  else setStep(3);
                }}
                style={{ padding: "10px 12px" }}
              >
                Next
              </button>
            ) : (
              <>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(outline);
                    } catch {
                      // ignore
                    }
                  }}
                  style={{ padding: "10px 12px" }}
                >
                  Copy
                </button>
                <button onClick={exportMd} style={{ padding: "10px 12px" }}>
                  Export .md
                </button>
              </>
            )}
          </div>
        </div>
      }
    >
      {step === 1 ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ opacity: 0.85, fontSize: 14, lineHeight: 1.6, color: "rgba(255, 255, 255, 0.8)" }}>
            <strong>Document Structure Generator</strong><br/>
            Select chunks to generate a structured outline (Markdown format). Useful for creating summaries, reports, or organizing your document content.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => toggleAll(true)} style={{ padding: "10px 12px" }}>
              Select all
            </button>
            <button onClick={() => toggleAll(false)} style={{ padding: "10px 12px" }}>
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <b>Pick chunks</b>
            <span style={{ opacity: 0.75, fontSize: 12 }}>
              picked: {pickedList.length}/{segments.length}
            </span>
          </div>

          <div style={{ display: "grid", gap: 8, maxHeight: "62vh", overflow: "auto", paddingRight: 6 }}>
            {segments.map((s) => (
              <label
                key={s.id}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.03)",
                }}
              >
                <input
                  type="checkbox"
                  checked={!!picked[String(s.id)]}
                  onChange={(e) => setPicked((p) => ({ ...p, [String(s.id)]: e.target.checked }))}
                  style={{ marginTop: 2 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800 }}>
                    {s.title}{" "}
                    <span style={{ fontWeight: 500, opacity: 0.7, fontSize: 12 }}>
                      • {s.mode ?? "—"} • {s.isManual ? "manual" : "auto"}
                    </span>
                  </div>
                  <div style={{ opacity: 0.8, fontSize: 12 }}>{safeLine((s.content || "").slice(0, 140))}…</div>
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={() => {
              const out = genOutline(pickedList);
              setOutline(out);
              setStep(3);
            }}
            disabled={pickedList.length === 0}
            style={{ padding: "10px 12px", opacity: pickedList.length ? 1 : 0.6 }}
          >
            Generate Outline
          </button>
        </div>
      ) : null}

      {step === 3 ? (
        <div style={{ display: "grid", gap: 10 }}>
          <b>Outline (editable)</b>
          <textarea
            value={outline}
            onChange={(e) => setOutline(e.target.value)}
            style={{
              width: "100%",
              minHeight: "62vh",
              padding: 12,
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#0f1420",
              color: "#eaeaea",
              resize: "vertical",
              lineHeight: 1.5,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            }}
          />
          <div style={{ opacity: 0.75, fontSize: 12, color: "rgba(255, 255, 255, 0.6)", marginTop: 12 }}>
            💡 <strong>Tip:</strong> Fill in the "Claim/Evidence/Counterpoint/Transition" sections for each chunk, then use this as a template for your final document or presentation.
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
