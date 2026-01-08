"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";
import { setTokenGetter } from "@/redux/services/baseApi";

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

/** -----------------------------
 * Helpers: JWT exp parsing
 * ------------------------------ */
function decodeJwtPayload(token: string): any | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;

    // base64url -> base64
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");

    // atob requiere padding en algunos casos
    const pad = b64.length % 4;
    const padded = pad ? b64 + "=".repeat(4 - pad) : b64;

    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isExpiringSoon(token: string, skewSec = 60) {
  const p = decodeJwtPayload(token);
  const expSec = typeof p?.exp === "number" ? p.exp : 0;
  if (!expSec) return true;

  const expMs = expSec * 1000;
  return Date.now() >= expMs - skewSec * 1000;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ✅ evita que 5 requests disparen 5 refresh al mismo tiempo
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{ access_token: string; user: User }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }
    );

    setAccessToken(data.access_token);
    setUser(data.user);
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      try {
        const data = await apiFetch<{ access_token: string; user: User }>(
          "/auth/refresh",
          { method: "POST" }
        );
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
  }, []);

  const logout = useCallback(async () => {
    await apiFetch("/auth/logout", { method: "POST" });
    setAccessToken(null);
    setUser(null);
  }, []);

  const getAccessToken = useCallback(async () => {
    // ✅ Si hay token pero está vencido o por vencer → refresh por cookie
    if (accessToken && !isExpiringSoon(accessToken, 60)) return accessToken;

    // ✅ Si no hay token (reload) o está vencido → refresh
    return await refresh();
  }, [accessToken, refresh]);

  // ✅ Setear getter estable (memoizado) para tu baseApi/RTK
  useEffect(() => {
    setTokenGetter(getAccessToken);
  }, [getAccessToken]);

  // ✅ Restaurar sesión al iniciar (cookie refresh_token)
  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      accessToken,
      loading,
      login,
      refresh,
      logout,
      getAccessToken,
    }),
    [user, accessToken, loading, login, refresh, logout, getAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
