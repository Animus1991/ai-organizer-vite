// C:\Users\anast\PycharmProjects\AI_ORGANIZER_VITE\src\lib\api.ts
import { getErrorMessage, AppError } from './errorHandler';
import { requestDeduplicator, apiCache } from './cache';

const API_BASE = import.meta.env.VITE_API_BASE_URL?.toString() || "http://127.0.0.1:8000";

const ACCESS_KEY = "aiorg_access_token";
const REFRESH_KEY = "aiorg_refresh_token";

// Refresh lock to prevent race conditions
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

// ------------------------------
// Token helpers
// ------------------------------

export function getAccessToken(): string | null {
  // First try the current storage format
  const token = localStorage.getItem(ACCESS_KEY);
  if (token) return token;
  
  // Backward compatibility: try old tokenStore format
  try {
    const oldTokens = localStorage.getItem("aiorg_tokens_v1");
    if (oldTokens) {
      const parsed = JSON.parse(oldTokens);
      if (parsed?.accessToken) {
        // Migrate to new format
        setTokens(parsed.accessToken, parsed.refreshToken || "");
        return parsed.accessToken;
      }
    }
  } catch {
    // ignore
  }
  
  return null;
}

export function getRefreshToken(): string | null {
  // First try the current storage format
  const token = localStorage.getItem(REFRESH_KEY);
  if (token) return token;
  
  // Backward compatibility: try old tokenStore format
  try {
    const oldTokens = localStorage.getItem("aiorg_tokens_v1");
    if (oldTokens) {
      const parsed = JSON.parse(oldTokens);
      if (parsed?.refreshToken) {
        // Migrate to new format
        setTokens(parsed.accessToken || "", parsed.refreshToken);
        return parsed.refreshToken;
      }
    }
  } catch {
    // ignore
  }
  
  return null;
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  // Also clear old tokenStore format for backward compatibility
  localStorage.removeItem("aiorg_tokens_v1");
}

export async function refreshTokens(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  // Set lock and create refresh promise
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      // ✅ Backend now returns camelCase (accessToken, refreshToken)
      if (data?.accessToken && data?.refreshToken) {
        setTokens(data.accessToken, data.refreshToken);
        return data.accessToken as string;
      } else if (data?.access_token && data?.refresh_token) {
        // Backward compatibility: handle old snake_case format
        setTokens(data.access_token, data.refresh_token);
        return data.access_token as string;
      }
      return null;
    } catch {
      return null;
    } finally {
      // Clear lock after completion
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Auth-aware fetch with request deduplication and caching:
 * - Sends Authorization: Bearer <access_token>
 * - If 401, refresh once, retry once
 * - Deduplicates identical requests (same URL + method + body)
 * - Caches GET requests for better performance
 */
export async function authFetch(path: string, init: RequestInit = {}) {
  if (path.startsWith("http")) {
    // Full URL, use as-is
    var url = path;
  } else {
    // Relative path - ensure it starts with /api
    const normalized = path.startsWith("/") ? path : `/${path}`;
    const apiPath = normalized.startsWith("/api") ? normalized : `/api${normalized}`;
    url = `${API_BASE}${apiPath}`;
  }

  const method = init.method || 'GET';
  const isGet = method === 'GET';
  
  // Create cache/deduplication key from URL, method, and body
  const bodyKey = init.body ? (typeof init.body === 'string' ? init.body : JSON.stringify(init.body)) : '';
  const dedupeKey = `fetch:${method}:${url}:${bodyKey}`;
  const cacheKey = isGet ? `cache:${url}` : null;

  // For GET requests, check cache first
  if (isGet && cacheKey) {
    const cached = apiCache.get(cacheKey);
    if (cached) {
      // Return cached response as a Response-like object
      return new Response(JSON.stringify(cached), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // Use deduplication to prevent duplicate requests
  return requestDeduplicator.dedupe(dedupeKey, async () => {
    const doFetch = (token: string | null) => {
      const headers = new Headers(init.headers || {});
      headers.set("Accept", headers.get("Accept") || "application/json");
      if (token) headers.set("Authorization", `Bearer ${token}`);
      return fetch(url, { ...init, headers });
    };

    let res = await doFetch(getAccessToken());

    if (res.status === 401) {
      const newAccess = await refreshTokens();
      if (newAccess) res = await doFetch(newAccess);
    }

    // Cache successful GET responses
    if (isGet && res.ok && cacheKey) {
      try {
        const data = await res.clone().json();
        apiCache.set(cacheKey, data);
      } catch {
        // If response is not JSON, don't cache
      }
    }

    // Invalidate cache for mutations (POST, PUT, DELETE, PATCH)
    if (!isGet && res.ok) {
      // Clear related caches based on the endpoint
      if (url.includes('/uploads') || url.includes('/upload')) {
        apiCache.delete('cache:' + API_BASE + '/api/uploads');
      }
      if (url.includes('/documents/') && url.includes('/segments')) {
        const docIdMatch = url.match(/\/documents\/(\d+)/);
        if (docIdMatch) {
          const docId = docIdMatch[1];
          // Clear segments cache for this document
          apiCache.delete(`cache:${API_BASE}/api/documents/${docId}/segments`);
          apiCache.delete(`cache:${API_BASE}/api/documents/${docId}/segments?mode=qa`);
          apiCache.delete(`cache:${API_BASE}/api/documents/${docId}/segments?mode=paragraphs`);
        }
      }
      if (url.includes('/documents/') && !url.includes('/segments')) {
        const docIdMatch = url.match(/\/documents\/(\d+)/);
        if (docIdMatch) {
          const docId = docIdMatch[1];
          apiCache.delete(`cache:${API_BASE}/api/documents/${docId}`);
        }
      }
    }

    return res;
  });
}

// ------------------------------
// Auth
// ------------------------------

export async function login(email: string, password: string) {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = `Login failed (${res.status})`;
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    const error = new AppError(
      errorMessage,
      res.status,
      'LOGIN_FAILED'
    );
    throw error;
  }

  const data = await res.json();
  // ✅ Backend now returns camelCase (accessToken, refreshToken)
  if (data?.accessToken && data?.refreshToken) {
    setTokens(data.accessToken, data.refreshToken);
  } else if (data?.access_token && data?.refresh_token) {
    // Backward compatibility: handle old snake_case format
    setTokens(data.access_token, data.refresh_token);
  }
  return data;
}

export async function logout(refreshToken?: string | null) {
  if (!refreshToken) return;
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    // no-op
  }
}

// ------------------------------
// DTOs
// ------------------------------

export type UploadItemDTO = {
  uploadId: number;
  documentId: number;
  filename: string;
  sizeBytes: number;
  contentType: string;
  parseStatus: "ok" | "failed" | "pending" | string;
  parseError?: string | null;
};

export type UploadResponseDTO = {
  uploadId: number;
  documentId: number;
  sourceType: string;
  filename: string;
  deduped?: boolean;

  parseStatus: "ok" | "failed" | "pending" | string;
  parseError?: string | null;
  processedPath?: string | null;
};

export type SegmentDTO = {
  id: number;
  orderIndex: number;
  mode: "qa" | "paragraphs" | string;
  title: string;
  content: string;
  start?: number;
  end?: number;
  createdAt?: string | null;
  isManual?: boolean;
};

export type SegmentationSummary = {
  mode: "qa" | "paragraphs";
  count: number;
  lastSegmentedAt?: string | null;
};

export type DocumentDTO = {
  id: number;
  title?: string;
  filename?: string | null;
  sourceType?: string; // ✅ Standardized to camelCase

  text: string;

  parseStatus?: "ok" | "failed" | "pending" | string; // ✅ Standardized to camelCase
  parseError?: string | null; // ✅ Standardized to camelCase
  processedPath?: string | null; // ✅ Standardized to camelCase

  upload?: {
    id?: number | null;
    contentType?: string | null; // ✅ Standardized to camelCase
    sizeBytes?: number | null; // ✅ Standardized to camelCase
    storedPath?: string | null; // ✅ Standardized to camelCase
  };
};

export type SegmentsListMeta = {
  count: number;
  mode: string; // "qa" | "paragraphs" | "all"
  lastRun?: string | null; // ✅ Standardized to camelCase
};

export type SegmentsListResponse = {
  items: SegmentDTO[];
  meta: SegmentsListMeta;
};

export type SegmentPatchDTO = {
  title?: string | null;
  start?: number | null;
  end?: number | null;
  content?: string | null;
};

export type DocumentPatchDTO = {
  title?: string | null;
  text?: string | null;
};

// ------------------------------
// Uploads
// ------------------------------

export async function listUploads(): Promise<UploadItemDTO[]> {
  const res = await authFetch(`/uploads`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to load uploads: ${res.status} ${txt}`);
  }
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? (data as UploadItemDTO[]) : [];
}

export async function uploadFile(file: File): Promise<UploadResponseDTO> {
  const form = new FormData();
  form.append("file", file);

  const res = await authFetch(`/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Upload failed: ${res.status} ${txt}`);
  }

  return (await res.json()) as UploadResponseDTO;
}

export async function deleteUpload(uploadId: number) {
  const res = await authFetch(`/uploads/${uploadId}`, { method: "DELETE" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Delete failed: ${res.status} ${txt}`);
  }
  return res.json().catch(() => ({}));
}

// ------------------------------
// Segments
// ------------------------------

export async function segmentDocument(documentId: number, mode: "qa" | "paragraphs") {
  const res = await authFetch(`/documents/${documentId}/segment?mode=${encodeURIComponent(mode)}`, {
    method: "POST",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Segment failed: ${res.status} ${txt}`);
  }

  return res.json().catch(() => ({}));
}

// meta-aware list
export async function listSegmentsWithMeta(documentId: number, mode?: "qa" | "paragraphs") {
  const qs = mode ? `?mode=${encodeURIComponent(mode)}` : "";
  const res = await authFetch(`/documents/${documentId}/segments${qs}`);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`List failed: ${res.status} ${txt}`);
  }

  const data = (await res.json().catch(() => ({}))) as any;

  if (Array.isArray(data)) {
    return {
      items: data as SegmentDTO[],
      meta: { count: (data as any[]).length, mode: mode ?? "all", lastRun: null },
    } as SegmentsListResponse;
  }

  return {
    items: Array.isArray(data?.items) ? (data.items as SegmentDTO[]) : [],
    meta: (data?.meta ?? { count: 0, mode: mode ?? "all", lastRun: null }) as SegmentsListMeta,
  } as SegmentsListResponse;
}

// compatibility old name (kept)
export async function listSegments(documentId: number, mode?: "qa" | "paragraphs"): Promise<SegmentsListResponse> {
  return listSegmentsWithMeta(documentId, mode);
}

export async function patchSegment(segmentId: number, patch: SegmentPatchDTO): Promise<SegmentDTO> {
  const res = await authFetch(`/segments/${segmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Patch segment failed: ${res.status} ${txt}`);
  }

  return (await res.json()) as SegmentDTO;
}

/**
 * IMPORTANT: Backward-compatible export.
 * Some screens import patchManualSegment(). We keep it so the app doesn't blank-screen.
 */
export async function patchManualSegment(
  segmentId: number,
  payload: { title?: string | null; start?: number | null; end?: number | null }
): Promise<SegmentDTO> {
  const body: SegmentPatchDTO = {};
  if (payload.title !== undefined) body.title = payload.title;
  if (payload.start !== undefined) body.start = payload.start;
  if (payload.end !== undefined) body.end = payload.end;
  return patchSegment(segmentId, body);
}

export async function listSegmentations(documentId: number): Promise<SegmentationSummary[]> {
  const res = await authFetch(`/documents/${documentId}/segmentations`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to load segmentations (${res.status})`);
  }
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? (data as SegmentationSummary[]) : [];
}

export async function deleteSegments(documentId: number, mode?: "qa" | "paragraphs") {
  const qs = mode ? `?mode=${encodeURIComponent(mode)}` : "";
  const res = await authFetch(`/documents/${documentId}/segments${qs}`, { method: "DELETE" });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Delete segments failed: ${res.status} ${txt}`);
  }

  return res.json().catch(() => ({}));
}

export async function createManualSegment(
  documentId: number,
  payload: { mode: "qa" | "paragraphs"; title?: string | null; start: number; end: number }
) {
  const res = await authFetch(`/documents/${documentId}/segments/manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Manual segment failed: ${res.status} ${txt}`);
  }

  return (await res.json()) as SegmentDTO;
}

export async function deleteSegment(segmentId: number) {
  const res = await authFetch(`/segments/${segmentId}`, { method: "DELETE" });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Delete segment failed: ${res.status} ${txt}`);
  }

  return res.json().catch(() => ({}));
}

// ------------------------------
// Documents
// ------------------------------

export async function getDocument(documentId: number): Promise<DocumentDTO> {
  const res = await authFetch(`/documents/${documentId}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to load document (${res.status})`);
  }

  const data = await res.json().catch(() => ({}));
  // ✅ Backend returns camelCase, frontend DTO now matches exactly - no mapping needed
  return {
    id: Number((data as any).id ?? documentId),
    title: (data as any).title ?? undefined,
    filename: (data as any).filename ?? null,
    sourceType: (data as any).sourceType ?? undefined,

    text: String((data as any).text ?? ""),

    parseStatus: (data as any).parseStatus ?? undefined,
    parseError: (data as any).parseError ?? null,
    processedPath: (data as any).processedPath ?? null,

    upload: (data as any).upload
      ? {
          id: (data as any).upload.id ?? null,
          contentType: (data as any).upload.contentType ?? null,
          sizeBytes: (data as any).upload.sizeBytes ?? null,
          storedPath: (data as any).upload.storedPath ?? null,
        }
      : undefined,
  };
}

export async function patchDocument(documentId: number, patch: DocumentPatchDTO): Promise<DocumentDTO> {
  const res = await authFetch(`/documents/${documentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(patch),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Patch document failed: ${res.status} ${txt}`);
  }

  const data = await res.json().catch(() => ({}));
  // ✅ Backend returns camelCase, frontend DTO now matches exactly - no mapping needed
  return {
    id: Number((data as any).id ?? documentId),
    title: (data as any).title ?? undefined,
    filename: (data as any).filename ?? null,
    sourceType: (data as any).sourceType ?? undefined,

    text: String((data as any).text ?? ""),

    parseStatus: (data as any).parseStatus ?? undefined,
    parseError: (data as any).parseError ?? null,
    processedPath: (data as any).processedPath ?? null,

    upload: (data as any).upload
      ? {
          id: (data as any).upload.id ?? null,
          contentType: (data as any).upload.contentType ?? null,
          sizeBytes: (data as any).upload.sizeBytes ?? null,
          storedPath: (data as any).upload.storedPath ?? null,
        }
      : undefined,
  };
}

export async function getSegment(segmentId: number) {
  const res = await authFetch(`/segments/${segmentId}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to load segment (${res.status})`);
  }
  return (await res.json()) as SegmentDTO;
}

// Search API
export interface SearchResultItem {
  id: number;
  type: "document" | "segment";
  documentId: number | null;
  title: string;
  content: string;
  score: number | null;
  mode: string | null;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  total: number;
}

export async function search(
  query: string,
  options?: {
    type?: "document" | "segment";
    mode?: "qa" | "paragraphs";
    limit?: number;
    offset?: number;
  }
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (options?.type) params.append("type", options.type);
  if (options?.mode) params.append("mode", options.mode);
  if (options?.limit) params.append("limit", String(options.limit));
  if (options?.offset) params.append("offset", String(options.offset));

  const response = await authFetch(`/api/search?${params.toString()}`);
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new AppError(error.message || "Search failed", error.code || response.status);
  }
  return await response.json();
}
