// src/api/apiClient.ts
// ✅ Consolidated: Uses refresh mechanism from lib/api.ts (single source of truth)
import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { getAccessToken, refreshTokens, clearTokens } from "../lib/api";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.toString() || "http://127.0.0.1:8000";

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

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
      // ✅ Use consolidated refresh mechanism from lib/api.ts
      const newAccess = await refreshTokens();

      if (!newAccess) {
        // Refresh failed -> clear tokens, dispatch event, and reject
        clearTokens();
        window.dispatchEvent(new CustomEvent('auth:token-expired'));
        return Promise.reject(error);
      }

      // βάλε νέο token και ξαναστείλε το request
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${newAccess}`;

      return api.request(original);
    } catch (e) {
      // refresh failed -> καθάρισε tokens (force re-login)
      clearTokens();
      window.dispatchEvent(new CustomEvent('auth:token-expired'));
      return Promise.reject(e);
    }
  }
);
