// src/components/SynonymsManager.tsx
import React, { useState, useEffect } from "react";
import { addSynonym, removeSynonym, listSynonyms, SynonymListResponse } from "../lib/api";
import { useLoading } from "../hooks/useLoading";

interface SynonymsManagerProps {
  open: boolean;
  onClose: () => void;
}

export default function SynonymsManager({ open, onClose }: SynonymsManagerProps) {
  const [word, setWord] = useState("");
  const [synonym, setSynonym] = useState("");
  const [synonyms, setSynonyms] = useState<Record<string, string[]>>({});
  const [searchWord, setSearchWord] = useState("");
  const [filteredSynonyms, setFilteredSynonyms] = useState<Record<string, string[]>>({});
  const { loading, execute } = useLoading();

  useEffect(() => {
    if (open) {
      loadSynonyms();
    }
  }, [open]);

  useEffect(() => {
    if (searchWord.trim()) {
      const filtered: Record<string, string[]> = {};
      for (const [w, syns] of Object.entries(synonyms)) {
        if (w.toLowerCase().includes(searchWord.toLowerCase()) || 
            syns.some(s => s.toLowerCase().includes(searchWord.toLowerCase()))) {
          filtered[w] = syns;
        }
      }
      setFilteredSynonyms(filtered);
    } else {
      setFilteredSynonyms(synonyms);
    }
  }, [searchWord, synonyms]);

  const loadSynonyms = async () => {
    try {
      const response = await listSynonyms();
      setSynonyms(response.synonyms || {});
      setFilteredSynonyms(response.synonyms || {});
    } catch (error) {
      console.error("Failed to load synonyms:", error);
    }
  };

  const handleAdd = async () => {
    if (!word.trim() || !synonym.trim()) {
      alert("Please enter both word and synonym");
      return;
    }

    if (word.trim().toLowerCase() === synonym.trim().toLowerCase()) {
      alert("Word and synonym cannot be the same");
      return;
    }

    await execute(async () => {
      try {
        await addSynonym(word.trim(), synonym.trim());
        setWord("");
        setSynonym("");
        await loadSynonyms();
      } catch (error: any) {
        alert(error.message || "Failed to add synonym");
      }
    });
  };

  const handleRemove = async (w: string, syn: string) => {
    if (!confirm(`Remove synonym pair: ${w} <-> ${syn}?`)) {
      return;
    }

    await execute(async () => {
      try {
        await removeSynonym(w, syn);
        await loadSynonyms();
      } catch (error: any) {
        alert(error.message || "Failed to remove synonym");
      }
    });
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
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
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
          maxHeight: "90vh",
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
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#eaeaea", margin: 0 }}>
            📚 Custom Synonyms Management
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: "8px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "8px",
              color: "#eaeaea",
              cursor: "pointer",
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "20px", height: "20px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Add Synonym Form */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            background: "rgba(99, 102, 241, 0.05)",
          }}
        >
          <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#eaeaea", marginBottom: "12px" }}>
            Add Synonym Pair (Bidirectional)
          </h3>
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="Word (e.g., document)"
              style={{
                flex: 1,
                minWidth: "150px",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(0, 0, 0, 0.3)",
                color: "#eaeaea",
                fontSize: "14px",
              }}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleAdd();
                }
              }}
            />
            <span style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "18px" }}>⇄</span>
            <input
              type="text"
              value={synonym}
              onChange={(e) => setSynonym(e.target.value)}
              placeholder="Synonym (e.g., file)"
              style={{
                flex: 1,
                minWidth: "150px",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(0, 0, 0, 0.3)",
                color: "#eaeaea",
                fontSize: "14px",
              }}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleAdd();
                }
              }}
            />
            <button
              onClick={handleAdd}
              disabled={loading || !word.trim() || !synonym.trim()}
              style={{
                padding: "10px 20px",
                borderRadius: "8px",
                border: "none",
                background: loading || !word.trim() || !synonym.trim()
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(99, 102, 241, 0.8)",
                color: "#eaeaea",
                fontSize: "14px",
                fontWeight: 600,
                cursor: loading || !word.trim() || !synonym.trim() ? "not-allowed" : "pointer",
                opacity: loading || !word.trim() || !synonym.trim() ? 0.5 : 1,
              }}
            >
              {loading ? "Adding..." : "Add"}
            </button>
          </div>
        </div>

        {/* Search */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          <input
            type="text"
            value={searchWord}
            onChange={(e) => setSearchWord(e.target.value)}
            placeholder="🔍 Search synonyms..."
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              background: "rgba(0, 0, 0, 0.3)",
              color: "#eaeaea",
              fontSize: "14px",
            }}
          />
        </div>

        {/* Synonyms List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px 24px",
          }}
        >
          {Object.keys(filteredSynonyms).length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "rgba(255, 255, 255, 0.5)" }}>
              {searchWord.trim() ? (
                <p>No synonyms found matching "{searchWord}"</p>
              ) : (
                <>
                  <p>No custom synonyms yet</p>
                  <p style={{ fontSize: "12px", marginTop: "8px", opacity: 0.7 }}>
                    Add synonym pairs above to enable semantic search variations
                  </p>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {Object.entries(filteredSynonyms).map(([w, syns]) => (
                <div
                  key={w}
                  style={{
                    padding: "16px",
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#eaeaea", marginBottom: "8px" }}>
                        {w}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {syns.map((syn) => (
                          <div
                            key={syn}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "6px 12px",
                              background: "rgba(99, 102, 241, 0.1)",
                              border: "1px solid rgba(99, 102, 241, 0.3)",
                              borderRadius: "6px",
                              fontSize: "13px",
                              color: "#a5b4fc",
                            }}
                          >
                            <span>{syn}</span>
                            <button
                              onClick={() => handleRemove(w, syn)}
                              style={{
                                padding: "2px 4px",
                                background: "rgba(255, 0, 0, 0.2)",
                                border: "none",
                                borderRadius: "4px",
                                color: "#ff6b6b",
                                cursor: "pointer",
                                fontSize: "12px",
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid rgba(255, 255, 255, 0.1)",
            fontSize: "12px",
            color: "rgba(255, 255, 255, 0.5)",
            textAlign: "center",
          }}
        >
          {Object.keys(synonyms).length} synonym pair{Object.keys(synonyms).length !== 1 ? "s" : ""} configured
        </div>
      </div>
    </div>
  );
}
