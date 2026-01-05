// C:\Users\anast\PycharmProjects\AI_ORGANIZER_VITE\src\lib\api.ts
import { getErrorMessage, AppError } from './errorHandler';
const API_BASE = "http://127.0.0.1:8000/api";

// Debug: Check if API_BASE is correct
if (typeof window !== 'undefined') {
  console.log('🔍 API Configuration Debug:');
  console.log('  API_BASE:', API_BASE);
  console.log('  VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
  console.log('  Full login URL will be:', `${API_BASE}/api/auth/login`);
}

const ACCESS_KEY = "aiorg_access_token";
const REFRESH_KEY = "aiorg_refresh_token";

// Refresh lock to prevent race conditions
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

// ------------------------------
// Token helpers
// ------------------------------

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

  // If already refreshing, return the existing promise
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  // Set lock and create refresh promise
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      if (data?.access_token && data?.refresh_token) {
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
 * Auth-aware fetch:
 * - Sends Authorization: Bearer <access_token>
 * - If 401, refresh once, retry once
 */
export async function authFetch(path: string, init: RequestInit = {}) {
  const normalized = path.startsWith("http")
    ? path
    : path.startsWith("/")
      ? path
      : `/${path}`;

  const url = path.startsWith("http") ? path : `${API_BASE}${normalized}`;

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

  return res;
}

// ------------------------------
// Auth
// ------------------------------

export async function login(email: string, password: string) {
  const body = new URLSearchParams();
  body.set("username", email);
  body.set("password", password);

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const error = new AppError(
      getErrorMessage({ response: res }),
      res.status,
      'LOGIN_FAILED'
    );
    throw error;
  }

  const data = await res.json();
  if (data?.access_token && data?.refresh_token) {
    setTokens(data.access_token, data.refresh_token);
  }
  return data;
}

export async function logout(refreshToken?: string | null) {
  if (!refreshToken) return;
  try {
    await fetch(`${API_BASE}/auth/logout`, {
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
  source_type?: string;

  text: string;

  parse_status?: "ok" | "failed" | "pending" | string;
  parse_error?: string | null;
  processed_path?: string | null;

  upload?: {
    id?: number | null;
    content_type?: string | null;
    size_bytes?: number | null;
    stored_path?: string | null;
  };
};

export type SegmentsListMeta = {
  count: number;
  mode: string; // "qa" | "paragraphs" | "all"
  last_run?: string | null;
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
      meta: { count: (data as any[]).length, mode: mode ?? "all", last_run: null },
    } as SegmentsListResponse;
  }

  return {
    items: Array.isArray(data?.items) ? (data.items as SegmentDTO[]) : [],
    meta: (data?.meta ?? { count: 0, mode: mode ?? "all", last_run: null }) as SegmentsListMeta,
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
  return {
    id: Number((data as any).id ?? documentId),
    title: (data as any).title ?? undefined,
    filename: (data as any).filename ?? null,
    source_type: (data as any).source_type ?? undefined,

    text: String((data as any).text ?? ""),

    parse_status: (data as any).parse_status ?? undefined,
    parse_error: (data as any).parse_error ?? null,
    processed_path: (data as any).processed_path ?? null,

    upload: (data as any).upload ?? undefined,
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
  return {
    id: Number((data as any).id ?? documentId),
    title: (data as any).title ?? undefined,
    filename: (data as any).filename ?? null,
    source_type: (data as any).source_type ?? undefined,

    text: String((data as any).text ?? ""),

    parse_status: (data as any).parse_status ?? undefined,
    parse_error: (data as any).parse_error ?? null,
    processed_path: (data as any).processed_path ?? null,

    upload: (data as any).upload ?? undefined,
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
