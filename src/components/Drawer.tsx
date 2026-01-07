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
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        zIndex: 4000,
        display: "flex",
        justifyContent: "flex-end",
        transition: "all 0.2s ease",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          height: "100vh",
          background: "linear-gradient(135deg, rgba(11, 14, 20, 0.98) 0%, rgba(8, 10, 16, 0.98) 100%)",
          backdropFilter: "blur(20px)",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          display: "flex",
          flexDirection: "column",
          width: w,
          boxShadow: "-8px 0 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
          animation: "slideIn 0.3s ease-out",
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <style>{`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
            }
            to {
              transform: translateX(0);
            }
          }
        `}</style>
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "linear-gradient(135deg, rgba(30, 30, 40, 0.5) 0%, rgba(20, 20, 30, 0.3) 100%)",
          }}
        >
          <div style={{ fontWeight: 800, flex: 1, fontSize: "var(--font-size-lg)", lineHeight: "var(--line-height-snug)", letterSpacing: "var(--letter-spacing-tight)", color: "#eaeaea" }}>{title ?? "Details"}</div>
          <button
            onClick={onClose}
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
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
            }}
          >
            Close
          </button>
        </div>

        <div style={{ padding: "24px", overflow: "auto", flex: "1 1 auto", minHeight: 0 }}>{children}</div>

        {footer ? (
          <div
            style={{
              padding: "20px 24px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              background: "linear-gradient(135deg, rgba(30, 30, 40, 0.5) 0%, rgba(20, 20, 30, 0.3) 100%)",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    el
  );
}
