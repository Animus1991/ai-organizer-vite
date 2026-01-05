// src/hooks/useLoading.ts
import { useState, useCallback } from 'react';

interface LoadingState {
  loading: boolean;
  error: string | null;
}

export function useLoading() {
  const [state, setState] = useState<LoadingState>({
    loading: false,
    error: null
  });

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading, error: null }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error, loading: false }));
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, error: null });
  }, []);

  const execute = useCallback(async <T>(
    asyncFn: () => Promise<T>
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await asyncFn();
      return result;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, [setLoading, setError]);

  return {
    loading: state.loading,
    error: state.error,
    setLoading,
    setError,
    reset,
    execute
  };
}

interface LoadingStates {
  [key: string]: LoadingState;
}

export function useMultiLoading() {
  const [states, setStates] = useState<LoadingStates>({});

  const setLoading = useCallback((key: string, loading: boolean) => {
    setStates(prev => ({
      ...prev,
      [key]: { ...prev[key], loading, error: null }
    }));
  }, []);

  const setError = useCallback((key: string, error: string | null) => {
    setStates(prev => ({
      ...prev,
      [key]: { ...prev[key], error, loading: false }
    }));
  }, []);

  const reset = useCallback((key?: string) => {
    if (key) {
      setStates(prev => ({
        ...prev,
        [key]: { loading: false, error: null }
      }));
    } else {
      setStates({});
    }
  }, []);

  const isLoading = useCallback((key?: string) => {
    if (key) return states[key]?.loading || false;
    return Object.values(states).some(state => state.loading);
  }, [states]);

  const getError = useCallback((key: string) => {
    return states[key]?.error || null;
  }, [states]);

  return {
    setLoading,
    setError,
    reset,
    isLoading,
    getError,
    states
  };
}
