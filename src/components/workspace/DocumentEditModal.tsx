/**
 * DocumentEditModal Component
 * 
 * Modal for editing the entire document text.
 * 
 * @module components/workspace/DocumentEditModal
 */

import React from "react";
import { RichTextEditor } from "../../editor/RichTextEditor";

export interface DocumentEditModalProps {
  // Modal state
  open: boolean;
  onClose: () => void;
  
  // Document content
  html: string;
  text: string;
  onHtmlChange: (html: string) => void;
  onTextChange: (text: string) => void;
  
  // Save functionality
  onSave: () => Promise<void>;
  
  // Status
  status: string;
  saving: boolean;
}

/**
 * DocumentEditModal - Modal for editing document text
 */
export default function DocumentEditModal({
  open,
  onClose,
  html,
  text,
  onHtmlChange,
  onTextChange,
  onSave,
  status,
  saving,
}: DocumentEditModalProps) {
  
  if (!open) return null;

  const handleSave = async () => {
    await onSave();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", padding: 18, zIndex: 70 }}>
      <div
        style={{
          flex: 1,
          background: "#0b0e14",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 14,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid rgba(255,255,255,0.10)",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flex: "0 0 auto",
          }}
        >
          <b style={{ flex: 1 }}>Edit document text</b>
          <span style={{ fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.7 }}>
            {status}
          </span>
          <button 
            onClick={onClose} 
            style={{ 
              padding: "8px 10px",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 6,
              color: "#eaeaea",
              cursor: "pointer",
              fontSize: "var(--font-size-base)",
              lineHeight: "var(--line-height-normal)",
            }}
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, flex: "1 1 auto", minHeight: 0 }}>
          {/* Warning */}
          <div style={{ fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.75 }}>
            ⚠ Editing document text can invalidate existing segment start/end offsets. After saving, consider re-running segmentation.
          </div>

          {/* Rich Text Editor */}
          <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column" }}>
            <RichTextEditor
              valueHtml={html}
              onChange={({ html, text }) => {
                onHtmlChange(html);
                onTextChange(text);
              }}
              placeholder="Edit document text…"
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button 
              onClick={onClose} 
              style={{ 
                padding: "10px 12px",
                background: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: 8,
                color: "#eaeaea",
                cursor: "pointer",
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
              }}
            >
              Cancel
            </button>
            <button 
              disabled={saving} 
              onClick={handleSave} 
              style={{ 
                padding: "10px 12px",
                background: saving ? "rgba(107, 114, 128, 0.3)" : "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                border: "none",
                borderRadius: 8,
                color: "white",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                opacity: saving ? 0.6 : 1,
                fontWeight: 600,
              }}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

