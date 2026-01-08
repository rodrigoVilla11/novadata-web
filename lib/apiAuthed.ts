import { apiFetch } from "./api";

type GetToken = () => Promise<string | null>;

/**
 * Lock global por módulo para evitar múltiples refresh simultáneos.
 * Si 10 requests dan 401 a la vez, esperan el mismo getToken() "refreshing".
 */
let refreshLock: Promise<string | null> | null = null;

function isLikelyAuthError(e: any) {
  const msg = String(e?.message || "").toLowerCase();

  // Heurística fuerte: tu apiFetch arma: `[METHOD path] 401 ... :: ...`
  if (msg.includes(" 401 ") || msg.includes("http 401") || msg.includes("unauthorized")) return true;

  // A veces Nest devuelve Forbidden/Unauthorized en message
  if (msg.includes("missing refresh token")) return true;
  if (msg.includes("invalid refresh token")) return true;

  return false;
}

async function getTokenWithLock(getToken: GetToken) {
  if (!refreshLock) {
    refreshLock = (async () => {
      try {
        return await getToken();
      } finally {
        refreshLock = null;
      }
    })();
  }
  return refreshLock;
}

export async function apiFetchAuthed<T>(
  getToken: GetToken,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();

  const doFetch = (t?: string | null) =>
    apiFetch<T>(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
    });

  // 1) Primer intento con token actual
  const token = await getToken();
  // console.debug(`[apiFetchAuthed] ${method} ${path} token?`, !!token);

  try {
    return await doFetch(token);
  } catch (e: any) {
    // 2) Si no parece auth, no tocamos nada
    if (!isLikelyAuthError(e)) throw e;

    // 3) Intento de "renovación" con lock (evita tormenta)
    const newToken = await getTokenWithLock(getToken);

    // Si no hay token nuevo, devolvemos el error original
    if (!newToken) throw e;

    // Si el token "nuevo" es igual al viejo, igual reintentamos 1 vez.
    // (si getToken ya refrescó internamente, va a ser distinto; si no, igual no hacemos loop)
    try {
      return await doFetch(newToken);
    } catch (e2: any) {
      // Si sigue fallando con auth, devolvemos el segundo error (más actualizado)
      throw e2;
    }
  }
}
