/**
 * Centralized localStorage key management with user context
 * 
 * This ensures that each user's data is isolated in localStorage.
 * When a user logs out, their data can be cleared separately.
 */

/**
 * Get the current user ID from the access token
 * Returns null if no user is logged in
 */
export function getCurrentUserId(): number | null {
  try {
    const token = localStorage.getItem("aiorg_access_token");
    if (!token) return null;
    
    // Decode JWT token to get user ID
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.uid || payload.userId || null;
  } catch {
    return null;
  }
}

/**
 * Generate a user-scoped localStorage key
 * Format: prefix_userId_docId (or just prefix_userId if no docId)
 */
export function getUserScopedKey(prefix: string, docId?: number): string {
  const userId = getCurrentUserId();
  if (userId) {
    return docId !== undefined 
      ? `${prefix}_user_${userId}_doc_${docId}`
      : `${prefix}_user_${userId}`;
  }
  // Fallback to old format if no user (backward compatibility)
  return docId !== undefined 
    ? `${prefix}_doc_${docId}`
    : prefix;
}

/**
 * Clear all user-specific localStorage data
 * Call this on logout
 */
export function clearUserData(userId: number): void {
  const keysToRemove: string[] = [];
  
  // Find all keys that belong to this user
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes(`_user_${userId}_`)) {
      keysToRemove.push(key);
    }
  }
  
  // Remove all user-specific keys
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Get all document IDs that have user data in localStorage
 */
export function getUserDocumentIds(userId: number): number[] {
  const docIds = new Set<number>();
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.includes(`_user_${userId}_doc_`)) {
      const match = key.match(/_doc_(\d+)$/);
      if (match) {
        docIds.add(parseInt(match[1], 10));
      }
    }
  }
  
  return Array.from(docIds);
}
