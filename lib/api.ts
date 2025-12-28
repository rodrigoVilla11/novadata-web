const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();

  // ⚠️ No fuerces Content-Type en GET/HEAD (y menos si no hay body)
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

  const text = await res.text(); // leer UNA sola vez

  if (!res.ok) {
    const maybeJson = safeJsonParse(text);
    const msg =
      maybeJson?.message ||
      maybeJson?.error ||
      (typeof maybeJson === "string" ? maybeJson : null) ||
      text ||
      `HTTP ${res.status} ${res.statusText}`;

    throw new Error(`[${method} ${path}] ${res.status} ${res.statusText} :: ${msg}`);
  }

  // 204 / body vacío
  if (res.status === 204 || !text.trim()) return undefined as T;

  const data = safeJsonParse(text);
  return (data ?? (text as any)) as T;
}
