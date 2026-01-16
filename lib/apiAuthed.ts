import { apiFetch } from "./api";

type GetToken = () => Promise<string | null>;

/**
 * Lock global por módulo para evitar múltiples refresh simultáneos.
 */
let refreshLock: Promise<string | null> | null = null;

function isAuthError(e: any) {
  const status =
    e && typeof e === "object" && "status" in e ? (e as any).status : undefined;
  return status === 401; // (opcional: || status === 403)
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
  const doFetch = (t?: string | null) =>
    apiFetch<T>(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
    });

  const token = await getToken();

  try {
    return await doFetch(token);
  } catch (e: any) {
    if (!isAuthError(e)) throw e;

    const newToken = await getTokenWithLock(getToken);
    if (!newToken) throw e;

    // retry 1 vez con token nuevo
    return await doFetch(newToken);
  }
}