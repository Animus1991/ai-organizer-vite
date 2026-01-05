import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export default function TestAuth() {
  const { login, logout: authLogout, user } = useAuth();
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("test1234");
  const [out, setOut] = useState<any>(null);

  async function handleLogin() {
    try {
      await login(email, password);
      setOut({ ok: true, msg: "Login successful", user: user?.email });
    } catch (error: any) {
      setOut({ ok: false, msg: error.message });
    }
  }

  async function handleLogout() {
    try {
      await authLogout();
      setOut({ ok: true, msg: "Logout successful" });
    } catch (error: any) {
      setOut({ ok: false, msg: error.message });
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 8, maxWidth: 420 }}>
      <h2>Auth test</h2>

      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email" />
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="password" type="password" />

      <button onClick={handleLogin}>
        Login
      </button>

      <button onClick={handleLogout}>
        Logout
      </button>

      <div style={{ opacity: 0.7 }}>
        Current user: {user?.email || "Not logged in"}
      </div>

      <pre style={{ background: "#111", color: "#eee", padding: 12, borderRadius: 8 }}>
        {JSON.stringify(out, null, 2)}
      </pre>
    </div>
  );
}
