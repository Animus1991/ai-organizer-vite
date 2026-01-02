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
      <div className="one-liner">
        <div className="one-liner__text" title={oneLine}>
          <b>Segmentation:</b> <span style={{ opacity: 0.9 }}>{oneLine}</span>
        </div>

        <div className="one-liner__actions">
          {onRefresh ? (
            <button onClick={onRefresh} style={{ padding: "6px 10px" }}>
              Refresh
            </button>
          ) : null}
          <button onClick={() => setOpen(true)} style={{ padding: "6px 10px" }}>
            Details
          </button>
          {rightSlot}
        </div>
      </div>

      <Drawer open={open} onClose={() => setOpen(false)} title={drawerTitle} width={620}>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ padding: 12, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>qa</div>
            <div style={{ opacity: 0.9 }}>count: {qa.count}</div>
            <div style={{ opacity: 0.75 }}>last: {fmt(qa.last ?? null)}</div>
          </div>

          <div style={{ padding: 12, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 6 }}>paragraphs</div>
            <div style={{ opacity: 0.9 }}>count: {paragraphs.count}</div>
            <div style={{ opacity: 0.75 }}>last: {fmt(paragraphs.last ?? null)}</div>
          </div>

          {metaLine ? (
            <div style={{ padding: 12, border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, opacity: 0.9 }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>list meta</div>
              <div style={{ opacity: 0.85, whiteSpace: "pre-wrap" }}>{metaLine}</div>
            </div>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}
