// src/pages/DocumentViewer.tsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getDocument, DocumentDTO } from "../lib/api";
import { useLoading } from "../hooks/useLoading";
import { highlightSearch } from "../lib/searchUtils";
import { 
  exportDocumentToJSON, 
  exportDocumentToTXT, 
  exportDocumentToMD, 
  downloadFile,
  calculateDocumentStats 
} from "../lib/exportUtils";

export default function DocumentViewer() {
  const { documentId } = useParams<{ documentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [document, setDocument] = useState<DocumentDTO | null>(null);
  const { loading, error, execute } = useLoading();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchMatches, setSearchMatches] = useState<number[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Statistics
  const stats = useMemo(() => {
    if (!document?.text) return null;
    return calculateDocumentStats(document.text);
  }, [document?.text]);

  useEffect(() => {
    if (!documentId || !user) return;

    const loadDocument = async () => {
      const doc = await execute(async () => {
        return await getDocument(Number(documentId));
      });
      
      if (doc) {
        setDocument(doc);
      }
    };

    loadDocument();
  }, [documentId, user, execute]);

  // Search functionality
  useEffect(() => {
    if (!document?.text || !searchQuery.trim()) {
      setSearchMatches([]);
      setSearchIndex(0);
      return;
    }

    const query = searchQuery.trim().toLowerCase();
    const text = document.text.toLowerCase();
    const matches: number[] = [];
    let index = text.indexOf(query);

    while (index !== -1) {
      matches.push(index);
      index = text.indexOf(query, index + 1);
    }

    setSearchMatches(matches);
    setSearchIndex(0);
  }, [document?.text, searchQuery]);

  // Export functions
  const handleExport = (format: 'json' | 'txt' | 'md') => {
    if (!document) return;

    let content = '';
    let filename = '';
    let mimeType = '';

    switch (format) {
      case 'json':
        content = exportDocumentToJSON(document, { format: 'json', includeMetadata: true });
        filename = `${document.filename || 'document'}.json`;
        mimeType = 'application/json';
        break;
      case 'txt':
        content = exportDocumentToTXT(document, { format: 'txt', includeMetadata: true });
        filename = `${document.filename || 'document'}.txt`;
        mimeType = 'text/plain';
        break;
      case 'md':
        content = exportDocumentToMD(document, { format: 'md', includeMetadata: true });
        filename = `${document.filename || 'document'}.md`;
        mimeType = 'text/markdown';
        break;
    }

    downloadFile(content, filename, mimeType);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleNextMatch = () => {
    if (searchMatches.length > 0) {
      setSearchIndex((prev) => (prev + 1) % searchMatches.length);
    }
  };

  const handlePrevMatch = () => {
    if (searchMatches.length > 0) {
      setSearchIndex((prev) => (prev - 1 + searchMatches.length) % searchMatches.length);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #0f0f1a 50%, #0a0a0a 100%)",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(15, 15, 25, 0.95) 100%)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "20px",
            padding: "40px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <svg className="animate-spin w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" style={{ width: "24px", height: "24px", color: "#6366f1" }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span style={{ color: "#6366f1", fontWeight: 600, fontSize: "16px" }}>Loading document...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #0f0f1a 50%, #0a0a0a 100%)",
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(15, 15, 25, 0.95) 100%)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "20px",
            padding: "40px",
            maxWidth: "500px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "64px",
                height: "64px",
                background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "32px", height: "32px", color: "#f87171" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 style={{ fontSize: "22px", fontWeight: 700, color: "#eaeaea", marginBottom: "12px" }}>Document Not Found</h3>
            <p style={{ color: "rgba(255, 255, 255, 0.6)", marginBottom: "24px", fontSize: "14px" }}>{error || "The requested document could not be loaded."}</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <Link
                to="/"
                style={{
                  padding: "12px 24px",
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                  border: "none",
                  borderRadius: "12px",
                  color: "white",
                  fontWeight: 600,
                  fontSize: "14px",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 6px 16px rgba(99, 102, 241, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(99, 102, 241, 0.3)";
                }}
              >
                Back to Home
              </Link>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: "12px 24px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  color: "#eaeaea",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #0f0f1a 50%, #0a0a0a 100%)",
        maxWidth: 1400,
        margin: "0 auto",
        padding: "32px 32px",
        color: "#eaeaea",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(15, 15, 25, 0.95) 100%)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "20px",
            padding: "28px 32px",
            marginBottom: "24px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <button
            onClick={() => navigate(-1)}
              style={{
                padding: "12px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                color: "#eaeaea",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "20px", height: "20px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
              <h1
                style={{
                  fontSize: "32px",
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  margin: 0,
                  marginBottom: "6px",
                  letterSpacing: "-0.5px",
                }}
              >
                {document.title}
              </h1>
            {document.filename && (
                <p style={{ margin: 0, fontSize: "15px", color: "rgba(255, 255, 255, 0.6)", fontWeight: 400 }}>{document.filename}</p>
            )}
          </div>
        </div>

        {/* Metadata */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(20, 20, 30, 0.8) 0%, rgba(15, 15, 25, 0.8) 100%)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "16px",
              padding: "24px",
              marginBottom: "24px",
            }}
          >
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#eaeaea", marginBottom: "20px" }}>Document Information</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "24px" }}>
            <div>
                <h3 style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255, 255, 255, 0.7)", marginBottom: "8px" }}>Source Type</h3>
                <p style={{ color: "#eaeaea", fontSize: "14px", fontWeight: 500, textTransform: "capitalize" }}>{document.sourceType}</p>
            </div>
            <div>
                <h3 style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255, 255, 255, 0.7)", marginBottom: "8px" }}>Parse Status</h3>
                <span
                  style={{
                    display: "inline-flex",
                    padding: "6px 12px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: 600,
                    ...(document.parseStatus === "ok"
                      ? {
                          background: "rgba(16, 185, 129, 0.2)",
                          color: "#6ee7b7",
                          border: "1px solid rgba(16, 185, 129, 0.3)",
                        }
                      : document.parseStatus === "failed"
                      ? {
                          background: "rgba(239, 68, 68, 0.2)",
                          color: "#fca5a5",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                        }
                      : {
                          background: "rgba(251, 191, 36, 0.2)",
                          color: "#fcd34d",
                          border: "1px solid rgba(251, 191, 36, 0.3)",
                        }),
                  }}
                >
                  {document.parseStatus}
                </span>
            </div>
            {document.upload && (
              <>
                <div>
                    <h3 style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255, 255, 255, 0.7)", marginBottom: "8px" }}>File Size</h3>
                    <p style={{ color: "#eaeaea", fontSize: "14px", fontWeight: 500 }}>{document.upload.sizeBytes?.toLocaleString()} bytes</p>
                </div>
                <div>
                    <h3 style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255, 255, 255, 0.7)", marginBottom: "8px" }}>Content Type</h3>
                    <p style={{ color: "#eaeaea", fontSize: "14px", fontWeight: 500 }}>{document.upload.contentType}</p>
                </div>
              </>
            )}
          </div>
          
          {document.parse_error && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "16px",
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "12px",
                }}
              >
                <h3 style={{ fontSize: "13px", fontWeight: 600, color: "#fca5a5", marginBottom: "8px" }}>Parse Error</h3>
                <p style={{ color: "#f87171", fontSize: "13px", margin: 0 }}>{document.parse_error}</p>
            </div>
            )}
          </div>

          {/* Statistics */}
          {stats && (
            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                background: "rgba(99, 102, 241, 0.1)",
                border: "1px solid rgba(99, 102, 241, 0.2)",
                borderRadius: "12px",
              }}
            >
              <h3 style={{ fontSize: "14px", fontWeight: 600, color: "#a5b4fc", marginBottom: "12px" }}>Document Statistics</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
                <div>
                  <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>Words:</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#eaeaea", marginLeft: "8px" }}>{stats.words.toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>Characters:</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#eaeaea", marginLeft: "8px" }}>{stats.characters.toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>Sentences:</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#eaeaea", marginLeft: "8px" }}>{stats.sentences.toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>Paragraphs:</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#eaeaea", marginLeft: "8px" }}>{stats.paragraphs.toLocaleString()}</span>
                </div>
                <div>
                  <span style={{ fontSize: "12px", color: "rgba(255, 255, 255, 0.6)" }}>Lines:</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#eaeaea", marginLeft: "8px" }}>{stats.lines.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "24px" }}>
          <Link
            to={`/documents/${document.id}`}
              style={{
                padding: "12px 20px",
                background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                border: "none",
                borderRadius: "12px",
                color: "white",
                fontWeight: 600,
                fontSize: "14px",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
                boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(59, 130, 246, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Open Workspace
          </Link>
          <button
            onClick={() => {
              navigator.clipboard.writeText(document.text);
              alert("Document text copied to clipboard!");
            }}
              style={{
                padding: "12px 20px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                color: "#eaeaea",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Text
          </button>
            <button
              onClick={handlePrint}
              style={{
                padding: "12px 20px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                color: "#eaeaea",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <div style={{ position: "relative" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const menu = window.document.getElementById('export-menu');
                  if (menu) {
                    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                  }
                }}
                style={{
                  padding: "12px 20px",
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  color: "#eaeaea",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
              <div
                id="export-menu"
                style={{
                  display: "none",
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: "8px",
                  background: "rgba(20, 20, 30, 0.95)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: "12px",
                  padding: "8px",
                  minWidth: "150px",
                  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
                  zIndex: 1000,
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              >
                <button
                  onClick={() => {
                    handleExport('json');
                    const menu = window.document.getElementById('export-menu');
                    if (menu) menu.style.display = 'none';
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    color: "#eaeaea",
                    fontSize: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => {
                    handleExport('txt');
                    const menu = window.document.getElementById('export-menu');
                    if (menu) menu.style.display = 'none';
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    color: "#eaeaea",
                    fontSize: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Export as TXT
                </button>
                <button
                  onClick={() => {
                    handleExport('md');
                    const menu = window.document.getElementById('export-menu');
                    if (menu) menu.style.display = 'none';
                  }}
                  style={{
                    width: "100%",
                    padding: "10px 16px",
                    background: "transparent",
                    border: "none",
                    borderRadius: "8px",
                    color: "#eaeaea",
                    fontSize: "14px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Export as Markdown
                </button>
              </div>
            </div>
          <Link
            to="/"
              style={{
                padding: "12px 20px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: "12px",
                color: "#eaeaea",
                fontWeight: 600,
                fontSize: "14px",
                textDecoration: "none",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.15)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Back to Home
          </Link>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(15, 15, 25, 0.95) 100%)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "20px",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05) inset",
        }}
      >
        <div
          style={{
            padding: "24px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "linear-gradient(135deg, rgba(30, 30, 40, 0.5) 0%, rgba(20, 20, 30, 0.3) 100%)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#eaeaea", margin: 0 }}>Document Content</h2>
            
            {/* Search Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 300px", minWidth: "300px", maxWidth: "500px" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Search in document..."
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    paddingRight: searchQuery ? "80px" : "12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    background: "rgba(0, 0, 0, 0.3)",
                    color: "#eaeaea",
                    fontSize: "14px",
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.shiftKey) {
                      handlePrevMatch();
                    } else if (e.key === 'Enter') {
                      handleNextMatch();
                    }
                  }}
                />
                {searchQuery && searchMatches.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "12px",
                      color: "rgba(255, 255, 255, 0.6)",
                    }}
                  >
                    <span>
                      {searchIndex + 1} / {searchMatches.length}
                    </span>
                    <button
                      onClick={handlePrevMatch}
                      style={{
                        padding: "4px 8px",
                        background: "rgba(255, 255, 255, 0.1)",
                        border: "none",
                        borderRadius: "4px",
                        color: "#eaeaea",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                      title="Previous (Shift+Enter)"
                    >
                      ↑
                    </button>
                    <button
                      onClick={handleNextMatch}
                      style={{
                        padding: "4px 8px",
                        background: "rgba(255, 255, 255, 0.1)",
                        border: "none",
                        borderRadius: "4px",
                        color: "#eaeaea",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                      title="Next (Enter)"
                    >
                      ↓
                    </button>
                  </div>
                )}
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    padding: "10px 12px",
                    background: "rgba(255, 255, 255, 0.1)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    color: "#eaeaea",
                    cursor: "pointer",
                    fontSize: "14px",
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
        <div style={{ padding: "32px" }}>
          <div style={{ maxHeight: "600px", overflowY: "auto" }} ref={contentRef}>
            <div
              data-search-content
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: "1.8",
                fontSize: "14px",
                fontFamily: "inherit",
                background: "rgba(0, 0, 0, 0.3)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "12px",
                padding: "24px",
                color: "#eaeaea",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2) inset",
              }}
            >
              {searchQuery.trim() ? (
                highlightSearch(document.text || "", searchQuery).map((part, idx) => (
                  <span
                    key={idx}
                    style={part.highlighted ? {
                      background: "rgba(99, 102, 241, 0.4)",
                      color: "#c7d2fe",
                      fontWeight: 600,
                      padding: "2px 4px",
                      borderRadius: 4,
                    } : {}}
                  >
                    {part.text}
                  </span>
                ))
              ) : (
                document.text || "No content available"
              )}
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
