// src/components/SearchModal.tsx
import React, { useState, useEffect, useRef } from "react";
import { search, SearchResultItem } from "../lib/api";
import { useLoading } from "../hooks/useLoading";
import { highlightSearch } from "../lib/searchUtils";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectResult?: (result: SearchResultItem) => void;
}

export default function SearchModal({ open, onClose, onSelectResult }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedType, setSelectedType] = useState<"all" | "document" | "segment">("all");
  const [selectedMode, setSelectedMode] = useState<"all" | "qa" | "paragraphs">("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const { loading, execute } = useLoading();

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      execute(async () => {
        const response = await search(query, {
          type: selectedType === "all" ? undefined : selectedType,
          mode: selectedMode === "all" ? undefined : selectedMode,
          limit: 50,
        });
        setResults(response.results);
        return response;
      });
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [query, selectedType, selectedMode, execute]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open, onClose]);

  if (!open) return null;

  const handleSelect = (result: SearchResultItem) => {
    if (onSelectResult) {
      onSelectResult(result);
    }
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(8px)",
        zIndex: 10000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "10vh",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: "90%",
          maxWidth: 800,
          maxHeight: "80vh",
          background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(15, 15, 25, 0.95) 100%)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "20px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div style={{ flex: 1 }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="🔍 Search across all documents and segments..."
              style={{
                width: "100%",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(0, 0, 0, 0.3)",
                color: "#eaeaea",
                fontSize: "16px",
                outline: "none",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results.length > 0) {
                  handleSelect(results[0]);
                }
              }}
            />
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "12px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "12px",
              color: "#eaeaea",
              cursor: "pointer",
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "20px", height: "20px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              background: "rgba(0, 0, 0, 0.3)",
              color: "#eaeaea",
              fontSize: "14px",
            }}
          >
            <option value="all">All Types</option>
            <option value="document">Documents</option>
            <option value="segment">Segments</option>
          </select>
          {selectedType === "segment" || selectedType === "all" ? (
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value as any)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(0, 0, 0, 0.3)",
                color: "#eaeaea",
                fontSize: "14px",
              }}
            >
              <option value="all">All Modes</option>
              <option value="qa">QA</option>
              <option value="paragraphs">Paragraphs</option>
            </select>
          ) : null}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "rgba(255, 255, 255, 0.6)" }}>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Searching...
            </div>
          )}
        </div>

        {/* Results */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
          }}
        >
          {!query.trim() ? (
            <div style={{ textAlign: "center", padding: "40px", color: "rgba(255, 255, 255, 0.5)" }}>
              <p>Start typing to search...</p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "rgba(255, 255, 255, 0.5)" }}>
              <p>No results found for "{query}"</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {results.map((result) => (
                <div
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  style={{
                    padding: "16px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "8px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <span
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "11px",
                            fontWeight: 600,
                            background: result.type === "document" ? "rgba(59, 130, 246, 0.2)" : "rgba(139, 92, 246, 0.2)",
                            color: result.type === "document" ? "#93c5fd" : "#c4b5fd",
                          }}
                        >
                          {result.type === "document" ? "📄 Document" : "📝 Segment"}
                        </span>
                        {result.mode && (
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "11px",
                              color: "rgba(255, 255, 255, 0.6)",
                            }}
                          >
                            {result.mode}
                          </span>
                        )}
                        {result.score !== null && (
                          <span
                            style={{
                              fontSize: "11px",
                              color: "rgba(255, 255, 255, 0.4)",
                            }}
                          >
                            Score: {result.score.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <h3
                        style={{
                          fontSize: "16px",
                          fontWeight: 600,
                          color: "#eaeaea",
                          marginBottom: "8px",
                        }}
                      >
                        {query.trim() ? (
                          highlightSearch(result.title, query).map((part, idx) => (
                            <span
                              key={idx}
                              style={part.highlighted ? {
                                background: "rgba(99, 102, 241, 0.3)",
                                color: "#a5b4fc",
                                fontWeight: 700,
                                padding: "2px 4px",
                                borderRadius: 4,
                              } : {}}
                            >
                              {part.text}
                            </span>
                          ))
                        ) : (
                          result.title
                        )}
                      </h3>
                    </div>
                  </div>
                  {result.content && (
                    <p
                      style={{
                        fontSize: "13px",
                        color: "rgba(255, 255, 255, 0.7)",
                        lineHeight: 1.6,
                        margin: 0,
                      }}
                    >
                      {query.trim() ? (
                        highlightSearch(result.content.substring(0, 200), query).map((part, idx) => (
                          <span
                            key={idx}
                            style={part.highlighted ? {
                              background: "rgba(99, 102, 241, 0.3)",
                              color: "#a5b4fc",
                              fontWeight: 600,
                            } : {}}
                          >
                            {part.text}
                          </span>
                        ))
                      ) : (
                        result.content.substring(0, 200)
                      )}
                      {result.content.length > 200 && "..."}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

