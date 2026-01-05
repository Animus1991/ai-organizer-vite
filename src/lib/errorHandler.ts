// src/lib/errorHandler.ts

export interface ApiError {
  status?: number;
  message: string;
  code?: string;
  details?: any;
}

export class AppError extends Error {
  constructor(
    public message: string,
    public status?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function parseApiError(error: any): ApiError {
  // Network errors
  if (!error.response) {
    return {
      message: error.message || 'Network error. Please check your connection.',
      status: 0,
      code: 'NETWORK_ERROR'
    };
  }

  const response = error.response;
  const data = response.data || {};

  // FastAPI errors usually have .detail
  if (data.detail) {
    return {
      status: response.status,
      message: typeof data.detail === 'string' ? data.detail : 'Server error',
      code: data.code || 'API_ERROR',
      details: data
    };
  }

  // Other API errors
  return {
    status: response.status,
    message: data.message || `Error ${response.status}`,
    code: data.code || 'HTTP_ERROR',
    details: data
  };
}

export function getErrorMessage(error: any): string {
  if (error instanceof AppError) {
    return error.message;
  }

  const apiError = parseApiError(error);
  
  // User-friendly messages for common errors
  switch (apiError.status) {
    case 400:
      return 'Invalid request. Please check your input.';
    case 401:
      return 'Please log in to continue.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'Conflict: This resource already exists.';
    case 422:
      return 'Invalid data provided. Please check your input.';
    case 429:
      return 'Too many requests. Please try again later.';
    case 500:
      return 'Server error. Please try again later.';
    default:
      return apiError.message || 'An unexpected error occurred.';
  }
}

export function isErrorRetryable(error: any): boolean {
  const apiError = parseApiError(error);
  
  // Retryable errors
  return [
    0,      // Network error
    408,    // Request timeout
    429,    // Rate limit
    500,    // Server error
    502,    // Bad gateway
    503,    // Service unavailable
    504     // Gateway timeout
  ].includes(apiError.status || 0);
}
