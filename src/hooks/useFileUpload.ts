// src/hooks/useFileUpload.ts
import { useState, useCallback } from 'react';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface UploadState {
  uploading: boolean;
  progress: UploadProgress | null;
  error: string | null;
  completed: boolean;
}

export function useFileUpload() {
  const [state, setState] = useState<UploadState>({
    uploading: false,
    progress: null,
    error: null,
    completed: false
  });

  const reset = useCallback(() => {
    setState({
      uploading: false,
      progress: null,
      error: null,
      completed: false
    });
  }, []);

  const upload = useCallback(async (file: File): Promise<any> => {
    setState({
      uploading: true,
      progress: { loaded: 0, total: file.size, percentage: 0 },
      error: null,
      completed: false
    });

    try {
      // Create FormData with progress tracking
      const formData = new FormData();
      formData.append('file', file);

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Progress tracking
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = {
              loaded: event.loaded,
              total: event.total,
              percentage: Math.round((event.loaded / event.total) * 100)
            };
            setState(prev => ({
              ...prev,
              progress
            }));
          }
        });

        // Load complete
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              setState(prev => ({
                ...prev,
                uploading: false,
                completed: true,
                progress: { loaded: file.size, total: file.size, percentage: 100 }
              }));
              resolve(response);
            } catch (error) {
              reject(new Error('Invalid response from server'));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(new Error(errorResponse.detail || 'Upload failed'));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        // Error handling
        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        // Setup and send - use API_BASE from environment or default
        const API_BASE = import.meta.env.VITE_API_BASE_URL?.toString() || "http://127.0.0.1:8000";
        xhr.open('POST', `${API_BASE}/api/upload`);
        
        // Add auth header
        const token = localStorage.getItem('aiorg_access_token');
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.send(formData);
      });
    } catch (error) {
      setState(prev => ({
        ...prev,
        uploading: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }));
      throw error;
    }
  }, []);

  return {
    uploading: state.uploading,
    progress: state.progress,
    error: state.error,
    completed: state.completed,
    upload,
    reset
  };
}
