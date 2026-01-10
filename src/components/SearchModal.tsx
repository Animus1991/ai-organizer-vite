// src/components/SearchModal.tsx
import React, { useState, useEffect, useRef, useMemo } from "react";
import { search, SearchResultItem } from "../lib/api";
import { useLoading } from "../hooks/useLoading";
import { highlightSearch, truncateWithHighlight } from "../lib/searchUtils";
import SynonymsManager from "./SynonymsManager";

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
  onSelectResult?: (result: SearchResultItem) => void;
}

type SortOption = "relevance" | "score" | "title" | "type";

export default function SearchModal({ open, onClose, onSelectResult }: SearchModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedType, setSelectedType] = useState<"all" | "document" | "segment">("all");
  const [selectedMode, setSelectedMode] = useState<"all" | "qa" | "paragraphs">("all");
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [semantic, setSemantic] = useState(false); // Enable semantic search
  const [lang, setLang] = useState<"auto" | "el" | "en">("auto"); // Language selection
  const [expandVariations, setExpandVariations] = useState(true); // Expand query variations
  const [searchResponse, setSearchResponse] = useState<{ semantic?: boolean; variations?: string[] } | null>(null);
  const [synonymsManagerOpen, setSynonymsManagerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const { loading, execute } = useLoading();

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchResponse(null);
      setSearchError(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      execute(async () => {
        try {
          setSearchError(null);
          const response = await search(query, {
            type: selectedType === "all" ? undefined : selectedType,
            mode: selectedMode === "all" ? undefined : selectedMode,
            limit: 100, // Increased limit for better results
            semantic, // Enable semantic search
            lang, // Language selection
            expand_variations: expandVariations, // Expand query variations
          });
          setResults(response.results);
          setSearchResponse({ semantic: response.semantic, variations: response.variations });
          setSelectedIndex(0);
          return response;
        } catch (error: any) {
          console.error("Search error:", error);
          setSearchError(error.message || "Search failed. Please try again.");
          setResults([]);
          setSearchResponse(null);
        }
      });
    }, 300); // Debounce

    return () => clearTimeout(timeoutId);
  }, [query, selectedType, selectedMode, semantic, lang, expandVariations, execute]);

  // Sort results
  const sortedResults = useMemo(() => {
    const sorted = [...results];
    switch (sortBy) {
      case "score":
        return sorted.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      case "title":
        return sorted.sort((a, b) => a.title.localeCompare(b.title));
      case "type":
        return sorted.sort((a, b) => a.type.localeCompare(b.type));
      case "relevance":
      default:
        return sorted; // Already sorted by relevance from API
    }
  }, [results, sortBy]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, sortedResults.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && sortedResults.length > 0) {
        e.preventDefault();
        handleSelect(sortedResults[selectedIndex]);
      }
    };

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, sortedResults, selectedIndex, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && sortedResults.length > 0) {
      const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [selectedIndex, sortedResults.length]);

  const handleSelect = (result: SearchResultItem) => {
    if (onSelectResult) {
      onSelectResult(result);
    }
    onClose();
  };

  if (!open) return null;

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
          maxWidth: 900,
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
            />
          </div>
          <button
            onClick={() => setSynonymsManagerOpen(true)}
            style={{
              padding: "8px 12px",
              background: "rgba(99, 102, 241, 0.2)",
              border: "1px solid rgba(99, 102, 241, 0.3)",
              borderRadius: "8px",
              color: "#a5b4fc",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
            }}
            title="Manage custom synonyms"
          >
            📚 Synonyms
          </button>
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

        {/* Filters and Sort */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
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
          
          {/* Advanced Search Options */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "4px 0", flexWrap: "wrap" }}>
            <label 
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "6px", 
                cursor: "pointer", 
                fontSize: "13px", 
                color: "rgba(255, 255, 255, 0.8)",
                padding: "4px 8px",
                borderRadius: "6px",
                background: semantic ? "rgba(99, 102, 241, 0.15)" : "transparent",
                transition: "background 0.2s",
              }}
              title="Enable semantic search with embeddings (requires sentence-transformers)"
            >
              <input
                type="checkbox"
                checked={semantic}
                onChange={(e) => setSemantic(e.target.checked)}
                style={{ cursor: "pointer", transform: "scale(1.1)" }}
              />
              <span style={{ fontWeight: semantic ? 600 : 400 }}>🧠 Semantic</span>
            </label>
            {semantic && (
              <>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as "auto" | "el" | "en")}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    background: "rgba(0, 0, 0, 0.3)",
                    color: "#eaeaea",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                  title="Language for NLP processing (auto-detection, Greek, or English)"
                >
                  <option value="auto">🌐 Auto</option>
                  <option value="el">🇬🇷 Greek (Ελληνικά)</option>
                  <option value="en">🇬🇧 English</option>
                </select>
                <label 
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "6px", 
                    cursor: "pointer", 
                    fontSize: "13px", 
                    color: "rgba(255, 255, 255, 0.8)",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    background: expandVariations ? "rgba(99, 102, 241, 0.1)" : "transparent",
                    transition: "background 0.2s",
                  }}
                  title="Expand query with variations (plural/singular, synonyms, lemmatization) - requires spaCy"
                >
                  <input
                    type="checkbox"
                    checked={expandVariations}
                    onChange={(e) => setExpandVariations(e.target.checked)}
                    style={{ cursor: "pointer", transform: "scale(1.1)" }}
                  />
                  <span style={{ fontWeight: expandVariations ? 600 : 400 }}>📝 Variations</span>
                </label>
              </>
            )}
          </div>
          
          <div style={{ flex: 1 }} />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              background: "rgba(0, 0, 0, 0.3)",
              color: "#eaeaea",
              fontSize: "14px",
            }}
          >
            <option value="relevance">Sort by Relevance</option>
            <option value="score">Sort by Score</option>
            <option value="title">Sort by Title</option>
            <option value="type">Sort by Type</option>
          </select>
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
        
        {/* Search Info: Show semantic search status and variations */}
        {searchResponse && query.trim() && (searchResponse.semantic || searchResponse.variations?.length) && (
          <div
            style={{
              padding: "10px 24px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              fontSize: "12px",
              color: "rgba(255, 255, 255, 0.7)",
              background: "rgba(99, 102, 241, 0.08)",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            {searchResponse.semantic && (
              <span style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(99, 102, 241, 0.9)", fontWeight: 500 }}>
                <span>🧠</span>
                <span>Semantic search enabled</span>
              </span>
            )}
            {searchResponse.variations && searchResponse.variations.length > 1 && (
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ opacity: 0.6 }}>📝</span>
                <span>
                  <strong>Variations:</strong> {searchResponse.variations.slice(0, 3).join(", ")}
                  {searchResponse.variations.length > 3 && ` (+${searchResponse.variations.length - 3} more)`}
                </span>
              </span>
            )}
          </div>
        )}
        
        {/* Warning if semantic search is requested but not available */}
        {semantic && !searchResponse?.semantic && query.trim() && !loading && results.length > 0 && (
          <div
            style={{
              padding: "10px 24px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              fontSize: "12px",
              color: "rgba(255, 165, 0, 0.9)",
              background: "rgba(255, 165, 0, 0.1)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>⚠️</span>
            <span>Semantic search requested but not available. Using FTS5 search only. Install sentence-transformers for semantic search.</span>
          </div>
        )}
        
        {/* Search Error */}
        {searchError && query.trim() && (
          <div
            style={{
              padding: "12px 24px",
              borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
              fontSize: "13px",
              color: "rgba(255, 100, 100, 0.9)",
              background: "rgba(255, 0, 0, 0.1)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span>❌</span>
            <span>{searchError}</span>
            <button
              onClick={() => setSearchError(null)}
              style={{
                marginLeft: "auto",
                padding: "4px 8px",
                background: "rgba(255, 255, 255, 0.1)",
                border: "none",
                borderRadius: "4px",
                color: "rgba(255, 255, 255, 0.8)",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Results */}
        <div
          ref={resultsRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
          }}
        >
          {!query.trim() ? (
            <div style={{ textAlign: "center", padding: "40px", color: "rgba(255, 255, 255, 0.5)" }}>
              <p>Start typing to search...</p>
              <p style={{ fontSize: "12px", marginTop: "8px", opacity: 0.7 }}>
                Use ↑↓ to navigate, Enter to select, Esc to close
              </p>
            </div>
          ) : sortedResults.length === 0 && !loading ? (
            <div style={{ textAlign: "center", padding: "40px", color: "rgba(255, 255, 255, 0.5)" }}>
              <p>No results found for "{query}"</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {sortedResults.map((result, index) => {
                const isSelected = index === selectedIndex;
                const { parts, truncated } = truncateWithHighlight(result.content || "", query, 200);
                
                return (
                  <div
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleSelect(result)}
                    style={{
                      padding: "16px",
                      background: isSelected
                        ? "rgba(99, 102, 241, 0.2)"
                        : "rgba(255, 255, 255, 0.03)",
                      border: isSelected
                        ? "1px solid rgba(99, 102, 241, 0.5)"
                        : "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "12px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                      }
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "8px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
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
                                background: "rgba(255, 255, 255, 0.05)",
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
                        {parts.map((part, idx) => (
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
                        ))}
                        {truncated && "..."}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {sortedResults.length > 0 && (
          <div
            style={{
              padding: "12px 24px",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              fontSize: "12px",
              color: "rgba(255, 255, 255, 0.5)",
              textAlign: "center",
            }}
          >
            {sortedResults.length} result{sortedResults.length !== 1 ? "s" : ""} found
            {selectedIndex >= 0 && (
              <span style={{ marginLeft: "12px" }}>
                • Press Enter to open, ↑↓ to navigate
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Synonyms Manager Modal */}
      <SynonymsManager open={synonymsManagerOpen} onClose={() => setSynonymsManagerOpen(false)} />
    </div>
  );
}
