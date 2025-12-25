// src/pages/Login.tsx
import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

type LocationState = { from?: { pathname?: string } };

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    try {
      // Στο backend σου (Swagger) το /api/auth/login θέλει OAuth2 "username" + "password".
      // Εδώ περνάμε email ως username.
      await login(email.trim(), password);
      const target = state?.from?.pathname ?? "/";
      navigate(target, { replace: true });
    } catch (err: any) {
      // FastAPI συνήθως: err.response.data.detail
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Invalid credentials";
      setError(String(msg));
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: 320,
          padding: 24,
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 10,
          background: "rgba(0,0,0,0.20)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Login</h2>

        <label style={{ display: "block", marginBottom: 6 }}>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          placeholder="user@example.com"
          style={{ width: "100%", marginBottom: 12, padding: 8 }}
        />

        <label style={{ display: "block", marginBottom: 6 }}>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          style={{ width: "100%", marginBottom: 16, padding: 8 }}
        />

        <button
          disabled={loading || !email.trim() || !password}
          type="submit"
          style={{
            width: "100%",
            padding: 10,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        {error && (
          <div style={{ marginTop: 12, color: "tomato" }}>{error}</div>
        )}
      </form>
    </div>
  );
}
