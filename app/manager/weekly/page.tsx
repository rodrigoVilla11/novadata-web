"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  weeklySyncApi,
  WeeklyMessage,
  WeeklyMessageType,
  WeeklyThread,
} from "@/lib/weeklySyncApi";
import { Protected } from "@/components/Protected";
import { useAuth } from "@/app/providers/AuthProvider";
import { RefreshCcw, ArrowLeft } from "lucide-react";

function fmtWeekRange(thread?: WeeklyThread | null) {
  if (!thread) return "";
  const start = new Date(thread.week_start);
  const end = new Date(thread.week_end);
  // end es lunes siguiente 00:00, mostramos hasta domingo:
  const endMinus1 = new Date(end);
  endMinus1.setDate(endMinus1.getDate() - 1);

  const f = (d: Date) =>
    d.toLocaleDateString("es-AR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

  return `${f(start)} → ${f(endMinus1)}`;
}

function typeLabel(t: WeeklyMessageType) {
  switch (t) {
    case "avance":
      return "Avance";
    case "error":
      return "Error";
    case "mejora":
      return "Mejora";
    case "bloqueo":
      return "Bloqueo";
    case "decision":
      return "Decisión";
    default:
      return "Otro";
  }
}

function typeBadgeClass(t: WeeklyMessageType) {
  switch (t) {
    case "avance":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "error":
      return "bg-red-50 text-red-700 border-red-200";
    case "mejora":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "bloqueo":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "decision":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-zinc-50 text-zinc-700 border-zinc-200";
  }
}

export default function WeeklySyncPage() {
  const router = useRouter();
  const { getAccessToken, user, loading } = useAuth();

  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [current, setCurrent] = useState<WeeklyThread | null>(null);
  const [weeks, setWeeks] = useState<WeeklyThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");

  // Mensajes
  const [items, setItems] = useState<WeeklyMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Composer
  const [text, setText] = useState("");
  const [type, setType] = useState<WeeklyMessageType>("otro");
  const [pinned, setPinned] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Close
  const [summary, setSummary] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  const canUse = useMemo(() => {
    const roles = (user?.roles ?? []).map((r: string) =>
      String(r).toUpperCase()
    );
    return roles.includes("ADMIN") || roles.includes("MANAGER");
  }, [user]);

  const selectedThread = useMemo(() => {
    const fromWeeks = weeks.find((w) => w.id === selectedThreadId) || null;
    if (fromWeeks) return fromWeeks;
    if (current?.id === selectedThreadId) return current;
    return null;
  }, [weeks, selectedThreadId, current]);

  const pinnedItems = useMemo(() => items.filter((m) => m.pinned), [items]);
  const normalItems = useMemo(() => items.filter((m) => !m.pinned), [items]);

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/manager");
    }
  }

  async function loadMessages(
    threadId: string,
    mode: "reset" | "more" = "reset"
  ) {
    if (!threadId) return;
    if (mode === "more" && !nextCursor) return;

    setIsLoadingMessages(true);
    setError(null);

    try {
      const cursor = mode === "more" ? nextCursor : undefined;

      const res = await weeklySyncApi.listMessages(getAccessToken, threadId, {
        limit: 50,
        cursor: cursor || undefined,
      });

      // backend devuelve DESC (más nuevos primero)
      if (mode === "reset") {
        setItems(res.items);
      } else {
        setItems((prev) => [...prev, ...res.items]);
      }
      setNextCursor(res.nextCursor);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setIsLoadingMessages(false);
    }
  }

  async function boot() {
    setIsBooting(true);
    setError(null);

    try {
      const [cur, ws] = await Promise.all([
        weeklySyncApi.getCurrent(getAccessToken),
        weeklySyncApi.listWeeks(getAccessToken, 30),
      ]);

      // evitar duplicar “current” en historial si viene incluido
      const wsNoDup = (ws || []).filter((w) => w?.id && w.id !== cur?.id);

      setCurrent(cur);
      setWeeks(wsNoDup);

      const defaultId = cur?.id || wsNoDup?.[0]?.id || "";
      setSelectedThreadId(defaultId);

      // cargar mensajes del defaultId inmediatamente (evita timing raro del useEffect)
      if (defaultId) {
        setItems([]);
        setNextCursor(null);
        await loadMessages(defaultId, "reset");
      }
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setIsBooting(false);
    }
  }

  async function onSend() {
    const t = text.trim();
    if (!t) return;
    if (!selectedThreadId) return;

    setIsSending(true);
    setError(null);

    try {
      const created = await weeklySyncApi.createMessage(
        getAccessToken,
        selectedThreadId,
        {
          text: t,
          type,
          pinned,
          task_id: null,
        }
      );

      // Insertar arriba (porque la lista está DESC)
      setItems((prev) => [created, ...prev]);
      setText("");
      setPinned(false);
      setType("otro");

      listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setIsSending(false);
    }
  }

  async function onCloseWeek() {
    if (!selectedThreadId) return;

    setIsClosing(true);
    setError(null);

    try {
      const updated = await weeklySyncApi.closeWeek(
        getAccessToken,
        selectedThreadId,
        { summary: summary.trim() }
      );

      setCurrent((prev) => (prev?.id === updated.id ? updated : prev));
      setWeeks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setIsClosing(false);
    }
  }

  // boot: esperá a que auth termine
  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (!canUse) return;
    boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id, canUse]);

  // cuando cambia thread, reset mensajes
  useEffect(() => {
    if (!selectedThreadId) return;
    setItems([]);
    setNextCursor(null);
    loadMessages(selectedThreadId, "reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId]);

  if (!canUse) {
    return (
      <Protected>
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-xl font-semibold text-zinc-900">
              Weekly Sync
            </div>
            <p className="mt-2 text-sm text-zinc-600">
              No tenés permisos (requiere rol <b>ADMIN</b> o <b>MANAGER</b>).
            </p>
          </div>
        </div>
      </Protected>
    );
  }

  return (
    <Protected>
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-6">
          {/* Header */}
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={goBack}
                  className="
                    inline-flex items-center gap-2
                    rounded-xl border bg-white px-3 py-2
                    text-sm font-semibold text-zinc-900
                    hover:bg-zinc-50
                  "
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver
                </button>
              </div>

              <h1 className="mt-3 text-2xl font-bold text-zinc-900">
                Weekly Sync
              </h1>
              <p className="text-sm text-zinc-600">
                Chat semanal entre Manager y Admin (con cierre y resumen).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={boot}
                disabled={isBooting}
                className="
                  inline-flex items-center gap-2
                  rounded-xl border bg-white px-3 py-2
                  text-sm font-semibold text-zinc-900
                  hover:bg-zinc-50
                  disabled:opacity-60 disabled:cursor-not-allowed
                "
              >
                <RefreshCcw className="h-4 w-4" />
                {isBooting ? "Cargando…" : "Actualizar"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Sidebar weeks */}
            <div className="lg:col-span-4">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">
                    Semanas
                  </div>
                  <div className="text-xs text-zinc-500">
                    Elegí una para ver mensajes
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {isBooting ? (
                    <div className="text-sm text-zinc-600">Cargando…</div>
                  ) : (
                    <>
                      {current && (
                        <button
                          onClick={() => setSelectedThreadId(current.id)}
                          className={[
                            "w-full rounded-xl border px-3 py-2 text-left hover:bg-zinc-50",
                            selectedThreadId === current.id
                              ? "border-zinc-900"
                              : "border-zinc-200",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-semibold text-zinc-900">
                              Semana actual
                            </div>
                            <span
                              className={[
                                "rounded-full border px-2 py-0.5 text-xs",
                                current.status === "open"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-zinc-200 bg-zinc-50 text-zinc-700",
                              ].join(" ")}
                            >
                              {current.status === "open"
                                ? "Abierta"
                                : "Cerrada"}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-zinc-600">
                            {fmtWeekRange(current)}
                          </div>
                        </button>
                      )}

                      <div className="pt-2">
                        <div className="mb-2 text-xs font-medium text-zinc-500">
                          Historial
                        </div>

                        <div className="max-h-[55vh] overflow-auto pr-1">
                          <div className="space-y-2">
                            {weeks.map((w) => (
                              <button
                                key={w.id}
                                onClick={() => setSelectedThreadId(w.id)}
                                className={[
                                  "w-full rounded-xl border px-3 py-2 text-left hover:bg-zinc-50",
                                  selectedThreadId === w.id
                                    ? "border-zinc-900"
                                    : "border-zinc-200",
                                ].join(" ")}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-semibold text-zinc-900">
                                    {fmtWeekRange(w)}
                                  </div>
                                  <span
                                    className={[
                                      "rounded-full border px-2 py-0.5 text-xs",
                                      w.status === "open"
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-zinc-200 bg-zinc-50 text-zinc-700",
                                    ].join(" ")}
                                  >
                                    {w.status === "open" ? "Abierta" : "Cerrada"}
                                  </span>
                                </div>

                                {w.summary ? (
                                  <div className="mt-1 line-clamp-2 text-xs text-zinc-600">
                                    {w.summary}
                                  </div>
                                ) : (
                                  <div className="mt-1 text-xs text-zinc-400">
                                    Sin resumen
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Main chat */}
            <div className="lg:col-span-8">
              <div className="rounded-2xl border bg-white shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 border-b p-4">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {selectedThread ? fmtWeekRange(selectedThread) : "—"}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Thread:{" "}
                      <span className="font-mono">
                        {selectedThread?.id || "—"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedThread?.status === "closed" ? (
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700">
                        Semana cerrada
                      </span>
                    ) : (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        Semana abierta
                      </span>
                    )}
                  </div>
                </div>

                {/* Pinned */}
                {pinnedItems.length > 0 && (
                  <div className="border-b p-4">
                    <div className="mb-2 text-xs font-semibold text-zinc-700">
                      📌 Pinned
                    </div>
                    <div className="space-y-2">
                      {pinnedItems.map((m) => (
                        <MessageCard
                          key={m.id}
                          m={m}
                          isMine={m.author_id === user?.id}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Messages list */}
                <div ref={listRef} className="max-h-[55vh] overflow-auto p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      onClick={() => loadMessages(selectedThreadId, "more")}
                      className="rounded-lg border bg-white px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
                      disabled={!nextCursor || isLoadingMessages}
                    >
                      {nextCursor
                        ? isLoadingMessages
                          ? "Cargando…"
                          : "Cargar más"
                        : "No hay más"}
                    </button>

                    <div className="text-xs text-zinc-500">
                      {items.length} mensaje{items.length === 1 ? "" : "s"}
                    </div>
                  </div>

                  {normalItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-zinc-500">
                      Todavía no hay mensajes.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {normalItems.map((m) => (
                        <MessageCard
                          key={m.id}
                          m={m}
                          isMine={m.author_id === user?.id}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Composer */}
                <div className="border-t p-4">
                  {selectedThread?.status === "closed" ? (
                    <div className="rounded-xl border bg-zinc-50 p-3 text-sm text-zinc-700">
                      Semana cerrada. No se pueden enviar mensajes.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          value={type}
                          onChange={(e) =>
                            setType(e.target.value as WeeklyMessageType)
                          }
                          className="rounded-xl border px-3 py-2 text-sm text-black"
                        >
                          <option value="otro">Otro</option>
                          <option value="avance">Avance</option>
                          <option value="error">Error</option>
                          <option value="mejora">Mejora</option>
                          <option value="bloqueo">Bloqueo</option>
                          <option value="decision">Decisión</option>
                        </select>

                        <label className="flex items-center gap-2 text-sm text-zinc-700">
                          <input
                            type="checkbox"
                            checked={pinned}
                            onChange={(e) => setPinned(e.target.checked)}
                          />
                          Pinned
                        </label>

                        <div className="sm:ml-auto" />
                        <button
                          onClick={onSend}
                          disabled={isSending || !text.trim()}
                          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                        >
                          {isSending ? "Enviando…" : "Enviar"}
                        </button>
                      </div>

                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={4}
                        placeholder="Escribí el update semanal…"
                        className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 text-black focus:ring-zinc-200"
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === "Enter")
                            onSend();
                        }}
                      />

                      <div className="text-xs text-zinc-500">
                        Tip: <b>Ctrl/⌘ + Enter</b> para enviar.
                      </div>
                    </div>
                  )}
                </div>

                {/* Close Week */}
                <div className="border-t p-4">
                  <div className="text-sm font-semibold text-zinc-900">
                    Cerrar semana
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Guardá un resumen final y marcá el thread como cerrado.
                  </div>

                  <div className="mt-3 space-y-2">
                    <textarea
                      value={summary}
                      onChange={(e) => setSummary(e.target.value)}
                      rows={3}
                      placeholder="Resumen final (opcional)…"
                      className="w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none text-black focus:ring-2 focus:ring-zinc-200"
                      disabled={selectedThread?.status === "closed"}
                    />

                    <button
                      onClick={onCloseWeek}
                      disabled={isClosing || selectedThread?.status === "closed"}
                      className="rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                    >
                      {selectedThread?.status === "closed"
                        ? "Ya está cerrada"
                        : isClosing
                        ? "Cerrando…"
                        : "Cerrar semana"}
                    </button>
                  </div>

                  {selectedThread?.summary ? (
                    <div className="mt-4 rounded-xl border bg-zinc-50 p-3">
                      <div className="text-xs font-semibold text-zinc-700">
                        Resumen guardado
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">
                        {selectedThread.summary}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-xs text-zinc-500">
            Endpoint: <span className="font-mono">/weekly-sync</span> • Roles:
            ADMIN/MANAGER
          </div>
        </div>
      </div>
    </Protected>
  );
}

function MessageCard({ m, isMine }: { m: WeeklyMessage; isMine: boolean }) {
  const date = m.createdAt ? new Date(m.createdAt) : null;
  const when = date
    ? date.toLocaleString("es-AR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  const authorLabel =
    (m.author_email && String(m.author_email)) || m.author_id || "—";

  return (
    <div
      className={[
        "rounded-xl border p-3",
        isMine ? "border-zinc-300 bg-white" : "border-zinc-200 bg-zinc-50",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={[
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs",
              typeBadgeClass(m.type),
            ].join(" ")}
          >
            {typeLabel(m.type)}
          </span>
          {m.pinned && (
            <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700">
              📌 Pinned
            </span>
          )}
        </div>

        <div className="text-xs text-zinc-500">
          {when} • <span className="font-mono">{authorLabel}</span>
        </div>
      </div>

      <div className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-900">
        {m.text}
      </div>
    </div>
  );
}
