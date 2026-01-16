const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  status: number;
  data: any;
  method: string;
  path: string;

  constructor(args: {
    status: number;
    data: any;
    method: string;
    path: string;
    message: string;
  }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.data = args.data;
    this.method = args.method;
    this.path = args.path;
  }
}

function extractErrorMessage(data: any) {
  if (!data) return null;
  if (typeof data === "string") return data;

  if (typeof data === "object") {
    const m = (data as any).message ?? (data as any).error;
    if (Array.isArray(m)) return m.filter(Boolean).join(" · ");
    if (typeof m === "string") return m;
  }

  return null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const hasBody = options.body != null;

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  // No setear JSON content-type si es FormData o si ya viene seteado
  const headersIn = (options.headers || {}) as Record<string, any>;
  const hasContentTypeHeader =
    Object.keys(headersIn).some((k) => k.toLowerCase() === "content-type");

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(!hasContentTypeHeader && hasBody && !isFormData
      ? { "Content-Type": "application/json" }
      : {}),
    ...(headersIn as any),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const text = await res.text();
  const data = text.trim() ? safeJsonParse(text) ?? text : null;

  if (!res.ok) {
    const extracted = extractErrorMessage(data);
    const msg = extracted || `HTTP ${res.status} ${res.statusText}`;

    throw new ApiError({
      status: res.status,
      data,
      method,
      path,
      message: `[${method} ${path}] ${msg}`,
    });
  }

  if (res.status === 204 || !text.trim()) return undefined as T;
  return data as T;
}