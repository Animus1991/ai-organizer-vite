// src/components/Drawer.tsx
import React, { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title?: string;
  width?: number | string; // px or css string
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function Drawer({ open, title, width = 520, onClose, children, footer }: Props) {
  const el = useMemo(() => {
    const d = document.createElement("div");
    d.setAttribute("data-drawer-root", "true");
    return d;
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.appendChild(el);
    return () => {
      try {
        document.body.removeChild(el);
      } catch {
        // ignore
      }
    };
  }, [open, el]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const w = typeof width === "number" ? `${width}px` : width;

  return createPortal(
    <div
      className="drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="drawer-panel" style={{ width: w }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="drawer-header">
          <div className="drawer-title">{title ?? "Details"}</div>
          <button className="drawer-close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="drawer-body">{children}</div>

        {footer ? <div className="drawer-footer">{footer}</div> : null}
      </div>
    </div>,
    el
  );
}
