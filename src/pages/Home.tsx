// src/pages/Home.tsx
import React from "react";
import { useAuth } from "../auth/AuthProvider";

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div style={{ padding: 24 }}>
      <h1>AI Organizer</h1>
      <p>Logged in as: <b>{user?.email}</b></p>

      <button onClick={logout} style={{ padding: 10, cursor: "pointer" }}>
        Logout
      </button>

      <hr style={{ margin: "24px 0" }} />

      <p>Next quest: Upload → Segment → List Segments (θα το βάλουμε εδώ μετά)</p>
    </div>
  );
}
