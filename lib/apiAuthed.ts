import { apiFetch } from "./api";

type GetToken = () => Promise<string | null>;

export async function apiFetchAuthed<T>(
  getToken: GetToken,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();

  // Si no hay token, igual intentamos (puede ser endpoint público),
  // pero para admin/users te conviene fallar.
  const doFetch = (t?: string | null) =>
    apiFetch<T>(path, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
    });

  try {
    return await doFetch(token);
  } catch (e: any) {
    // Si expiró el access token, apiFetch devuelve Error(msg).
    // Como no tenemos status, detectamos por mensaje típico.
    const msg = String(e?.message || "");
    const looks401 = msg.includes("401") || msg.toLowerCase().includes("unauthorized");

    if (!looks401) throw e;

    // Reintentar con token renovado:
    const newToken = await getToken(); // AuthProvider refresh lock evita duplicados
    if (!newToken) throw e;

    return await doFetch(newToken);
  }
}
