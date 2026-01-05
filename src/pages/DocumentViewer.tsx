// src/pages/DocumentViewer.tsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { getDocument, DocumentDTO } from "../lib/api";

export default function DocumentViewer() {
  const { documentId } = useParams<{ documentId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [document, setDocument] = useState<DocumentDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!documentId || !user) return;

    const loadDocument = async () => {
      try {
        setLoading(true);
        const doc = await getDocument(Number(documentId));
        setDocument(doc);
        setError(null);
      } catch (err: any) {
        setError(err.message || "Failed to load document");
      } finally {
        setLoading(false);
      }
    };

    loadDocument();
  }, [documentId, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-surface border border-border rounded-xl shadow-lg p-8">
          <div className="flex items-center gap-3">
            <svg className="animate-spin w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-primary font-medium">Loading document...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-surface border border-border rounded-xl shadow-lg p-8 max-w-md">
          <div className="text-center">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-primary mb-2">Document Not Found</h3>
            <p className="text-secondary mb-4">{error || "The requested document could not be loaded."}</p>
            <div className="flex gap-3 justify-center">
              <Link
                to="/"
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Back to Home
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors"
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
    <div className="min-h-screen bg-background" style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-primary">{document.title}</h1>
            {document.filename && (
              <p className="text-secondary">{document.filename}</p>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="bg-surface border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-primary mb-4">Document Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-secondary mb-2">Source Type</h3>
              <p className="text-primary capitalize">{document.source_type}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-secondary mb-2">Parse Status</h3>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  document.parse_status === 'ok' 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : document.parse_status === 'failed'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                }`}>
                  {document.parse_status}
                </span>
              </div>
            </div>
            {document.upload && (
              <>
                <div>
                  <h3 className="text-sm font-medium text-secondary mb-2">File Size</h3>
                  <p className="text-primary">{document.upload.size_bytes?.toLocaleString()} bytes</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-secondary mb-2">Content Type</h3>
                  <p className="text-primary">{document.upload.content_type}</p>
                </div>
              </>
            )}
          </div>
          
          {document.parse_error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <h3 className="text-sm font-medium text-red-400 mb-1">Parse Error</h3>
              <p className="text-red-300 text-sm">{document.parse_error}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 mb-8">
          <Link
            to={`/documents/${document.id}`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Open Workspace
          </Link>
          <button
            onClick={() => {
              navigator.clipboard.writeText(document.text);
              alert("Document text copied to clipboard!");
            }}
            className="px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Text
          </button>
          <Link
            to="/"
            className="px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-elevated transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>

      {/* Document Content */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="p-6 border-b border-border bg-gradient-to-r from-surface-elevated/30 to-surface-elevated/10">
          <h2 className="text-lg font-semibold text-primary">Document Content</h2>
        </div>
        <div className="p-6">
          <div className="max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap leading-relaxed text-sm font-mono bg-surface/50 p-4 rounded-lg border border-border/50">
              {document.text || "No content available"}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
