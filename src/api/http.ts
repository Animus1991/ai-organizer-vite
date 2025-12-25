// src/api/http.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL?.toString() || "http://127.0.0.1:8000";

export const ACCESS_TOKEN_KEY = "aiorg_access_token";
export const REFRESH_TOKEN_KEY = "aiorg_refresh_token";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  // withCredentials: false,
});

function isAuthEndpoint(url?: string) {
  if (!url) return false;
  // axios config.url μπορεί να είναι relative (/api/...) ή absolute
  return (
    url.includes("/api/auth/login") ||
    url.includes("/api/auth/register") ||
    url.includes("/api/auth/refresh") ||
    url.includes("/api/auth/logout")
  );
}

// --- Attach Bearer token on requests (EXCEPT auth endpoints)
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  const url = config.url;

  if (token && !isAuthEndpoint(url)) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// --- Auto refresh on 401 (EXCEPT auth endpoints)
let isRefreshing = false;
let refreshWaiters: Array<(token: string | null) => void> = [];

function notifyRefreshWaiters(token: string | null) {
  refreshWaiters.forEach((cb) => cb(token));
  refreshWaiters = [];
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  // Swagger: JSON body { refresh_token: "..." }
  const res = await axios.post(
    `${API_BASE_URL}/api/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: { "Content-Type": "application/json", Accept: "application/json" } }
  );

  const newAccess = (res.data as any)?.access_token;
  const newRefresh = (res.data as any)?.refresh_token ?? refreshToken;

  if (!newAccess) return null;

  setTokens(newAccess, newRefresh);
  return newAccess;
}

http.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as any;
    const url = original?.url as string | undefined;

    // ΜΗΝ κάνεις refresh logic αν είναι auth endpoint (ειδικά /login)
    if (isAuthEndpoint(url)) {
      throw err;
    }

    if (err.response?.status === 401 && !original?._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshWaiters.push((token) => {
            if (!token) return reject(err);
            original.headers = original.headers ?? {};
            original.headers.Authorization = `Bearer ${token}`;
            resolve(http.request(original));
          });
        });
      }

      isRefreshing = true;
      try {
        const token = await refreshAccessToken();
        notifyRefreshWaiters(token);

        if (!token) {
          clearTokens();
          throw err;
        }

        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return http.request(original);
      } catch (e) {
        notifyRefreshWaiters(null);
        clearTokens();
        throw e;
      } finally {
        isRefreshing = false;
      }
    }

    throw err;
  }
);
