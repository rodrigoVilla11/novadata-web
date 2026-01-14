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
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  RefreshCcw,
  ArrowLeft,
  Search,
  Pin,
  Send,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  X,
  AlertTriangle,
} from "lucide-react";

/* ================= Utils ================= */

function fmtWeekRange(thread?: WeeklyThread | null) {
  if (!thread) return "";
  const start = new Date(thread.week_start);
  const end = new Date(thread.week_end);
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

function fmtWhen(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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

function typeDotClass(t: WeeklyMessageType) {
  // puntito de color (más sutil que badges enormes)
  switch (t) {
    case "avance":
      return "bg-emerald-500";
    case "error":
      return "bg-red-500";
    case "mejora":
      return "bg-blue-500";
    case "bloqueo":
      return "bg-amber-500";
    case "decision":
      return "bg-purple-500";
    default:
      return "bg-zinc-400";
  }
}

function typePillClass(t: WeeklyMessageType) {
  switch (t) {
    case "avance":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "error":
      return "border-red-200 bg-red-50 text-red-700";
    case "mejora":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "bloqueo":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "decision":
      return "border-purple-200 bg-purple-50 text-purple-700";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
}

const TYPE_OPTIONS: Array<{ label: string; value: WeeklyMessageType }> = [
  { label: "Otro", value: "otro" },
  { label: "Avance", value: "avance" },
  { label: "Error", value: "error" },
  { label: "Mejora", value: "mejora" },
  { label: "Bloqueo", value: "bloqueo" },
  { label: "Decisión", value: "decision" },
];

/* ================= Page ================= */

export default function WeeklySyncPage() {
  const router = useRouter();
  const { getAccessToken, user, loading } = useAuth();

  const [isBooting, setIsBooting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [current, setCurrent] = useState<WeeklyThread | null>(null);
  const [weeks, setWeeks] = useState<WeeklyThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string>("");

  // Messages (vamos a mostrar ASC: viejos -> nuevos)
  const [itemsAsc, setItemsAsc] = useState<WeeklyMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null); // cursor para traer más (más viejos)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Composer
  const [text, setText] = useState("");
  const [type, setType] = useState<WeeklyMessageType>("otro");
  const [pinned, setPinned] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Close
  const [summaryDraft, setSummaryDraft] = useState("");
  const [isClosing, setIsClosing] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);

  // Sidebar search
  const [weekQuery, setWeekQuery] = useState("");

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);

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

  const isClosed = selectedThread?.status === "closed";

  const pinnedItems = useMemo(
    () => itemsAsc.filter((m) => m.pinned),
    [itemsAsc]
  );
  const normalItems = useMemo(
    () => itemsAsc.filter((m) => !m.pinned),
    [itemsAsc]
  );

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1)
      router.back();
    else router.push("/manager");
  }

  function scrollToBottom(behavior: ScrollBehavior = "smooth") {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }

  async function loadMessages(
    threadId: string,
    mode: "reset" | "more" = "reset"
  ) {
    if (!threadId) return;
    if (mode === "more" && !nextCursor) return;

    const el = scrollerRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    const prevScrollTop = el?.scrollTop ?? 0;

    setIsLoadingMessages(true);
    setError(null);

    try {
      const cursor = mode === "more" ? nextCursor : undefined;

      const res = await weeklySyncApi.listMessages(getAccessToken, threadId, {
        limit: 50,
        cursor: cursor || undefined,
      });

      // backend devuelve DESC (más nuevos primero)
      const pageAsc = (res.items ?? []).slice().reverse();

      if (mode === "reset") {
        setItemsAsc(pageAsc);
        setNextCursor(res.nextCursor ?? null);
        // al cargar una semana, te llevo al final (lo último)
        requestAnimationFrame(() => scrollToBottom("auto"));
      } else {
        // estamos cargando mensajes anteriores => se prepende al inicio, manteniendo posición
        setItemsAsc((prev) => [...pageAsc, ...prev]);
        setNextCursor(res.nextCursor ?? null);

        // mantener scroll estable al prepender
        requestAnimationFrame(() => {
          const el2 = scrollerRef.current;
          if (!el2) return;
          const newScrollHeight = el2.scrollHeight;
          const delta = newScrollHeight - prevScrollHeight;
          el2.scrollTo({ top: prevScrollTop + delta, behavior: "auto" });
        });
      }
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

      const wsNoDup = (ws || []).filter((w) => w?.id && w.id !== cur?.id);

      setCurrent(cur);
      setWeeks(wsNoDup);

      const defaultId = cur?.id || wsNoDup?.[0]?.id || "";
      setSelectedThreadId(defaultId);

      if (defaultId) {
        setItemsAsc([]);
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
    if (isClosed) return;

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

      // en ASC: se agrega al final
      setItemsAsc((prev) => [...prev, created]);

      setText("");
      setPinned(false);
      setType("otro");

      requestAnimationFrame(() => scrollToBottom("smooth"));
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setIsSending(false);
    }
  }

  async function onCloseWeek() {
    if (!selectedThreadId) return;
    if (isClosed) return;

    const ok = window.confirm(
      "¿Cerrar la semana? Esto la deja en modo solo lectura."
    );
    if (!ok) return;

    setIsClosing(true);
    setError(null);

    try {
      const updated = await weeklySyncApi.closeWeek(
        getAccessToken,
        selectedThreadId,
        {
          summary: summaryDraft.trim(),
        }
      );

      setCurrent((prev) => (prev?.id === updated.id ? updated : prev));
      setWeeks((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
      setCloseOpen(false);
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
    setItemsAsc([]);
    setNextCursor(null);
    loadMessages(selectedThreadId, "reset");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedThreadId]);

  const filteredWeeks = useMemo(() => {
    const q = weekQuery.trim().toLowerCase();
    if (!q) return weeks;
    return weeks.filter((w) => {
      const label = `${fmtWeekRange(w)} ${w.summary || ""} ${
        w.status || ""
      }`.toLowerCase();
      return label.includes(q);
    });
  }, [weeks, weekQuery]);

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
          {/* Top bar */}
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-65">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                    isClosed
                      ? "border-zinc-200 bg-zinc-50 text-zinc-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  )}
                >
                  {isClosed ? (
                    <Lock className="h-3.5 w-3.5" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5" />
                  )}
                  {selectedThread
                    ? isClosed
                      ? "Semana cerrada"
                      : "Semana abierta"
                    : "—"}
                </span>
              </div>

              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900">
                Weekly Sync
              </h1>
              <p className="text-sm text-zinc-600">
                Updates semanales entre Manager y Admin, con pinned y cierre con
                resumen.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={boot}
                loading={isBooting}
                disabled={isBooting}
                title="Actualizar"
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </span>
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4" />
              <div className="min-w-0">{error}</div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Sidebar */}
            <div className="lg:col-span-4">
              <Card>
                <CardHeader title="Semanas" subtitle="Elegí una semana" />
                <CardBody>
                  <div className="mb-3">
                    <Field label="Buscar">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                          className="pl-9"
                          value={weekQuery}
                          onChange={(e) => setWeekQuery(e.target.value)}
                          placeholder="Rango / resumen / estado…"
                        />
                      </div>
                    </Field>
                  </div>

                  {isBooting ? (
                    <SidebarSkeleton />
                  ) : (
                    <div className="space-y-3">
                      {current && (
                        <WeekRow
                          title="Semana actual"
                          thread={current}
                          active={selectedThreadId === current.id}
                          onClick={() => setSelectedThreadId(current.id)}
                        />
                      )}

                      <div className="pt-1">
                        <div className="mb-2 text-xs font-semibold text-zinc-500">
                          Historial
                        </div>

                        <div className="max-h-[55vh] overflow-auto pr-1 space-y-2">
                          {filteredWeeks.length === 0 ? (
                            <div className="rounded-xl border border-dashed p-4 text-sm text-zinc-500">
                              No hay semanas con ese filtro.
                            </div>
                          ) : (
                            filteredWeeks.map((w) => (
                              <WeekRow
                                key={w.id}
                                thread={w}
                                active={selectedThreadId === w.id}
                                onClick={() => setSelectedThreadId(w.id)}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>

            {/* Chat */}
            <div className="lg:col-span-8">
              <div className="rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col">
                {/* Header */}
                <div className="border-b p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-60">
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
                      {pinnedItems.length > 0 && (
                        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
                          <Pin className="h-3.5 w-3.5" />
                          {pinnedItems.length} pinned
                        </span>
                      )}

                      <Button
                        variant="secondary"
                        onClick={() => loadMessages(selectedThreadId, "reset")}
                        disabled={!selectedThreadId}
                        loading={isLoadingMessages}
                        title="Refrescar mensajes"
                      >
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Pinned */}
                {pinnedItems.length > 0 && (
                  <div className="border-b bg-zinc-50">
                    <div className="p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-xs font-semibold text-zinc-700 flex items-center gap-2">
                          <Pin className="h-4 w-4" />
                          Pinned
                        </div>
                      </div>
                      <div className="space-y-2">
                        {pinnedItems.map((m) => (
                          <MessageBubble
                            key={m.id}
                            m={m}
                            isMine={m.author_id === user?.id}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Messages */}
                <div className="relative flex-1">
                  <div
                    ref={scrollerRef}
                    className="h-[58vh] overflow-auto px-4 py-4"
                  >
                    <div ref={topSentinelRef} />

                    {/* Load older */}
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => loadMessages(selectedThreadId, "more")}
                        disabled={!nextCursor || isLoadingMessages}
                        loading={isLoadingMessages}
                        title="Cargar mensajes anteriores"
                      >
                        {nextCursor ? (
                          <>
                            <ChevronUp className="h-4 w-4" />
                            Cargar anteriores
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            No hay más
                          </>
                        )}
                      </Button>

                      <div className="text-xs text-zinc-500">
                        {itemsAsc.length} mensaje
                        {itemsAsc.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    {normalItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-zinc-500">
                        Todavía no hay mensajes en esta semana.
                        <div className="mt-2 text-xs text-zinc-400">
                          Usá el composer de abajo para escribir el primer
                          update.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {normalItems.map((m) => (
                          <MessageBubble
                            key={m.id}
                            m={m}
                            isMine={m.author_id === user?.id}
                          />
                        ))}
                      </div>
                    )}

                    <div className="h-4" />
                  </div>

                  {/* Composer sticky */}
                  <div className="border-t bg-white p-4 sticky bottom-0">
                    {isClosed ? (
                      <div className="rounded-2xl border bg-zinc-50 p-3 text-sm text-zinc-700 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          Semana cerrada. Solo lectura.
                        </div>
                        <Button
                          variant="secondary"
                          onClick={() => {
                            // scroll a pinned / arriba
                            scrollerRef.current?.scrollTo({
                              top: 0,
                              behavior: "smooth",
                            });
                          }}
                        >
                          Ver mensajes
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Quick controls */}
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                          <Field label="Tipo">
                            <Select
                              value={type}
                              onChange={(e) =>
                                setType(e.target.value as WeeklyMessageType)
                              }
                            >
                              {TYPE_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </Select>
                          </Field>

                          <div className="sm:mt-5 sm:ml-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setPinned((s) => !s)}
                              className={cn(
                                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold",
                                pinned
                                  ? "border-zinc-900 bg-zinc-900 text-white"
                                  : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                              )}
                              title="Pin"
                            >
                              <Pin className="h-4 w-4" />
                              {pinned ? "Pinned" : "Pin"}
                            </button>
                          </div>

                          <div className="sm:ml-auto" />

                          <Button
                            onClick={onSend}
                            disabled={isSending || !text.trim()}
                            loading={isSending}
                            title="Enviar (Ctrl/⌘ + Enter)"
                          >
                            <span className="inline-flex items-center gap-2">
                              <Send className="h-4 w-4" />
                              Enviar
                            </span>
                          </Button>
                        </div>

                        {/* Textarea */}
                        <div className="rounded-2xl border border-zinc-200 focus-within:ring-4 focus-within:ring-zinc-100 overflow-hidden">
                          <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            rows={3}
                            placeholder="Escribí el update semanal… (Ctrl/⌘ + Enter para enviar)"
                            className="w-full resize-none bg-white px-3 py-2 text-sm outline-none text-black"
                            onKeyDown={(e) => {
                              if ((e.ctrlKey || e.metaKey) && e.key === "Enter")
                                onSend();
                            }}
                          />
                          <div className="flex items-center justify-between border-t bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                            <span>
                              <span
                                className={cn(
                                  "inline-block h-2 w-2 rounded-full mr-2",
                                  typeDotClass(type)
                                )}
                              />
                              {typeLabel(type)}
                            </span>
                            <span>{text.trim().length} chars</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Close Week (collapsible) */}
                <div className="border-t bg-white">
                  <button
                    type="button"
                    onClick={() => setCloseOpen((s) => !s)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50"
                  >
                    <div className="text-left">
                      <div className="text-sm font-semibold text-zinc-900">
                        Cerrar semana
                      </div>
                      <div className="text-xs text-zinc-500">
                        Guardá un resumen final y dejala solo lectura.
                      </div>
                    </div>
                    {closeOpen ? (
                      <X className="h-4 w-4 text-zinc-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-500" />
                    )}
                  </button>

                  {closeOpen && (
                    <div className="p-4 border-t bg-zinc-50">
                      {isClosed ? (
                        <div className="rounded-2xl border bg-white p-4">
                          <div className="text-sm font-semibold text-zinc-900">
                            Resumen guardado
                          </div>
                          {selectedThread?.summary ? (
                            <div className="mt-2 whitespace-pre-wrap text-sm text-zinc-800">
                              {selectedThread.summary}
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-zinc-500">
                              Sin resumen.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <textarea
                            value={summaryDraft}
                            onChange={(e) => setSummaryDraft(e.target.value)}
                            rows={4}
                            placeholder="Resumen final (opcional)…"
                            className="w-full resize-none rounded-2xl border bg-white px-3 py-2 text-sm outline-none text-black focus:ring-4 focus:ring-zinc-100"
                          />

                          <div className="flex justify-end gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => setCloseOpen(false)}
                              disabled={isClosing}
                            >
                              Cancelar
                            </Button>
                            <Button
                              onClick={onCloseWeek}
                              loading={isClosing}
                              disabled={isClosing}
                            >
                              Cerrar semana
                            </Button>
                          </div>
                        </div>
                      )}

                      {selectedThread?.summary && isClosed && (
                        <div className="mt-3 text-xs text-zinc-500">
                          Tip: si querés “reabrir”, necesitás un endpoint (no
                          existe acá).
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 text-xs text-zinc-500">
                Roles: <b>ADMIN</b>/<b>MANAGER</b> • Ruta:{" "}
                <span className="font-mono">/weekly-sync</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Protected>
  );
}

/* ================= Components ================= */

function WeekRow({
  thread,
  title,
  active,
  onClick,
}: {
  thread: WeeklyThread;
  title?: string;
  active: boolean;
  onClick: () => void;
}) {
  const isOpen = thread.status === "open";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border p-3 text-left transition",
        active
          ? "border-zinc-900 bg-white"
          : "border-zinc-200 bg-white hover:bg-zinc-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title ? (
            <div className="text-sm font-semibold text-zinc-900">{title}</div>
          ) : (
            <div className="text-sm font-semibold text-zinc-900">
              {fmtWeekRange(thread)}
            </div>
          )}
          {!title && (
            <div className="mt-1 text-xs text-zinc-500">
              {thread.summary ? (
                <span className="line-clamp-2">{thread.summary}</span>
              ) : (
                <span className="text-zinc-400">Sin resumen</span>
              )}
            </div>
          )}
          {title && (
            <div className="mt-1 text-xs text-zinc-600">
              {fmtWeekRange(thread)}
            </div>
          )}
        </div>

        <span
          className={cn(
            "shrink-0 inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
            isOpen
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-zinc-200 bg-zinc-50 text-zinc-700"
          )}
        >
          {isOpen ? "Abierta" : "Cerrada"}
        </span>
      </div>
    </button>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3"
        >
          <div className="h-4 w-2/3 rounded bg-zinc-200" />
          <div className="mt-2 h-3 w-1/2 rounded bg-zinc-200" />
        </div>
      ))}
    </div>
  );
}

function MessageBubble({ m, isMine }: { m: WeeklyMessage; isMine: boolean }) {
  const authorLabel =
    (m.author_email && String(m.author_email)) || m.author_id || "—";

  return (
    <div className={cn("flex", isMine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[92%] sm:max-w-[78%] rounded-2xl border px-3 py-2 shadow-sm",
          isMine
            ? "border-zinc-900 bg-zinc-900 text-white"
            : "border-zinc-200 bg-white text-zinc-900"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-xs font-semibold",
                isMine
                  ? "border-white/20 bg-white/10 text-white"
                  : typePillClass(m.type)
              )}
            >
              {!isMine && (
                <span
                  className={cn("h-2 w-2 rounded-full", typeDotClass(m.type))}
                />
              )}
              {typeLabel(m.type)}
            </span>

            {m.pinned && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                  isMine
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-zinc-200 bg-zinc-50 text-zinc-700"
                )}
              >
                <Pin className="h-3.5 w-3.5" />
                Pinned
              </span>
            )}
          </div>

          <div
            className={cn(
              "text-xs",
              isMine ? "text-white/70" : "text-zinc-500"
            )}
          >
            {fmtWhen(m.createdAt)} •{" "}
            <span className="font-mono">{authorLabel}</span>
          </div>
        </div>

        <div
          className={cn(
            "mt-2 whitespace-pre-wrap wrap-break-words text-sm",
            isMine ? "text-white" : "text-zinc-900"
          )}
        >
          {m.text}
        </div>
      </div>
    </div>
  );
}
