import { apiFetchAuthed } from "./apiAuthed";


export type WeeklyThreadStatus = "open" | "closed";

export type WeeklyThread = {
  id: string;
  week_start: string | Date;
  week_end: string | Date;
  status: WeeklyThreadStatus;
  created_by: string;
  participants: string[];
  summary: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WeeklyMessageType =
  | "avance"
  | "error"
  | "mejora"
  | "bloqueo"
  | "decision"
  | "otro";

export type WeeklyMessage = {
  id: string;
  thread_id: string;
  author_id: string;
  type: WeeklyMessageType;
  text: string;
  pinned: boolean;
  task_id: string | null;
  createdAt?: string;
  updatedAt?: string;
  author_email?: string;
};

export type ListMessagesResponse = {
  items: WeeklyMessage[];
  nextCursor: string | null;
};

type GetToken = () => Promise<string | null>;

export const weeklySyncApi = {
  getCurrent: (getToken: GetToken) =>
    apiFetchAuthed<WeeklyThread>(getToken, "/weekly-sync/current", {
      method: "GET",
    }),

  listWeeks: (getToken: GetToken, limit = 20) =>
    apiFetchAuthed<WeeklyThread[]>(
      getToken,
      `/weekly-sync/weeks?limit=${encodeURIComponent(String(limit))}`,
      { method: "GET" },
    ),

  listMessages: (
    getToken: GetToken,
    threadId: string,
    params?: { limit?: number; cursor?: string },
  ) => {
    const q = new URLSearchParams();
    q.set("limit", String(params?.limit ?? 50));
    if (params?.cursor) q.set("cursor", params.cursor);

    return apiFetchAuthed<ListMessagesResponse>(
      getToken,
      `/weekly-sync/${encodeURIComponent(threadId)}/messages?${q.toString()}`,
      { method: "GET" },
    );
  },

  createMessage: (
    getToken: GetToken,
    threadId: string,
    body: { text: string; type?: WeeklyMessageType; pinned?: boolean; task_id?: string | null },
  ) =>
    apiFetchAuthed<WeeklyMessage>(
      getToken,
      `/weekly-sync/${encodeURIComponent(threadId)}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ),

  closeWeek: (getToken: GetToken, threadId: string, body: { summary?: string }) =>
    apiFetchAuthed<WeeklyThread>(
      getToken,
      `/weekly-sync/${encodeURIComponent(threadId)}/close`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ),
};
