// src/api/auth.ts
import axios from "axios";
import { api } from "./apiClient";
import { setTokens, clearTokens, getRefreshToken } from "../lib/api";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.toString() || "http://127.0.0.1:8000";

export async function register(email: string, password: string) {
  const res = await axios.post(
    `${API_BASE_URL}/api/auth/register`,
    { email, password },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data as { ok: boolean; userId: number };
}

export async function login(email: string, password: string) {
  // OAuth2PasswordRequestForm => x-www-form-urlencoded: username=...&password=...
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  const res = await axios.post(`${API_BASE_URL}/api/auth/login`, body, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  // ✅ Backend now returns camelCase (accessToken, refreshToken)
  const { accessToken, refreshToken, tokenType } = res.data as {
    accessToken?: string;
    refreshToken?: string;
    tokenType?: string;
    // Backward compatibility
    access_token?: string;
    refresh_token?: string;
    token_type?: string;
  };

  // Use camelCase if available, fallback to snake_case for backward compatibility
  const access = accessToken ?? (res.data as any).access_token;
  const refresh = refreshToken ?? (res.data as any).refresh_token;
  
  if (access && refresh) {
    setTokens(access, refresh);
  }

  return res.data;
}

export async function logout() {
  const refreshToken = getRefreshToken();

  if (refreshToken) {
    try {
      await axios.post(
        `${API_BASE_URL}/api/auth/logout`,
        { refresh_token: refreshToken },
        { headers: { "Content-Type": "application/json" } }
      );
    } catch {
      // ignore
    }
  }

  clearTokens();
}

export async function me() {
  // Χρησιμοποιεί auto Bearer + auto-refresh αν λήξει
  const res = await api.get("/api/auth/me");
  return res.data as { id: number; email: string };
}
