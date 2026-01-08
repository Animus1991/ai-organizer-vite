// src/components/SegmentationSummaryBar.tsx
import React, { useMemo, useState } from "react";
import Drawer from "./Drawer";

type ModeBlock = { count: number; last?: string | null };

type Props = {
  qa: ModeBlock;
  paragraphs: ModeBlock;
  metaLine?: string; // optional extra info line (already formatted)
  onRefresh?: () => void;
  drawerTitle?: string;
  rightSlot?: React.ReactNode; // optional actions on the one-liner row
};

function fmt(dt?: string | null) {
  if (!dt) return "—";
  const d = new Date(dt);
  return isNaN(d.getTime()) ? dt : d.toLocaleString();
}

export default function SegmentationSummaryBar({
  qa,
  paragraphs,
  metaLine,
  onRefresh,
  drawerTitle = "Segmentation details",
  rightSlot,
}: Props) {
  const [open, setOpen] = useState(false);

  const oneLine = useMemo(() => {
    const a = `qa(${qa.count}) last ${fmt(qa.last ?? null)}`;
    const b = `paragraphs(${paragraphs.count}) last ${fmt(paragraphs.last ?? null)}`;
    return `${a} • ${b}${metaLine ? ` • ${metaLine}` : ""}`;
  }, [qa.count, qa.last, paragraphs.count, paragraphs.last, metaLine]);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "14px 20px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "16px",
          background: "linear-gradient(135deg, rgba(20, 20, 30, 0.8) 0%, rgba(15, 15, 25, 0.8) 100%)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
        }}
      >
        <div style={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={oneLine}>
          <span style={{ fontWeight: 700, color: "#eaeaea", marginRight: "8px", fontSize: "var(--font-size-base)", lineHeight: "var(--line-height-normal)" }}>Segmentation:</span>
          <span style={{ opacity: 0.9, color: "rgba(255, 255, 255, 0.7)", fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)" }}>{oneLine}</span>
        </div>

        <div style={{ display: "flex", gap: "8px", flex: "0 0 auto" }}>
          {onRefresh ? (
            <button
              onClick={onRefresh}
              style={{
                padding: "8px 16px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "10px",
                color: "#eaeaea",
                fontWeight: 500,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              Refresh
            </button>
          ) : null}
          <button
            onClick={() => setOpen(true)}
            style={{
              padding: "8px 16px",
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              border: "none",
              borderRadius: "10px",
              color: "white",
              fontWeight: 600,
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(99, 102, 241, 0.3)";
            }}
          >
            Details
          </button>
          {rightSlot}
        </div>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title={drawerTitle} width={620}>
        <div style={{ display: "grid", gap: "16px" }}>
          <div
            style={{
              padding: "20px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              background: "linear-gradient(135deg, rgba(20, 20, 30, 0.8) 0%, rgba(15, 15, 25, 0.8) 100%)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: "12px", fontSize: "var(--font-size-lg)", lineHeight: "var(--line-height-snug)", letterSpacing: "var(--letter-spacing-tight)", color: "#eaeaea" }}>qa</div>
            <div style={{ opacity: 0.9, color: "rgba(255, 255, 255, 0.8)", marginBottom: "6px", fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)" }}>count: {qa.count}</div>
            <div style={{ opacity: 0.75, color: "rgba(255, 255, 255, 0.6)", fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)" }}>last: {fmt(qa.last ?? null)}</div>
          </div>

          <div
            style={{
              padding: "20px",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              background: "linear-gradient(135deg, rgba(20, 20, 30, 0.8) 0%, rgba(15, 15, 25, 0.8) 100%)",
              backdropFilter: "blur(20px)",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: "12px", fontSize: "var(--font-size-lg)", lineHeight: "var(--line-height-snug)", letterSpacing: "var(--letter-spacing-tight)", color: "#eaeaea" }}>paragraphs</div>
            <div style={{ opacity: 0.9, color: "rgba(255, 255, 255, 0.8)", marginBottom: "6px", fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)" }}>count: {paragraphs.count}</div>
            <div style={{ opacity: 0.75, color: "rgba(255, 255, 255, 0.6)", fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)" }}>last: {fmt(paragraphs.last ?? null)}</div>
          </div>

          {metaLine ? (
            <div
              style={{
                padding: "20px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "16px",
                background: "linear-gradient(135deg, rgba(20, 20, 30, 0.8) 0%, rgba(15, 15, 25, 0.8) 100%)",
                backdropFilter: "blur(20px)",
                opacity: 0.9,
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: "12px", fontSize: "var(--font-size-lg)", lineHeight: "var(--line-height-snug)", letterSpacing: "var(--letter-spacing-tight)", color: "#eaeaea" }}>list meta</div>
              <div style={{ opacity: 0.85, whiteSpace: "pre-wrap", color: "rgba(255, 255, 255, 0.7)", fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-relaxed)" }}>{metaLine}</div>
            </div>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}
