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

  constructor(args: { status: number; data: any; method: string; path: string; message: string }) {
    super(args.message);
    this.name = "ApiError";
    this.status = args.status;
    this.data = args.data;
    this.method = args.method;
    this.path = args.path;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const hasBody = options.body != null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  const text = await res.text();
  const data = text.trim() ? safeJsonParse(text) ?? text : null;

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.message || data.error)) ||
      (typeof data === "string" ? data : null) ||
      `HTTP ${res.status} ${res.statusText}`;

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
