// src/pages/App.tsx
import React, { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../auth/ProtectedRoute";
import Login from "./Login";

// Lazy load heavy components for better performance
const Home = lazy(() => import("./Home"));
const SegmentDetails = lazy(() => import("./SegmentDetails"));
const DocumentWorkspace = lazy(() => import("./DocumentWorkspace"));
const DocumentViewer = lazy(() => import("./DocumentViewer"));

// Loading fallback component
const LoadingFallback = () => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, rgba(20, 20, 30, 0.95) 0%, rgba(15, 15, 25, 0.95) 100%)",
      color: "#eaeaea",
    }}
  >
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          width: "48px",
          height: "48px",
          border: "4px solid rgba(255, 255, 255, 0.1)",
          borderTopColor: "#6366f1",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          margin: "0 auto 16px",
        }}
      />
      <p style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.6)" }}>Loading...</p>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Protected area */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Home />} />
          <Route path="/segments/:segmentId" element={<SegmentDetails />} />
          <Route path="/documents/:documentId/view" element={<DocumentViewer />} />
          <Route path="/documents/:documentId" element={<DocumentWorkspace />} />
        </Route>

        {/* fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
