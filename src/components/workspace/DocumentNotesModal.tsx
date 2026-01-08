/**
 * DocumentNotesModal Component
 * 
 * Modal for creating and managing document notes (personal workspace for thoughts, summaries, and annotations).
 * 
 * @module components/workspace/DocumentNotesModal
 */

import React from "react";
import { RichTextEditor } from "../../editor/RichTextEditor";

export interface DocumentNotesModalProps {
  // Modal state
  open: boolean;
  onClose: () => void;
  
  // Notes content
  html: string;
  text: string;
  onHtmlChange: (html: string) => void;
  onTextChange: (text: string) => void;
  
  // Save functionality
  onSave: () => void;
  onResetFromDocument: () => void;
  
  // Status
  dirty: boolean;
  status: string;
}

/**
 * DocumentNotesModal - Modal for document notes
 */
export default function DocumentNotesModal({
  open,
  onClose,
  html,
  text,
  onHtmlChange,
  onTextChange,
  onSave,
  onResetFromDocument,
  dirty,
  status,
}: DocumentNotesModalProps) {
  
  if (!open) return null;

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
          maxWidth: "1200px",
          margin: "0 auto"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 20,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.03)",
            flex: "0 0 auto"
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#eaeaea", marginBottom: "6px" }}>
                📝 Document Notes
              </h2>
              <p style={{ margin: 0, fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)", opacity: 0.8, color: "rgba(255, 255, 255, 0.7)" }}>
                <strong>Your personal workspace</strong> for thoughts, summaries, and annotations about this document. 
                Use this to keep research notes, key findings, or personal thoughts separate from the document content.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: "8px 12px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: "pointer",
                color: "#eaeaea"
              }}
            >
              ✕ Close
            </button>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button 
              onClick={onSave} 
              style={{
                padding: "10px 16px",
                background: dirty ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.1)",
                border: dirty ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: "pointer",
                fontWeight: 500,
                color: "#eaeaea"
              }}
            >
              💾 {dirty ? 'Save Changes' : 'Saved'}
            </button>
            
            <button 
              onClick={onResetFromDocument} 
              style={{
                padding: "10px 16px",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: "pointer",
                color: "#eaeaea"
              }}
              title="Copy the entire document text into notes (useful for creating summaries)"
            >
              📄 Copy Document Text
            </button>
          </div>

          {/* Status */}
          <div style={{ marginTop: 12, fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)", opacity: 0.8 }}>
            Status: {status} {dirty && '• Unsaved changes'}
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", padding: 20 }}>
          {/* Rich Text Editor */}
          <div style={{ flex: 1, minHeight: 400, display: "flex", flexDirection: "column" }}>
            <RichTextEditor
              valueHtml={html}
              onChange={({ html, text }) => {
                onHtmlChange(html);
                onTextChange(text);
              }}
              placeholder="💭 Write your thoughts, summaries, or research notes about this document here... Use the toolbar above for formatting."
            />
          </div>

          {/* Help Section */}
          <div style={{ 
            marginTop: 20,
            padding: 16, 
            borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.02)",
            borderRadius: 12
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#eaeaea" }}>
              💡 Document Notes Help
            </div>
            <div style={{ fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-relaxed)", opacity: 0.9, color: "rgba(255, 255, 255, 0.7)" }}>
              <strong>💡 How to Use Document Notes:</strong><br/>
              • <strong>Personal Workspace:</strong> Write your thoughts, summaries, research notes, or annotations about this document<br/>
              • <strong>Rich Text Editing:</strong> Use the toolbar above for formatting (bold, italic, colors, fonts, etc.)<br/>
              • <strong>Auto-Save:</strong> Notes are automatically saved in your browser when you click "Save Changes"<br/>
              • <strong>Copy Document Text:</strong> Use "Copy Document Text" to quickly copy the entire document into notes (useful for creating summaries)<br/>
              • <strong>Word/Character Count:</strong> See statistics in the status bar below<br/><br/>
              <strong>📌 Use Cases:</strong> Research notes, document summaries, key findings, personal thoughts, annotations, related resources
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

