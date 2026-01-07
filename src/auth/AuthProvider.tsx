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
    if (!getAccessToken()) {
      setUser(null);
      return;
    }
    
    try {
      const userData = await apiMe();
      if (userData?.email) {
        setUser({ email: userData.email });
      } else {
        setUser(null);
      }
    } catch (error) {
      // If /me fails, clear user (token might be invalid)
      setUser(null);
    }
  }

  async function logout() {
    setLoading(true);
    try {
      const refreshToken = getRefreshToken();
      await apiLogout(refreshToken).catch(() => {});
    } finally {
      clearTokens();
      setUser(null);
      setLoading(false);
    }
  }

  useEffect(() => {
    // ✅ Load user info from backend on mount if token exists
    if (getAccessToken()) {
      refreshMe();
    } else {
      setUser(null);
    }
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
