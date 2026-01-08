import { apiFetch } from "./api";
type GetAccessToken = () => Promise<string | null>;
type RefreshAccessToken = () => Promise<string | null>;

export async function apiFetchAuthed<T>(
  getAccessToken: GetAccessToken,
  refreshAccessToken: RefreshAccessToken,
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

  const token = await getAccessToken();

  try {
    return await doFetch(token);
  } catch (e: any) {
    if (e?.name !== "ApiError" || e.status !== 401) throw e;

    // ✅ refresh real por cookie httpOnly
    const newToken = await refreshAccessToken();
    if (!newToken) throw e;

    return await doFetch(newToken);
  }
}
