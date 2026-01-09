// src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  login as apiLogin,
  logout as apiLogout,
} from "../lib/api";
import { register as apiRegister, me as apiMe } from "../api/auth";

type AuthUser = { email: string } | null;

type AuthContextValue = {
  user: AuthUser;
  loading: boolean;
  isAuthed: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(false);

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      await apiLogin(email.trim(), password);
      // δεν βασιζόμαστε σε /me
      setUser({ email: email.trim() });
    } finally {
      setLoading(false);
    }
  }

  async function register(email: string, password: string) {
    setLoading(true);
    try {
      await apiRegister(email.trim(), password);
      // After successful registration, automatically log in
      await apiLogin(email.trim(), password);
      setUser({ email: email.trim() });
    } finally {
      setLoading(false);
    }
  }

  async function refreshMe() {
    // ✅ Load user info from backend if token exists
    // If access token is missing but refresh token exists, try to refresh first
    let accessToken = getAccessToken();
    
    if (!accessToken) {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        // Try to refresh tokens
        try {
          const { refreshTokens } = await import("../lib/api");
          const newAccess = await refreshTokens();
          if (newAccess) {
            accessToken = newAccess;
          } else {
            setUser(null);
            return;
          }
        } catch {
          setUser(null);
          return;
        }
      } else {
        setUser(null);
        return;
      }
    }
    
    try {
      const userData = await apiMe();
      if (userData?.email) {
        setUser({ email: userData.email });
      } else {
        setUser(null);
      }
    } catch (error) {
      // If /me fails, try refreshing tokens once more before giving up
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const { refreshTokens } = await import("../lib/api");
          const newAccess = await refreshTokens();
          if (newAccess) {
            // Retry /me after refresh
            const userData = await apiMe();
            if (userData?.email) {
              setUser({ email: userData.email });
            } else {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    }
  }

  async function logout() {
    setLoading(true);
    try {
      const refreshToken = getRefreshToken();
      await apiLogout(refreshToken).catch(() => {});
      
      // Clear user-specific localStorage data
      try {
        const { getCurrentUserId, clearUserData } = await import("../lib/localStorageKeys");
        const userId = getCurrentUserId();
        if (userId) {
          clearUserData(userId);
        }
      } catch {
        // Ignore errors in cleanup
      }
    } finally {
      clearTokens();
      setUser(null);
      setLoading(false);
    }
  }

  useEffect(() => {
    // ✅ Load user info from backend on mount if token exists
    // Also try to refresh tokens if refresh token exists but access token is missing
    const loadUser = async () => {
      const accessToken = getAccessToken();
      const refreshToken = getRefreshToken();
      
      if (accessToken) {
        try {
          await refreshMe();
        } catch {
          // If /me fails, try refresh
          if (refreshToken) {
            try {
              const { refreshTokens } = await import("../lib/api");
              const newAccess = await refreshTokens();
              if (newAccess) {
                await refreshMe();
              } else {
                // Refresh failed, logout
                await logout();
              }
            } catch {
              await logout();
            }
          } else {
            setUser(null);
          }
        }
      } else if (refreshToken) {
        // Try to refresh tokens first, then load user
        try {
          const { refreshTokens } = await import("../lib/api");
          const newAccess = await refreshTokens();
          if (newAccess) {
            await refreshMe();
          } else {
            // Refresh failed, logout
            await logout();
          }
        } catch {
          await logout();
        }
      } else {
        setUser(null);
      }
    };
    
    loadUser();
    
    // Listen for token expiration events from authFetch
    const handleTokenExpired = async () => {
      await logout();
    };
    window.addEventListener('auth:token-expired', handleTokenExpired);
    
    // Set up periodic token refresh (every 5 minutes) to keep session alive
    const refreshInterval = setInterval(async () => {
      const refreshToken = getRefreshToken();
      if (refreshToken && !getAccessToken()) {
        // Access token expired, try to refresh
        try {
          const { refreshTokens } = await import("../lib/api");
          const newAccess = await refreshTokens();
          if (newAccess) {
            await refreshMe();
          } else {
            // Refresh failed, logout
            await logout();
          }
        } catch {
          await logout();
        }
      } else if (refreshToken) {
        // Access token exists, just verify user is still logged in
        try {
          await refreshMe();
        } catch {
          // If /me fails, try refresh
          try {
            const { refreshTokens } = await import("../lib/api");
            const newAccess = await refreshTokens();
            if (newAccess) {
              await refreshMe();
            } else {
              await logout();
            }
          } catch {
            await logout();
          }
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
    
    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('auth:token-expired', handleTokenExpired);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthed: !!getAccessToken(),
      login,
      register,
      logout,
      refreshMe,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
