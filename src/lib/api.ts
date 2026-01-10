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
    } catch (error) {
      // Network errors (connection refused, timeout, etc.) - return null to indicate failure
      // Don't throw - caller should handle gracefully (e.g., not try to refresh if server is down)
      if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("Failed to fetch"))) {
        // Network error - backend is not available, don't retry
        return null;
      }
      // Other errors - also return null
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

  // NOTE: To avoid 'body stream already read' errors when multiple callers
  // share the same Response instance, we intentionally DO NOT use
  // requestDeduplicator.dedupe here. Each authFetch call performs its own
  // fetch and returns its own Response object. The lightweight GET cache
  // above still provides good performance.

  const doFetch = async (token: string | null) => {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", headers.get("Accept") || "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    try {
      return await fetch(url, { ...init, headers });
    } catch (error) {
      // Network errors (connection refused, timeout, etc.) - wrap in AppError for consistent handling
      // Callers like loadFolders() will catch this and gracefully fallback to localStorage
      if (error instanceof TypeError && (error.message.includes("fetch") || error.message.includes("Failed to fetch"))) {
        throw new AppError(
          `Network error: Could not connect to server. Is the backend running at ${API_BASE}?`,
          0, // Status 0 indicates network error (no HTTP response)
          'NETWORK_ERROR'
        );
      }
      throw error;
    }
  };

  let res: Response;
  try {
    res = await doFetch(getAccessToken());
  } catch (error) {
    // Network error (connection refused, timeout, etc.) - re-throw for caller to handle
    throw error;
  }

  if (res.status === 401) {
    const newAccess = await refreshTokens();
    if (newAccess) {
      try {
        res = await doFetch(newAccess);
      } catch (error) {
        // Network error during retry - re-throw
        throw error;
      }
    } else {
      // Refresh failed - token expired or invalid
      // Clear tokens and trigger logout
      clearTokens();
      // Dispatch custom event to notify AuthProvider
      window.dispatchEvent(new CustomEvent('auth:token-expired'));
      // Return the 401 response so caller can handle it
    }
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
    console.log("🗑️ authFetch: Invalidating cache for mutation", { method, url, status: res.status });
    
    // Clear related caches based on endpoint
    if (url.includes('/workspace/folders')) {
      // Clear folders cache for workspace operations
      // Handle both /workspace/folders (POST) and /workspace/documents/{docId}/folders (GET)
      console.log("🗑️ authFetch: Clearing folders cache", { url });
      const docIdMatch = url.match(/\/documents\/(\d+)\/folders/);
      if (docIdMatch) {
        const docId = docIdMatch[1];
        apiCache.delete(`cache:${API_BASE}/api/workspace/documents/${docId}/folders`);
      }
      // For POST /workspace/folders, we need to clear all document folders caches
      // The payload should contain documentId, but we can't access it here
      // So we clear all folder-related caches
      apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders`);
      apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/documents/`);
    }
    if (url.includes('/workspace/folder-items')) {
      // Clear folders cache when folder items change (add/remove chunks)
      // This includes: /workspace/folders (list), /workspace/folders/{id} (get), /workspace/documents/{id}/folders
      console.log("🗑️ authFetch: Clearing folder-items cache", { url });
      // For DELETE /workspace/folder-items/{itemId}, we need to clear ALL folder caches
      // because we can't determine which folder was affected without an extra API call
      // The folder-specific cache will be cleared by explicit calls in the code, but this is a safety net
      const itemIdMatch = url.match(/\/folder-items\/(\d+)/);
      if (itemIdMatch) {
        // DELETE operation - clear ALL folder-related caches to ensure fresh data
        // This is critical for foldering consistency after deletions
        apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders/`);
        apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders`);
        apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/documents/`);
      }
      // For POST /workspace/folder-items (create), also clear all folder caches
      // Clear all folder-related caches to ensure fresh data after any folder item mutation
      apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders/`);
      apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/folders`);
      apiCache.deleteByPrefix(`cache:${API_BASE}/api/workspace/documents/`);
    }
    if (url.includes('/uploads') || url.includes('/upload')) {
      // Clear all uploads cache variations (with/without query params)
      const baseCacheKey = 'cache:' + API_BASE + '/api/uploads';
      apiCache.deleteByPrefix(baseCacheKey);
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

// P2: Segment Type Enum (matches backend SegmentType)
export type SegmentType = 
  | "untyped"
  | "definition"
  | "assumption"
  | "claim"
  | "mechanism"
  | "prediction"
  | "counterargument"
  | "evidence"
  | "open_question"
  | "experiment"
  | "meta";

// P2: Evidence Grade Enum (matches backend EvidenceGrade)
export type EvidenceGrade = "E0" | "E1" | "E2" | "E3" | "E4";

// P2: Link Type Enum (matches backend LinkType)
export type LinkType = 
  | "supports"
  | "contradicts"
  | "depends_on"
  | "counterargument"
  | "evidence"
  | "related";

// P2: Segment Link Types
export type SegmentLinkDTO = {
  id: number;
  fromSegmentId: number;
  toSegmentId: number;
  linkType: LinkType;
  notes?: string | null;
  direction: "from" | "to"; // "from" = outgoing link, "to" = incoming link
  createdAt: string;
  createdByUserId: number;
};

export type SegmentLinksResponse = {
  segmentId: number;
  direction: "from" | "to" | "both";
  links: SegmentLinkDTO[];
  count: number;
};

export type SegmentLinkCreateDTO = {
  toSegmentId: number;
  linkType: LinkType;
  notes?: string | null;
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
  // P2: Research-Grade Fields (optional - may not exist if migration not run)
  segmentType?: SegmentType | null;
  evidenceGrade?: EvidenceGrade | null;
  falsifiabilityCriteria?: string | null;
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
  // P2: Research-Grade Fields
  segmentType?: SegmentType | null;
  evidenceGrade?: EvidenceGrade | null;
  falsifiabilityCriteria?: string | null;
};

export type DocumentPatchDTO = {
  title?: string | null;
  text?: string | null;
};

// ------------------------------
// Uploads
// ------------------------------

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
};

export async function listUploads(page: number = 1, pageSize: number = 50): Promise<PaginatedResponse<UploadItemDTO>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const res = await authFetch(`/uploads?${params.toString()}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to load uploads: ${res.status} ${txt}`);
  }
  const data = await res.json().catch(() => ({ items: [], total: 0, page: 1, pageSize: 50 }));
  
  // Backward compatibility: if response is array, wrap it
  if (Array.isArray(data)) {
    return {
      items: data as UploadItemDTO[],
      total: data.length,
      page: 1,
      pageSize: data.length,
    };
  }
  
  return data as PaginatedResponse<UploadItemDTO>;
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
export async function listSegments(
  documentId: number, 
  mode?: "qa" | "paragraphs",
  page: number = 1,
  pageSize: number = 100
): Promise<SegmentsListResponse> {
  return listSegmentsWithMeta(documentId, mode, page, pageSize);
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

// P2: Segment Linking API Functions
export async function createSegmentLink(fromSegmentId: number, link: SegmentLinkCreateDTO): Promise<SegmentLinkDTO> {
  const res = await authFetch(`/segments/${fromSegmentId}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(link),
  });
  
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Create segment link failed: ${res.status} ${txt}`);
  }
  
  const data = await res.json();
  return {
    id: data.id,
    fromSegmentId: data.fromSegmentId,
    toSegmentId: data.toSegmentId,
    linkType: data.linkType,
    notes: data.notes ?? null,
    direction: "from", // Newly created links are always "from"
    createdAt: data.createdAt,
    createdByUserId: data.createdByUserId,
  } as SegmentLinkDTO;
}

export async function getSegmentLinks(segmentId: number, direction: "from" | "to" | "both" = "both"): Promise<SegmentLinksResponse> {
  const params = new URLSearchParams({ direction });
  const res = await authFetch(`/segments/${segmentId}/links?${params.toString()}`);
  
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Get segment links failed: ${res.status} ${txt}`);
  }
  
  const data = await res.json();
  // Backend returns links with direction already set ("from" or "to")
  // "from" means this segment is the source (outgoing link)
  // "to" means this segment is the target (incoming link)
  return {
    segmentId: data.segmentId ?? segmentId,
    direction: data.direction ?? direction,
    links: (data.links ?? []).map((link: any) => ({
      id: link.id,
      fromSegmentId: link.fromSegmentId,
      toSegmentId: link.toSegmentId,
      linkType: link.linkType,
      notes: link.notes ?? null,
      direction: link.direction ?? (link.fromSegmentId === segmentId ? "from" : "to"), // Infer direction if missing
      createdAt: link.createdAt,
      createdByUserId: link.createdByUserId,
    })) as SegmentLinkDTO[],
    count: data.count ?? 0,
  } as SegmentLinksResponse;
}

export async function deleteSegmentLink(linkId: number): Promise<void> {
  const res = await authFetch(`/segment-links/${linkId}`, {
    method: "DELETE",
  });
  
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Delete segment link failed: ${res.status} ${txt}`);
  }
}

// ============================================================================
// Workspace API (Folders, Smart Notes, Document Notes)
// ============================================================================

export type FolderDTO = {
  id: number;
  name: string;
  documentId: number;
  createdAt: string;
  itemCount: number;
};

export type FolderItemDTO = {
  id: number;
  folderId: number;
  segmentId?: number | null;
  chunkId?: string | null;
  chunkTitle?: string | null;
  chunkContent?: string | null;
  chunkMode?: string | null;
  chunkIsManual?: boolean | null;
  chunkOrderIndex?: number | null;
  createdAt: string;
};

export type FolderWithItemsDTO = FolderDTO & {
  items: FolderItemDTO[];
};

export type SmartNoteDTO = {
  id: number;
  documentId: number;
  content: string;
  html: string;
  tags: string[];
  category: string;
  priority: string;
  chunkId?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type DocumentNoteDTO = {
  id: number;
  documentId: number;
  html: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

// Folders (workspace)
export async function listFolders(documentId: number): Promise<FolderDTO[]> {
  // Workspace router is mounted under /workspace
  const res = await authFetch(`/workspace/documents/${documentId}/folders`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to list folders (${res.status})`);
  }
  return (await res.json()) as FolderDTO[];
}

export async function getFolder(folderId: number, skipCache: boolean = false): Promise<FolderWithItemsDTO> {
  // If skipCache is true, clear cache before fetching to ensure fresh data
  // This is critical for foldering consistency after deletions
  if (skipCache) {
    const { apiCache } = await import("./cache");
    const API_BASE = import.meta.env.VITE_API_BASE_URL?.toString() || "http://127.0.0.1:8000";
    apiCache.delete(`cache:${API_BASE}/api/workspace/folders/${folderId}`);
  }
  
  const res = await authFetch(`/workspace/folders/${folderId}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to get folder (${res.status})`);
  }
  return (await res.json()) as FolderWithItemsDTO;
}

export async function createFolder(documentId: number, name: string): Promise<FolderDTO> {
  const res = await authFetch(`/workspace/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ documentId, name }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to create folder (${res.status})`);
  }
  return (await res.json()) as FolderDTO;
}

export async function updateFolder(folderId: number, name: string): Promise<FolderDTO> {
  const res = await authFetch(`/workspace/folders/${folderId}?name=${encodeURIComponent(name)}`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to update folder (${res.status})`);
  }
  return (await res.json()) as FolderDTO;
}

export async function deleteFolder(folderId: number): Promise<void> {
  const res = await authFetch(`/workspace/folders/${folderId}`, { method: "DELETE" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to delete folder (${res.status})`);
  }
}

export async function createFolderItem(payload: {
  folderId: number;
  segmentId?: number | null;
  chunkId?: string | null;
  chunkTitle?: string | null;
  chunkContent?: string | null;
  chunkMode?: string | null;
  chunkIsManual?: boolean | null;
  chunkOrderIndex?: number | null;
}): Promise<FolderItemDTO> {
  const res = await authFetch(`/workspace/folder-items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    // Handle 409 Conflict - item already in folder (not an error, just return existing item)
    if (res.status === 409) {
      // Item already exists - this is fine (idempotent operation)
      // Try to get the existing item for accurate response
      try {
        const folder = await getFolder(payload.folderId);
        const existingItem = folder.items.find(
          item => (payload.segmentId && item.segmentId === payload.segmentId) ||
                  (payload.chunkId && item.chunkId === payload.chunkId)
        );
        if (existingItem) {
          // Return existing item - operation successful (idempotent)
          return existingItem;
        }
      } catch (error) {
        // If we can't get the existing item, return minimal response
        // This is still OK - the item exists in the folder (409 confirmed it)
        console.debug(`409 Conflict: Item already in folder ${payload.folderId}, but couldn't fetch it. Treating as success (idempotent).`);
      }
      // Return minimal response - item exists, operation is idempotent
      return { id: 0, folderId: payload.folderId, segmentId: payload.segmentId ?? null, chunkId: payload.chunkId ?? null } as FolderItemDTO;
    }
    throw new Error(txt || `Failed to create folder item (${res.status})`);
  }
  return (await res.json()) as FolderItemDTO;
}

export interface DeleteFolderItemResponse {
  ok: boolean;
  folder_deleted: boolean;
  folder_id: number | null;
}

export async function deleteFolderItem(itemId: number): Promise<DeleteFolderItemResponse> {
  const res = await authFetch(`/workspace/folder-items/${itemId}`, { method: "DELETE" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to delete folder item (${res.status})`);
  }
  const data = await res.json();
  return {
    ok: data.ok ?? true,
    folder_deleted: data.folder_deleted ?? false,
    folder_id: data.folder_id ?? null,
  };
}

// Smart Notes (workspace)
export async function listSmartNotes(documentId: number): Promise<SmartNoteDTO[]> {
  const res = await authFetch(`/workspace/documents/${documentId}/smart-notes`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to list smart notes (${res.status})`);
  }
  return (await res.json()) as SmartNoteDTO[];
}

export async function createSmartNote(payload: {
  documentId: number;
  content: string;
  html: string;
  tags?: string[];
  category?: string;
  priority?: string;
  chunkId?: number | null;
}): Promise<SmartNoteDTO> {
  const res = await authFetch(`/workspace/smart-notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to create smart note (${res.status})`);
  }
  return (await res.json()) as SmartNoteDTO;
}

export async function updateSmartNote(
  noteId: number,
  payload: {
    content?: string;
    html?: string;
    tags?: string[];
    category?: string;
    priority?: string;
    chunkId?: number | null;
  }
): Promise<SmartNoteDTO> {
  const res = await authFetch(`/workspace/smart-notes/${noteId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to update smart note (${res.status})`);
  }
  return (await res.json()) as SmartNoteDTO;
}

export async function deleteSmartNote(noteId: number): Promise<void> {
  const res = await authFetch(`/workspace/smart-notes/${noteId}`, { method: "DELETE" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to delete smart note (${res.status})`);
  }
}

// Document Notes (workspace)
export async function getDocumentNote(documentId: number): Promise<DocumentNoteDTO | null> {
  const res = await authFetch(`/workspace/documents/${documentId}/note`);
  if (!res.ok) {
    if (res.status === 404) return null;
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to get document note (${res.status})`);
  }
  return (await res.json()) as DocumentNoteDTO | null;
}

export async function upsertDocumentNote(
  documentId: number,
  html: string,
  text: string
): Promise<DocumentNoteDTO> {
  const res = await authFetch(`/workspace/documents/${documentId}/note`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ html, text }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to upsert document note (${res.status})`);
  }
  return (await res.json()) as DocumentNoteDTO;
}

export async function deleteDocumentNote(documentId: number): Promise<void> {
  const res = await authFetch(`/workspace/documents/${documentId}/note`, { method: "DELETE" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to delete document note (${res.status})`);
  }
}

// Migration (workspace)
export async function migrateLocalStorageData(
  documentId: number,
  payload: {
    folders?: any[];
    folderMap?: Record<string, string>;
    duplicatedChunks?: any[];
    smartNotes?: any[];
    documentNote?: any;
  }
): Promise<{ ok: boolean; imported: any; message: string }> {
  const res = await authFetch(`/workspace/documents/${documentId}/migrate-localstorage`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ documentId, ...payload }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to migrate data (${res.status})`);
  }
  return (await res.json()) as { ok: boolean; imported: any; message: string };
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
  semantic?: boolean; // Whether semantic search was used
  variations?: string[]; // Query variations that were used
}

export async function search(
  query: string,
  options?: {
    type?: "document" | "segment";
    mode?: "qa" | "paragraphs";
    limit?: number;
    offset?: number;
    semantic?: boolean; // Enable semantic search
    lang?: "auto" | "el" | "en"; // Language for NLP processing
    expand_variations?: boolean; // Expand query with variations (plural/singular, synonyms, etc.)
  }
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (options?.type) params.append("type", options.type);
  if (options?.mode) params.append("mode", options.mode);
  if (options?.limit) params.append("limit", String(options.limit));
  if (options?.offset) params.append("offset", String(options.offset));
  if (options?.semantic !== undefined) params.append("semantic", String(options.semantic));
  if (options?.lang) params.append("lang", options.lang);
  if (options?.expand_variations !== undefined) params.append("expand_variations", String(options.expand_variations));

  const response = await authFetch(`/api/search?${params.toString()}`);
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new AppError(error.message || "Search failed", error.code || response.status);
  }
  return await response.json();
}

// ============================================================================
// Advanced Search: Custom Synonyms Management
// ============================================================================

export interface SynonymPair {
  word: string;
  synonym: string;
}

export interface SynonymListResponse {
  synonyms: Record<string, string[]>; // word -> list of synonyms
}

export interface SynonymResponse {
  ok: boolean;
  word: string;
  synonym: string;
  message?: string;
}

export async function addSynonym(word: string, synonym: string): Promise<SynonymResponse> {
  const response = await authFetch(`/api/search/synonyms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word, synonym }),
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new AppError(error.message || "Failed to add synonym", error.code || response.status);
  }
  return await response.json();
}

export async function removeSynonym(word: string, synonym: string): Promise<SynonymResponse> {
  const params = new URLSearchParams({ word, synonym });
  const response = await authFetch(`/api/search/synonyms?${params.toString()}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new AppError(error.message || "Failed to remove synonym", error.code || response.status);
  }
  return await response.json();
}

export async function listSynonyms(word?: string): Promise<SynonymListResponse> {
  const params = new URLSearchParams();
  if (word) params.append("word", word);
  const response = await authFetch(`/api/search/synonyms?${params.toString()}`);
  if (!response.ok) {
    const error = await parseApiError(response);
    throw new AppError(error.message || "Failed to list synonyms", error.code || response.status);
  }
  return await response.json();
}

// ============================================================================
// P3: Recycle Bin API (Soft Delete, Restore, Purge)
// ============================================================================

export type DeletedDocumentDTO = {
  id: number;
  title: string;
  filename: string;
  sourceType: string;
  deletedAt: string;
  upload: {
    id: number;
    contentType: string;
    sizeBytes: number;
  };
};

export type DeletedSegmentDTO = {
  id: number;
  title: string;
  content: string;
  mode: string;
  documentId: number;
  documentTitle: string;
  deletedAt: string;
  isManual: boolean;
};

export type DeletedFolderDTO = {
  id: number;
  name: string;
  documentId: number;
  documentTitle: string;
  deletedAt: string;
};

export type RecycleBinItemDTO = {
  type: "document" | "segment" | "folder";
  id: number;
  title?: string;
  name?: string;
  content?: string;
  filename?: string;
  documentTitle?: string;
  deletedAt: string;
};

export type RecycleBinResponse = {
  documents: Array<Omit<DeletedDocumentDTO, "upload"> & { type: "document" }>;
  segments: Array<DeletedSegmentDTO & { type: "segment" }>;
  folders: Array<DeletedFolderDTO & { type: "folder" }>;
};

// Documents
export async function softDeleteDocument(documentId: number): Promise<{ ok: boolean; deletedAt?: string; message?: string }> {
  const res = await authFetch(`/recycle-bin/documents/${documentId}`, { method: "DELETE" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to soft delete document (${res.status})`);
  }
  return (await res.json()) as { ok: boolean; deletedAt?: string; message?: string };
}

export async function restoreDocument(documentId: number): Promise<{ ok: boolean; deletedAt: null | string; message?: string }> {
  const res = await authFetch(`/recycle-bin/documents/${documentId}/restore`, { method: "POST" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to restore document (${res.status})`);
  }
  return (await res.json()) as { ok: boolean; deletedAt: null | string; message?: string };
}

export async function permanentlyDeleteDocument(documentId: number): Promise<{ ok: boolean; permanentlyDeleted: boolean }> {
  const res = await authFetch(`/recycle-bin/documents/${documentId}/purge`, { method: "DELETE" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to permanently delete document (${res.status})`);
  }
  return (await res.json()) as { ok: boolean; permanentlyDeleted: boolean };
}

export async function listDeletedDocuments(): Promise<DeletedDocumentDTO[]> {
  const res = await authFetch(`/recycle-bin/documents/recycle-bin`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to list deleted documents (${res.status})`);
  }
  return (await res.json()) as DeletedDocumentDTO[];
}

// Segments
// Note: Soft delete for segments is handled by deleteSegment() which calls DELETE /segments/{segment_id}
// This function is for purge (hard delete) only - use deleteSegment() for soft delete

export async function restoreSegment(segmentId: number): Promise<{ ok: boolean; deletedAt: null | string; message?: string }> {
  const res = await authFetch(`/recycle-bin/segments/${segmentId}/restore`, { method: "POST" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to restore segment (${res.status})`);
  }
  return (await res.json()) as { ok: boolean; deletedAt: null | string; message?: string };
}

export async function permanentlyDeleteSegment(segmentId: number): Promise<{ ok: boolean; permanentlyDeleted: boolean }> {
  const res = await authFetch(`/recycle-bin/segments/${segmentId}/purge`, { method: "DELETE" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to permanently delete segment (${res.status})`);
  }
  return (await res.json()) as { ok: boolean; permanentlyDeleted: boolean };
}

export async function listDeletedSegments(documentId?: number): Promise<DeletedSegmentDTO[]> {
  const res = await authFetch(`/recycle-bin/segments/recycle-bin`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to list deleted segments (${res.status})`);
  }
  const segments = (await res.json()) as DeletedSegmentDTO[];
  // Filter by documentId if provided
  if (documentId !== undefined) {
    return segments.filter(s => s.documentId === documentId);
  }
  return segments;
}

// Folders
// Note: Soft delete for folders is handled by deleteFolder() which calls DELETE /workspace/folders/{folder_id}
// This function is for purge (hard delete) only - use deleteFolder() for soft delete

export async function restoreFolder(folderId: number): Promise<{ ok: boolean; deletedAt: null | string; message?: string }> {
  const res = await authFetch(`/recycle-bin/folders/${folderId}/restore`, { method: "POST" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to restore folder (${res.status})`);
  }
  return (await res.json()) as { ok: boolean; deletedAt: null | string; message?: string };
}

export async function permanentlyDeleteFolder(folderId: number): Promise<{ ok: boolean; permanentlyDeleted: boolean }> {
  const res = await authFetch(`/recycle-bin/folders/${folderId}/purge`, { method: "DELETE" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to permanently delete folder (${res.status})`);
  }
  return (await res.json()) as { ok: boolean; permanentlyDeleted: boolean };
}

export async function listDeletedFolders(documentId?: number): Promise<DeletedFolderDTO[]> {
  const res = await authFetch(`/recycle-bin/folders/recycle-bin`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to list deleted folders (${res.status})`);
  }
  const folders = (await res.json()) as DeletedFolderDTO[];
  // Filter by documentId if provided
  if (documentId !== undefined) {
    return folders.filter(f => f.documentId === documentId);
  }
  return folders;
}

// Combined Recycle Bin
export async function listAllDeletedItems(): Promise<RecycleBinResponse> {
  const res = await authFetch(`/recycle-bin/recycle-bin`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to list deleted items (${res.status})`);
  }
  return (await res.json()) as RecycleBinResponse;
}
