// src/lib/api.ts

const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "http://127.0.0.1:8000/api";

const ACCESS_KEY = "aiorg_access_token";
const REFRESH_KEY = "aiorg_refresh_token";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function refreshTokens(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data.access_token as string;
}

/**
 * Auth-aware fetch:
 * - Always sends Authorization: Bearer <access_token>
 * - If 401, tries refresh once, then retries once
 */
export async function authFetch(path: string, init: RequestInit = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  let access = getAccessToken();

  const doFetch = (token: string | null) => {
    const headers = new Headers(init.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    // ΜΗΝ βάζεις Content-Type χειροκίνητα όταν στέλνεις FormData
    return fetch(url, { ...init, headers });
  };

  let res = await doFetch(access);

  if (res.status === 401) {
    const newAccess = await refreshTokens();
    if (newAccess) res = await doFetch(newAccess);
  }

  return res;
}

export async function login(email: string, password: string) {
  const body = new URLSearchParams();
  body.set("username", email); // OAuth2PasswordRequestForm expects username
  body.set("password", password);

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Login failed");
  }

  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
  return data;
}

// ------------------------------
// Segments API helpers
// ------------------------------

export async function segmentDocument(
  documentId: number,
  mode: "qa" | "paragraphs"
) {
  const res = await authFetch(`/documents/${documentId}/segment?mode=${mode}`, {
    method: "POST",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Segment failed: ${res.status} ${txt}`);
  }

  return res.json().catch(() => ({}));
}

export type SegmentDTO = {
  id: number;
  orderIndex: number;
  mode: string;
  title: string;
  content: string;
  start?: number;
  end?: number;
};

export async function listSegments(documentId: number, mode?: "qa" | "paragraphs") {
  const qs = mode ? `?mode=${mode}` : "";
  const res = await authFetch(`/documents/${documentId}/segments${qs}`);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`List failed: ${res.status} ${txt}`);
  }

  const data = await res.json().catch(() => []);
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  return items as SegmentDTO[];
}
