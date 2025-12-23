import { createApi } from "@reduxjs/toolkit/query/react";
import { apiFetchAuthed } from "@/lib/apiAuthed";

// Ojo: importá tu getToken real desde el AuthProvider o donde lo tengas.
// Si hoy tu hook `useAuth()` te da `getToken`, NO lo podés usar acá directo (hooks en módulos no).
// Solución simple: un "token getter" global seteado por el provider.

let tokenGetter: (() => Promise<string | null>) | null = null;

export function setTokenGetter(fn: () => Promise<string | null>) {
  tokenGetter = fn;
}

type BaseQueryArgs = {
  url: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: any;
  params?: Record<string, any>;
};

const baseQuery = async ({
  url,
  method = "GET",
  body,
  params,
}: BaseQueryArgs) => {
  try {
    // querystring
    const qs = params
      ? "?" +
        new URLSearchParams(
          Object.entries(params).reduce((acc, [k, v]) => {
            if (v === undefined || v === null || v === "") return acc;
            acc[k] = String(v);
            return acc;
          }, {} as Record<string, string>)
        ).toString()
      : "";

    const getToken = async () => (tokenGetter ? tokenGetter() : null);

    const res = await apiFetchAuthed(getToken, `${url}${qs}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    return { data: res };
  } catch (err: any) {
    return {
      error: {
        status: "CUSTOM_ERROR",
        data: { message: String(err?.message || err) },
      },
    };
  }
};

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: [
    "User",
    "FinanceCategories",
    "FinanceAccounts",
    "FinanceMovements",
    "FinanceStats",
  ],
  endpoints: () => ({}),
});
