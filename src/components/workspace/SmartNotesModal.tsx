import React, { useMemo } from "react";
import { RichTextEditor } from "../../editor/RichTextEditor";
import type { SmartNote } from "../../lib/documentWorkspace/smartNotes";

export interface SmartNotesModalProps {
  open: boolean;
  onClose: () => void;
  docId: number;
  smartNotes: SmartNote[];
  currentSmartNote: SmartNote | null;
  smartNoteHtml: string;
  smartNoteText: string;
  smartNoteTags: string[];
  smartNoteCategory: string;
  smartNoteDirty: boolean;
  smartNoteStatus: string;
  smartNoteSearchQuery: string;
  smartNoteSelectedCategory: string;
  smartNoteSelectedTag: string;
  newTagInput: string;
  onHtmlChange: (html: string) => void;
  onTextChange: (text: string) => void;
  onTagsChange: (tags: string[]) => void;
  onCategoryChange: (category: string) => void;
  onDirtyChange: (dirty: boolean) => void;
  onStatusChange: (status: string) => void;
  onSearchQueryChange: (query: string) => void;
  onSelectedCategoryChange: (category: string) => void;
  onSelectedTagChange: (tag: string) => void;
  onNewTagInputChange: (input: string) => void;
  onCreateNew: () => void;
  onSave: () => void;
  onDelete: (noteId: string) => void;
  onLoadNote: (note: SmartNote) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  filteredSmartNotes: SmartNote[];
  allCategories: string[];
  allTags: string[];
}

export function SmartNotesModal({
  open,
  onClose,
  smartNotes,
  currentSmartNote,
  smartNoteHtml,
  smartNoteText,
  smartNoteTags,
  smartNoteCategory,
  smartNoteDirty,
  smartNoteStatus,
  smartNoteSearchQuery,
  smartNoteSelectedCategory,
  smartNoteSelectedTag,
  newTagInput,
  onHtmlChange,
  onTextChange,
  onTagsChange,
  onCategoryChange,
  onDirtyChange,
  onStatusChange,
  onSearchQueryChange,
  onSelectedCategoryChange,
  onSelectedTagChange,
  onNewTagInputChange,
  onCreateNew,
  onSave,
  onDelete,
  onLoadNote,
  onAddTag,
  onRemoveTag,
  filteredSmartNotes,
  allCategories,
  allTags,
}: SmartNotesModalProps) {
  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)", display: "flex", padding: "20px", zIndex: 75, transition: "all 0.2s ease" }}>
      <div
        style={{
          flex: 1,
          background: "linear-gradient(135deg, rgba(11, 14, 20, 0.98) 0%, rgba(8, 10, 16, 0.98) 100%)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "20px",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          maxWidth: "1600px",
          margin: "0 auto",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(255,255,255,0.03)",
            flex: "0 0 auto"
          }}
        >
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#eaeaea", marginBottom: "6px" }}>
                🧠 Smart Notes
              </h2>
              <p style={{ margin: 0, fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)", opacity: 0.8, color: "rgba(255, 255, 255, 0.7)" }}>
                <strong>Organize your thoughts</strong> with tags and categories. Create multiple notes, search and filter them easily.
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
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
            <button 
              onClick={onCreateNew}
              style={{
                padding: "10px 16px",
                background: "rgba(99, 102, 241, 0.2)",
                border: "1px solid rgba(99, 102, 241, 0.5)",
                borderRadius: 8,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: "pointer",
                fontWeight: 500,
                color: "#eaeaea"
              }}
            >
              ➕ New Note
            </button>
            
            <button 
              onClick={onSave} 
              style={{
                padding: "10px 16px",
                background: smartNoteDirty ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.1)",
                border: smartNoteDirty ? "1px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.2)",
                borderRadius: 8,
                fontSize: "var(--font-size-base)",
                lineHeight: "var(--line-height-normal)",
                cursor: "pointer",
                fontWeight: 500,
                color: "#eaeaea"
              }}
              disabled={!smartNoteText.trim()}
            >
              💾 {smartNoteDirty ? 'Save Changes' : 'Saved'}
            </button>

            {currentSmartNote && (
              <button 
                onClick={() => onDelete(currentSmartNote.id)}
                style={{
                  padding: "10px 16px",
                  background: "rgba(239,68,68,0.2)",
                  border: "1px solid rgba(239,68,68,0.5)",
                  borderRadius: 8,
                  fontSize: "var(--font-size-base)",
                  lineHeight: "var(--line-height-normal)",
                  cursor: "pointer",
                  color: "#eaeaea"
                }}
              >
                🗑️ Delete
              </button>
            )}
          </div>

          {/* Status */}
          <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8, color: "rgba(255, 255, 255, 0.7)" }}>
            Status: {smartNoteStatus || "Ready"} {smartNoteDirty && '• Unsaved changes'}
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", padding: 20, gap: 20 }}>
          {/* Left: Editor */}
          <div style={{ flex: "1 1 60%", display: "flex", flexDirection: "column", minHeight: 0 }}>
            {/* Tags and Category */}
            <div style={{ marginBottom: 16, padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: "var(--font-size-base)", lineHeight: "var(--line-height-normal)", fontWeight: 600, marginBottom: 12, color: "#eaeaea" }}>
                🏷️ Tags & Category
              </div>
              
              {/* Category */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", marginBottom: 6, color: "rgba(255, 255, 255, 0.7)" }}>
                  Category:
                </label>
                <select
                  value={smartNoteCategory}
                  onChange={(e) => {
                    onCategoryChange(e.target.value);
                    onDirtyChange(true);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    fontSize: "var(--font-size-base)",
                    color: "#eaeaea"
                  }}
                >
                  <option value="General">📁 General</option>
                  <option value="Technical">🔧 Technical</option>
                  <option value="Research">🔬 Research</option>
                  <option value="Ideas">💡 Ideas</option>
                  <option value="Important">⭐ Important</option>
                  <option value="Questions">❓ Questions</option>
                </select>
              </div>

              {/* Tags */}
              <div>
                <label style={{ display: "block", fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", marginBottom: 6, color: "rgba(255, 255, 255, 0.7)" }}>
                  Tags (manual):
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  {smartNoteTags.map(tag => (
                    <span
                      key={tag}
                      style={{
                        padding: "6px 12px",
                        background: "rgba(99, 102, 241, 0.2)",
                        border: "1px solid rgba(99, 102, 241, 0.5)",
                        borderRadius: 20,
                        fontSize: "var(--font-size-xs)",
                        lineHeight: "var(--line-height-normal)",
                        color: "#eaeaea",
                        display: "flex",
                        alignItems: "center",
                        gap: 6
                      }}
                    >
                      🏷️ {tag}
                      <button
                        onClick={() => onRemoveTag(tag)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#eaeaea",
                          cursor: "pointer",
                          padding: 0,
                          marginLeft: 4,
                          fontSize: 14
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => onNewTagInputChange(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        onAddTag(newTagInput);
                      }
                    }}
                    placeholder="Add tag and press Enter"
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      background: "rgba(255,255,255,0.1)",
                      border: "1px solid rgba(255,255,255,0.2)",
                      borderRadius: 8,
                      fontSize: "var(--font-size-base)",
                      color: "#eaeaea"
                    }}
                  />
                  <button
                    onClick={() => onAddTag(newTagInput)}
                    style={{
                      padding: "8px 16px",
                      background: "rgba(99, 102, 241, 0.3)",
                      border: "1px solid rgba(99, 102, 241, 0.5)",
                      borderRadius: 8,
                      fontSize: "var(--font-size-base)",
                      cursor: "pointer",
                      color: "#eaeaea"
                    }}
                  >
                    Add Tag
                  </button>
                </div>
              </div>
            </div>

            {/* Rich Text Editor */}
            <div style={{ flex: 1, minHeight: 300, display: "flex", flexDirection: "column" }}>
              <RichTextEditor
                valueHtml={smartNoteHtml}
                onChange={({ html, text }) => {
                  onHtmlChange(html);
                  onTextChange(text);
                  onDirtyChange(true);
                }}
                placeholder="💭 Write your note here... Use tags and categories to organize your thoughts..."
              />
            </div>
          </div>

          {/* Right: Notes List */}
          <div style={{ flex: "1 1 40%", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ 
              padding: 16, 
              background: "rgba(255,255,255,0.02)", 
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.1)",
              height: "100%",
              display: "flex",
              flexDirection: "column"
            }}>
              <div style={{ fontSize: "var(--font-size-base)", lineHeight: "var(--line-height-normal)", fontWeight: 600, marginBottom: 12, color: "#eaeaea" }}>
                📚 Notes ({smartNotes.length})
              </div>

              {/* Search Bar */}
              <div style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="🔍 Search notes..."
                  value={smartNoteSearchQuery}
                  onChange={(e) => onSearchQueryChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 8,
                    fontSize: "var(--font-size-base)",
                    color: "#eaeaea"
                  }}
                />
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <select
                  value={smartNoteSelectedCategory}
                  onChange={(e) => onSelectedCategoryChange(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: "120px",
                    padding: "6px 10px",
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#eaeaea"
                  }}
                >
                  <option value="all">📁 All Categories</option>
                  {allCategories.map(cat => (
                    <option key={cat} value={cat}>📁 {cat}</option>
                  ))}
                </select>

                <select
                  value={smartNoteSelectedTag}
                  onChange={(e) => onSelectedTagChange(e.target.value)}
                  style={{
                    flex: 1,
                    minWidth: "120px",
                    padding: "6px 10px",
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#eaeaea"
                  }}
                >
                  <option value="">🏷️ All Tags</option>
                  {allTags.map(tag => (
                    <option key={tag} value={tag}>🏷️ {tag}</option>
                  ))}
                </select>
              </div>

              {/* Notes List */}
              <div style={{ flex: 1, overflowY: "auto" }}>
                {filteredSmartNotes.length > 0 ? (
                  filteredSmartNotes.map(note => (
                    <div
                      key={note.id}
                      onClick={() => onLoadNote(note)}
                      style={{
                        padding: 12,
                        marginBottom: 8,
                        background: currentSmartNote?.id === note.id ? "rgba(99, 102, 241, 0.2)" : "rgba(255,255,255,0.05)",
                        border: currentSmartNote?.id === note.id ? "1px solid rgba(99, 102, 241, 0.5)" : "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        fontSize: "var(--font-size-xs)",
                        lineHeight: "var(--line-height-normal)",
                        cursor: "pointer",
                        transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => {
                        if (currentSmartNote?.id !== note.id) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentSmartNote?.id !== note.id) {
                          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                        }
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 4, color: "#eaeaea" }}>
                        {note.content.slice(0, 80)}{note.content.length > 80 ? "…" : ""}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.7, color: "rgba(255, 255, 255, 0.6)" }}>
                          📁 {note.category}
                        </span>
                        {note.tags.map(tag => (
                          <span key={tag} style={{ fontSize: 11, opacity: 0.7, color: "rgba(255, 255, 255, 0.6)" }}>
                            🏷️ {tag}
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: "var(--font-size-xs)", lineHeight: "var(--line-height-normal)", opacity: 0.6, color: "rgba(255, 255, 255, 0.5)" }}>
                        {new Date(note.timestamp).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: "center", opacity: 0.5, fontSize: "var(--font-size-sm)", lineHeight: "var(--line-height-normal)", padding: 20, color: "rgba(255, 255, 255, 0.6)" }}>
                    {smartNotes.length === 0 
                      ? "No notes yet. Click 'New Note' to create your first Smart Note!"
                      : "No notes match your search/filter criteria."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Help Section */}
        <div style={{ 
          padding: 20, 
          borderTop: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
          flex: "0 0 auto"
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#eaeaea" }}>
            💡 Smart Notes Help
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.9, color: "rgba(255, 255, 255, 0.7)" }}>
            <strong>🧠 Smart Notes Features:</strong><br/>
            • <strong>Multiple Notes:</strong> Create as many notes as you need, each with its own tags and category<br/>
            • <strong>Manual Tags:</strong> Add tags manually to organize your notes (e.g., "important", "verify", "citation-needed")<br/>
            • <strong>Categories:</strong> Organize notes by category (General, Technical, Research, Ideas, etc.)<br/>
            • <strong>Search & Filter:</strong> Quickly find notes by content, tags, or categories<br/>
            • <strong>Link to Chunks:</strong> Optionally link notes to specific document chunks for better context<br/>
            • <strong>Rich Text Editing:</strong> Full formatting support with toolbar
          </div>
        </div>
      </div>
    </div>
  );
}

