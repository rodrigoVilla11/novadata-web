"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type User = { id: string; email: string; roles: string[] };

type AuthContextValue = {
  user: User | null;
  accessToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  refresh: () => Promise<string | null>;
  logout: () => Promise<void>;
  getAccessToken: () => Promise<string | null>; // ✅ para requests
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ evita que 5 requests disparen 5 refresh al mismo tiempo
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  async function login(email: string, password: string) {
    const data = await apiFetch<{ access_token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    setAccessToken(data.access_token);
    setUser(data.user);
  }

  async function refresh(): Promise<string | null> {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      try {
        const data = await apiFetch<{ access_token: string; user: User }>("/auth/refresh", {
          method: "POST",
        });
        setAccessToken(data.access_token);
        setUser(data.user);
        return data.access_token;
      } catch {
        setAccessToken(null);
        setUser(null);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    setAccessToken(null);
    setUser(null);
  }

  async function getAccessToken() {
    // si ya hay token, usarlo
    if (accessToken) return accessToken;
    // si no hay (reload), intentamos refresh por cookie
    return await refresh();
  }

  useEffect(() => {
    (async () => {
      await refresh(); // intenta restaurar sesión por cookie
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ user, accessToken, loading, login, refresh, logout, getAccessToken }),
    [user, accessToken, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
