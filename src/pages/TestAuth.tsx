import { useState } from "react";
import { login, register, logout, me } from "../api/auth";

export default function TestAuth() {
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("test1234");
  const [out, setOut] = useState<any>(null);

  return (
    <div style={{ padding: 16, display: "grid", gap: 8, maxWidth: 420 }}>
      <h2>Auth test</h2>

      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />

      <button
        onClick={async () => {
          const r = await register(email, password);
          setOut(r);
        }}
      >
        Register
      </button>

      <button
        onClick={async () => {
          const r = await login(email, password);
          setOut(r);
        }}
      >
        Login
      </button>

      <button
        onClick={async () => {
          const r = await me();
          setOut(r);
        }}
      >
        Me (protected)
      </button>

      <button
        onClick={async () => {
          await logout();
          setOut({ ok: true, msg: "logged out" });
        }}
      >
        Logout
      </button>

      <pre style={{ background: "#111", color: "#eee", padding: 12, borderRadius: 8 }}>
        {JSON.stringify(out, null, 2)}
      </pre>
    </div>
  );
}
