// src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { http, clearTokens, getAccessToken, getRefreshToken, setTokens } from "../api/http";

type AuthUser = { email: string } | null;

type AuthContextValue = {
  user: AuthUser;
  loading: boolean;
  isAuthed: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer" | string;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [loading, setLoading] = useState(false);

  async function login(email: string, password: string) {
    setLoading(true);
    try {
      // Swagger: application/x-www-form-urlencoded
      // grant_type=password&username=...&password=...
      const form = new URLSearchParams();
      form.set("grant_type", "password");
      form.set("username", email.trim());
      form.set("password", password);

      const res = await http.post<LoginResponse>("/api/auth/login", form, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      });

      const access = res.data?.access_token;
      const refresh = res.data?.refresh_token;

      if (!access || !refresh) {
        throw new Error("Login response missing tokens");
      }

      setTokens(access, refresh);

      // ΜΗΝ εξαρτάσαι από /api/auth/me (δεν φαίνεται στο Swagger)
      // set user άμεσα από το email που έδωσε ο χρήστης:
      setUser({ email: email.trim() });

      // Αν υπάρχει /api/auth/me, μπορούμε να το δοκιμάσουμε προαιρετικά:
      await refreshMe().catch(() => {});
    } finally {
      setLoading(false);
    }
  }

  async function refreshMe() {
    if (!getAccessToken()) {
      setUser(null);
      return;
    }

    // Αν ΔΕΝ έχεις /api/auth/me στο backend, αυτό θα 404.
    // Το πιάνουμε και απλά δεν κάνουμε override το user.
    try {
      const res = await http.get("/api/auth/me", {
        headers: { Accept: "application/json" },
      });

      const email =
        (res.data as any)?.email ||
        (res.data as any)?.username ||
        (res.data as any)?.user?.email ||
        null;

      if (email) setUser({ email });
    } catch {
      // no-op (κρατάμε ό,τι user είχαμε)
    }
  }

  async function logout() {
    setLoading(true);
    try {
      const refreshToken = getRefreshToken();

      // Swagger δείχνει JSON request body required για logout
      if (refreshToken) {
        try {
          await http.post(
            "/api/auth/logout",
            { refresh_token: refreshToken },
            { headers: { "Content-Type": "application/json", Accept: "application/json" } }
          );
        } catch {
          // no-op
        }
      }
    } finally {
      clearTokens();
      setUser(null);
      setLoading(false);
    }
  }

  // On mount: αν υπάρχει token, τουλάχιστον κράτα "authed" state και δοκίμασε (optional) refreshMe
  useEffect(() => {
    if (getAccessToken()) {
      refreshMe().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthed: !!getAccessToken(),
      login,
      logout,
      refreshMe,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
