import React from "react";

export type ConfirmDialogType = "delete" | "warning" | "info";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  type?: ConfirmDialogType;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({ 
  open, 
  title, 
  message, 
  type = "info", 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  onConfirm, 
  onCancel 
}: ConfirmDialogProps) {
  if (!open) return null;

  const getTypeStyles = () => {
    switch (type) {
      case "delete":
        return {
          icon: "🗑️",
          color: "#ef4444",
          bgColor: "rgba(239, 68, 68, 0.1)",
          borderColor: "rgba(239, 68, 68, 0.3)"
        };
      case "warning":
        return {
          icon: "⚠️",
          color: "#f59e0b",
          bgColor: "rgba(245, 158, 11, 0.1)",
          borderColor: "rgba(245, 158, 11, 0.3)"
        };
      default:
        return {
          icon: "ℹ️",
          color: "#3b82f6",
          bgColor: "rgba(59, 130, 246, 0.1)",
          borderColor: "rgba(59, 130, 246, 0.3)"
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      background: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: 20
    }}>
      <div style={{
        background: "#0b0e14",
        border: `1px solid ${styles.borderColor}`,
        borderRadius: 12,
        padding: 24,
        maxWidth: 400,
        width: "100%",
        boxShadow: "0 10px 25px rgba(0, 0, 0, 0.3)"
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16
        }}>
          <span style={{ fontSize: 24 }}>{styles.icon}</span>
          <h3 style={{ 
            margin: 0, 
            fontSize: 18, 
            fontWeight: "bold",
            color: styles.color
          }}>
            {title}
          </h3>
        </div>
        
        <p style={{
          margin: "0 0 24px 0",
          fontSize: 14,
          lineHeight: 1.5,
          opacity: 0.9
        }}>
          {message}
        </p>
        
        <div style={{
          display: "flex",
          gap: 12,
          justifyContent: "flex-end"
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#eaeaea",
              borderRadius: 6,
              cursor: "pointer",
              transition: "background 0.2s"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
            }}
          >
            {cancelText}
          </button>
          
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 16px",
              fontSize: 14,
              background: styles.bgColor,
              border: `1px solid ${styles.borderColor}`,
              color: styles.color,
              borderRadius: 6,
              cursor: "pointer",
              transition: "background 0.2s"
            }}
            onMouseOver={(e) => {
              const alpha = type === "delete" ? 0.2 : type === "warning" ? 0.15 : 0.1;
              e.currentTarget.style.background = styles.bgColor.replace(/[\d.]+\)/, `${alpha})`);
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = styles.bgColor;
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
