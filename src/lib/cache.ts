// src/lib/cache.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) { // 5 minutes default
    this.defaultTTL = defaultTTL;
  }

  set(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  // Delete all keys that start with the given prefix
  deleteByPrefix(prefix: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  size(): number {
    return this.cache.size;
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instances
export const apiCache = new SimpleCache<any>(10 * 60 * 1000); // 10 minutes for API calls
export const documentCache = new SimpleCache<any>(30 * 60 * 1000); // 30 minutes for documents
export const segmentCache = new SimpleCache<any>(15 * 60 * 1000); // 15 minutes for segments

// Cache cleanup interval
setInterval(() => {
  apiCache.cleanup();
  documentCache.cleanup();
  segmentCache.cleanup();
}, 5 * 60 * 1000); // Clean up every 5 minutes

// Cache keys generators
export const cacheKeys = {
  uploads: () => 'uploads:list',
  document: (id: number) => `document:${id}`,
  segments: (docId: number, mode?: string) => `segments:${docId}:${mode || 'all'}`,
  segmentations: (docId: number) => `segmentations:${docId}`,
  folders: (docId: number) => `folders:${docId}`,
  folder: (folderId: number) => `folder:${folderId}`,
  folderItems: (folderId: number) => `folder-items:${folderId}`,
};

// Request deduplication
class RequestDeduplicator {
  private pending = new Map<string, Promise<any>>();

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.pending.has(key)) {
      return this.pending.get(key) as Promise<T>;
    }

    const promise = fn().finally(() => {
      this.pending.delete(key);
    });

    this.pending.set(key, promise);
    return promise as Promise<T>;
  }
}

export const requestDeduplicator = new RequestDeduplicator();
