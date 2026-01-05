// src/lib/edgeCases.ts

// File size limits (in bytes)
export const FILE_SIZE_LIMITS: Record<string, number> = {
  'application/pdf': 50 * 1024 * 1024, // 50MB
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 25 * 1024 * 1024, // 25MB
  'text/plain': 10 * 1024 * 1024, // 10MB
  'default': 20 * 1024 * 1024, // 20MB default
};

// Allowed file types
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'application/msword',
];

// Network retry configuration
export const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000, // 1 second
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

// Request timeout configuration
export const TIMEOUT_CONFIG = {
  upload: 5 * 60 * 1000, // 5 minutes for uploads
  default: 30 * 1000, // 30 seconds for other requests
};

export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not supported. Allowed types: PDF, DOCX, TXT, MD`
    };
  }

  // Check file size
  const sizeLimit = FILE_SIZE_LIMITS[file.type] || FILE_SIZE_LIMITS.default;
  if (file.size > sizeLimit) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const limitMB = (sizeLimit / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size ${sizeMB}MB exceeds limit of ${limitMB}MB for this file type`
    };
  }

  // Check file name
  if (file.name.length > 255) {
    return {
      valid: false,
      error: 'File name is too long (max 255 characters)'
    };
  }

  return { valid: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = RETRY_CONFIG.maxRetries,
  delay: number = RETRY_CONFIG.retryDelay,
  backoffMultiplier: number = RETRY_CONFIG.backoffMultiplier
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw lastError;
      }
      
      // Wait before retry
      await sleep(delay * Math.pow(backoffMultiplier, attempt));
    }
  }
  
  throw lastError!;
}

function isRetryableError(error: any): boolean {
  if (!error.response) {
    // Network errors are retryable
    return true;
  }
  
  const status = error.response.status;
  return RETRY_CONFIG.retryableStatusCodes.includes(status);
}

export function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
  });
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    promise,
    createTimeoutPromise(timeoutMs)
  ]);
}

// Debounce function for search inputs
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for scroll events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}
