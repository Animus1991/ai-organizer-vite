// src/api/apiClient.ts
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "../auth/tokenStore";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.toString() || "http://127.0.0.1:8000";

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false, // true μόνο αν πας σε httpOnly cookies (όχι τώρα)
});

// ---- Refresh lock (ώστε αν πέσουν 10 requests μαζί με 401, να κάνει 1 refresh)
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }

  // POST /api/auth/refresh  body: { refresh_token }
  const res = await axios.post(
    `${API_BASE_URL}/api/auth/refresh`,
    { refresh_token: refreshToken },
    { headers: { "Content-Type": "application/json" } }
  );

  const { access_token, refresh_token, token_type } = res.data as {
    access_token: string;
    refresh_token: string;
    token_type?: string;
  };

  setTokens({
    accessToken: access_token,
    refreshToken: refresh_token,
    tokenType: token_type ?? "bearer",
  });

  return access_token;
}

// ---- Request interceptor: βάζει Bearer access token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---- Response interceptor: αν 401 -> refresh -> retry
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (!original) return Promise.reject(error);

    const status = error.response?.status;

    // ΜΗΝ κάνεις refresh loop αν το ίδιο το refresh αποτύχει ή αν είσαι ήδη σε refresh endpoint
    const url = original.url ?? "";
    const isAuthRefreshCall = url.includes("/api/auth/refresh");
    const isAuthLoginCall = url.includes("/api/auth/login");
    const isAuthRegisterCall = url.includes("/api/auth/register");

    if (status !== 401 || original._retry || isAuthRefreshCall || isAuthLoginCall || isAuthRegisterCall) {
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      // Αν δεν υπάρχει active refresh, ξεκίνα ένα. Αλλιώς περίμενε το ίδιο.
      if (!refreshPromise) {
        refreshPromise = refreshAccessToken().finally(() => {
          refreshPromise = null;
        });
      }

      const newAccess = await refreshPromise;

      // βάλε νέο token και ξαναστείλε το request
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${newAccess}`;

      return api.request(original);
    } catch (e) {
      // refresh failed -> καθάρισε tokens (force re-login)
      clearTokens();
      return Promise.reject(e);
    }
  }
);
