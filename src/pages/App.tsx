// src/pages/App.tsx
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "../auth/ProtectedRoute";
import Login from "./Login";
import Home from "./Home";
import SegmentDetails from "./SegmentDetails";
import DocumentWorkspace from "./DocumentWorkspace";
import DocumentViewer from "./DocumentViewer";

export default function App() {
  return (
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
  );
}
