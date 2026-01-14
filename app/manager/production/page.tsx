"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  RefreshCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  ClipboardList,
  Filter,
  X,
  Plus,
  ChevronDown,
  ChevronUp,
  Ban,
  RotateCcw,
} from "lucide-react";

type EmployeeRow = { id: string; fullName: string };
type TaskRow = { id: string; name: string; area: string | null; isActive: boolean };

type ProductionStatus = "PENDING" | "DONE" | "CANCELED";

type ProductionNote = {
  text: string;
  createdAt: string | null;
  createdBy: string | null;
  createdByName?: string | null;
};

type ProductionRow = {
  id: string;
  dateKey: string;
  performedAt: string;
  time?: string | null;

  status?: ProductionStatus;
  isDone?: boolean;

  doneAt?: string | null;
  doneBy?: string | null;

  canceledAt?: string | null;
  canceledBy?: string | null;

  employeeId: string;
  employeeName?: string | null;

  taskId: string;
  taskName?: string | null;

  qty: number | null;
  notes: ProductionNote[];
};

function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function fmtTime(dt?: string) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function fmtDateTime(dt?: string) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function lastNoteText(notes?: ProductionNote[]) {
  if (!Array.isArray(notes) || notes.length === 0) return "";
  const last = notes[notes.length - 1];
  return String(last?.text ?? "").trim();
}

export default function ProductionPage() {
  const { getAccessToken, user } = useAuth() as any;

  const roles = (user?.roles || []).map((r: string) => String(r).toUpperCase());
  const allowed = roles.includes("ADMIN") || roles.includes("MANAGER");

  const [dateKey, setDateKey] = useState(todayKeyArgentina());

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [rows, setRows] = useState<ProductionRow[]>([]);

  // form
  const [employeeId, setEmployeeId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [qty, setQty] = useState<string>("");
  const [initialNote, setInitialNote] = useState("");

  // list filters
  const [q, setQ] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterTaskId, setFilterTaskId] = useState("");
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);
  const [onlyWithQty, setOnlyWithQty] = useState(false);
  const [onlyDone, setOnlyDone] = useState(false);
  const [hideCanceled, setHideCanceled] = useState(true);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyRefresh, setBusyRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // per row actions
  const [noteDraftById, setNoteDraftById] = useState<Record<string, string>>({});
  const [noteBusyId, setNoteBusyId] = useState<string | null>(null);
  const [doneBusyId, setDoneBusyId] = useState<string | null>(null);
  const [cancelBusyId, setCancelBusyId] = useState<string | null>(null);

  // expand notes per row
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});

  const qtyRef = useRef<HTMLInputElement | null>(null);

  const employeeMap = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, e.fullName));
    return m;
  }, [employees]);

  const taskMap = useMemo(() => {
    const m = new Map<string, string>();
    tasks.forEach((t) => m.set(t.id, t.area ? `${t.name} • ${t.area}` : t.name));
    return m;
  }, [tasks]);

  const stats = useMemo(() => {
    const total = rows.length;
    const withNotes = rows.filter((r) => (r.notes || []).length > 0).length;
    const withQty = rows.filter((r) => r.qty !== null && Number.isFinite(r.qty)).length;
    const done = rows.filter((r) => r.status === "DONE" || Boolean(r.isDone)).length;
    const canceled = rows.filter((r) => r.status === "CANCELED").length;
    return { total, withNotes, withQty, done, canceled };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = q.trim().toLowerCase();

    return rows.filter((r) => {
      if (hideCanceled && r.status === "CANCELED") return false;

      if (filterEmployeeId && r.employeeId !== filterEmployeeId) return false;
      if (filterTaskId && r.taskId !== filterTaskId) return false;

      const hasNotes = (r.notes || []).length > 0;
      if (onlyWithNotes && !hasNotes) return false;

      const hasQty = r.qty !== null && Number.isFinite(r.qty);
      if (onlyWithQty && !hasQty) return false;

      const isDone = r.status === "DONE" || Boolean(r.isDone);
      if (onlyDone && !isDone) return false;

      if (!query) return true;

      const emp = employeeMap.get(r.employeeId) ?? r.employeeName ?? r.employeeId;
      const task = taskMap.get(r.taskId) ?? r.taskName ?? r.taskId;
      const notesText = (r.notes || []).map((n) => n.text).join(" ");

      const hay = `${emp} ${task} ${notesText} ${r.qty ?? ""} ${r.time ?? ""} ${r.status ?? ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [
    rows,
    q,
    filterEmployeeId,
    filterTaskId,
    onlyWithNotes,
    onlyWithQty,
    onlyDone,
    hideCanceled,
    employeeMap,
    taskMap,
  ]);

  async function loadAll(opts?: { keepSelection?: boolean }) {
    setError(null);
    setOkMsg(null);
    setLoading(true);

    try {
      const emps = await apiFetchAuthed<EmployeeRow[]>(getAccessToken, "/employees?activeOnly=true");
      setEmployees(Array.isArray(emps) ? emps : []);

      const activeTasks = await apiFetchAuthed<TaskRow[]>(getAccessToken, "/tasks?activeOnly=true");
      setTasks(Array.isArray(activeTasks) ? activeTasks : []);

      const prod = await apiFetchAuthed<ProductionRow[]>(
        getAccessToken,
        `/production?dateKey=${encodeURIComponent(dateKey)}&limit=500`
      );

      const normalized = Array.isArray(prod)
        ? prod.map((r: any) => ({ ...r, notes: Array.isArray(r.notes) ? r.notes : [] }))
        : [];

      setRows(normalized);

      if (!opts?.keepSelection) {
        if (!employeeId && Array.isArray(emps) && emps[0]?.id) setEmployeeId(emps[0].id);
        if (!taskId && Array.isArray(activeTasks) && activeTasks[0]?.id) setTaskId(activeTasks[0].id);
      }
    } catch (e: any) {
      setError(e?.message || "Error cargando producción");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setBusyRefresh(true);
    try {
      await loadAll({ keepSelection: true });
      setOkMsg("Actualizado ✔");
      window.setTimeout(() => setOkMsg(null), 2500);
    } finally {
      setBusyRefresh(false);
    }
  }

  useEffect(() => {
    if (!allowed) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, allowed]);

  async function createEntry() {
    if (!employeeId || !taskId) return;

    setError(null);
    setOkMsg(null);
    setBusy(true);

    const qtyValue = qty.trim() ? Number(qty) : null;
    if (qty.trim() && !Number.isFinite(qtyValue)) {
      setBusy(false);
      setError("Cantidad inválida.");
      return;
    }

    try {
      const created = await apiFetchAuthed<ProductionRow>(getAccessToken, "/production", {
        method: "POST",
        body: JSON.stringify({ employeeId, taskId, qty: qtyValue }),
      });

      if (initialNote.trim()) {
        await apiFetchAuthed(getAccessToken, `/production/${created.id}/notes`, {
          method: "POST",
          body: JSON.stringify({ text: initialNote.trim() }),
        });
      }

      setQty("");
      setInitialNote("");
      qtyRef.current?.focus();

      await loadAll({ keepSelection: true });

      setOkMsg("Registro guardado ✔");
      window.setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error creando producción");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDone(row: ProductionRow) {
    if (row.status === "CANCELED") return;

    const isDone = row.status === "DONE" || Boolean(row.isDone);
    const next = !isDone;

    setError(null);
    setOkMsg(null);
    setDoneBusyId(row.id);

    try {
      await apiFetchAuthed(getAccessToken, `/production/${row.id}/done`, {
        method: "PATCH",
        body: JSON.stringify({ done: next }),
      });

      await loadAll({ keepSelection: true });
      setOkMsg(next ? "Marcado como hecho ✔" : "Marcado como pendiente ✔");
      window.setTimeout(() => setOkMsg(null), 2000);
    } catch (e: any) {
      setError(e?.message || "Error actualizando estado");
    } finally {
      setDoneBusyId(null);
    }
  }

  async function toggleCanceled(row: ProductionRow) {
    const isCanceled = row.status === "CANCELED";
    const next = !isCanceled;

    const ok = window.confirm(next ? "¿Cancelar este registro? (No se elimina)" : "¿Reabrir este registro?");
    if (!ok) return;

    setError(null);
    setOkMsg(null);
    setCancelBusyId(row.id);

    try {
      await apiFetchAuthed(getAccessToken, `/production/${row.id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ canceled: next }),
      });

      await loadAll({ keepSelection: true });
      setOkMsg(next ? "Registro cancelado ✔" : "Registro reabierto ✔");
      window.setTimeout(() => setOkMsg(null), 2000);
    } catch (e: any) {
      setError(e?.message || "Error cancelando/reabriendo");
    } finally {
      setCancelBusyId(null);
    }
  }

  async function addNote(rowId: string) {
    const text = (noteDraftById[rowId] ?? "").trim();
    if (!text) return;

    setError(null);
    setOkMsg(null);
    setNoteBusyId(rowId);

    try {
      await apiFetchAuthed(getAccessToken, `/production/${rowId}/notes`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });

      setNoteDraftById((m) => ({ ...m, [rowId]: "" }));
      // abrimos automáticamente el accordion para que se vea
      setExpandedNotes((m) => ({ ...m, [rowId]: true }));

      await loadAll({ keepSelection: true });

      setOkMsg("Nota agregada ✔");
      window.setTimeout(() => setOkMsg(null), 2000);
    } catch (e: any) {
      setError(e?.message || "Error agregando nota");
    } finally {
      setNoteBusyId(null);
    }
  }

  function resetFilters() {
    setQ("");
    setFilterEmployeeId("");
    setFilterTaskId("");
    setOnlyWithNotes(false);
    setOnlyWithQty(false);
    setOnlyDone(false);
    setHideCanceled(true);
  }

  if (!allowed) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
          No autorizado (requiere ADMIN o MANAGER).
        </div>
      </div>
    );
  }

  const hasActiveFilters =
    q.trim() || filterEmployeeId || filterTaskId || onlyWithNotes || onlyWithQty || onlyDone || !hideCanceled;

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-zinc-900">Producción</h1>

                {!loading && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                      rows.length > 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600"
                    )}
                  >
                    {rows.length > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        {rows.length} registros
                      </span>
                    ) : (
                      "Sin registros"
                    )}
                  </span>
                )}

                <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                  <Clock className="h-4 w-4" />
                  {dateKey}
                </span>
              </div>

              <p className="mt-1 text-sm text-zinc-500">
                Notas expandibles por registro. Los registros no se eliminan: se cancelan.
              </p>

              {!loading && stats.canceled > 0 && (
                <div className="mt-1 text-xs text-zinc-500">
                  Cancelados: <b className="text-zinc-900">{stats.canceled}</b> (podés mostrarlos con el filtro)
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input type="date" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
              <Button variant="secondary" onClick={refresh} disabled={busy || busyRefresh} loading={busyRefresh}>
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {(error || okMsg) && (
            <div className="mt-3 grid gap-2">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              {okMsg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {okMsg}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader title="Nuevo registro" subtitle="Seleccioná empleado + tarea y guardá." />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Empleado">
                <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} disabled={loading || busy}>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Tarea">
                <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} disabled={loading || busy}>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.area ? `${t.name} • ${t.area}` : t.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Cantidad (opcional)">
                <Input
                  type="number"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  placeholder="Ej: 10"
                  inputMode="numeric"
                  disabled={busy}
                  ref={qtyRef}
                />
              </Field>

              <Field label="Nota inicial (opcional)">
                <Input
                  value={initialNote}
                  onChange={(e) => setInitialNote(e.target.value)}
                  placeholder="Ej: faltó material / ok"
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) createEntry();
                  }}
                />
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-zinc-500">
                Tip: <b>Ctrl/⌘ + Enter</b> para guardar rápido desde Nota inicial.
              </div>

              <Button onClick={createEntry} disabled={busy || !employeeId || !taskId} loading={busy}>
                Guardar registro
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Filtros de registros" subtitle="Encontrá rápido por empleado, tarea o texto." />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Buscar (texto)">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Empleado, tarea, notas…"
                    className="pl-9"
                    disabled={loading}
                  />
                </div>
              </Field>

              <Field label="Empleado">
                <Select value={filterEmployeeId} onChange={(e) => setFilterEmployeeId(e.target.value)} disabled={loading}>
                  <option value="">Todos</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Tarea">
                <Select value={filterTaskId} onChange={(e) => setFilterTaskId(e.target.value)} disabled={loading}>
                  <option value="">Todas</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.area ? `${t.name} • ${t.area}` : t.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="flex items-end justify-end gap-2">
                <Button
                  variant={!hideCanceled ? "secondary" : "ghost"}
                  onClick={() => setHideCanceled((v) => !v)}
                  disabled={loading}
                >
                  {!hideCanceled ? "Mostrando cancelados" : "Ocultar cancelados"}
                </Button>

                <Button variant={onlyDone ? "secondary" : "ghost"} onClick={() => setOnlyDone((v) => !v)} disabled={loading}>
                  {onlyDone ? "Solo hechas" : "Hechas"}
                </Button>

                <Button
                  variant={onlyWithNotes ? "secondary" : "ghost"}
                  onClick={() => setOnlyWithNotes((v) => !v)}
                  disabled={loading}
                >
                  {onlyWithNotes ? "Solo con notas" : "Con notas"}
                </Button>

                <Button
                  variant={onlyWithQty ? "secondary" : "ghost"}
                  onClick={() => setOnlyWithQty((v) => !v)}
                  disabled={loading}
                >
                  {onlyWithQty ? "Solo con qty" : "Con qty"}
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                  <ClipboardList className="h-4 w-4 text-zinc-500" />
                  Mostrando <b className="text-zinc-900">{filteredRows.length}</b> / {rows.length}
                </span>

                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-700">
                  <CheckCircle2 className="h-4 w-4 text-zinc-500" />
                  Hechas: <b className="text-zinc-900">{stats.done}</b>
                </span>

                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-700">
                  <Filter className="h-4 w-4 text-zinc-500" />
                  Con qty: <b className="text-zinc-900">{stats.withQty}</b>
                </span>

                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-700">
                  <User className="h-4 w-4 text-zinc-500" />
                  Con notas: <b className="text-zinc-900">{stats.withNotes}</b>
                </span>
              </div>

              {hasActiveFilters && (
                <Button variant="secondary" onClick={resetFilters}>
                  <span className="inline-flex items-center gap-2">
                    <X className="h-4 w-4" />
                    Limpiar filtros
                  </span>
                </Button>
              )}
            </div>
          </CardBody>
        </Card>

        {/* LIST */}
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">Registros del día</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Fecha: <b className="text-zinc-900">{dateKey}</b>
                </p>
              </div>

              {!loading && filteredRows.length === 0 && rows.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  Sin resultados con estos filtros
                </span>
              )}
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Hora
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Empleado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Tarea
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Notas
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {!loading &&
                  filteredRows.map((r) => {
                    const emp = employeeMap.get(r.employeeId) ?? r.employeeName ?? r.employeeId;
                    const task = taskMap.get(r.taskId) ?? r.taskName ?? r.taskId;

                    const isDone = r.status === "DONE" || Boolean(r.isDone);
                    const isCanceled = r.status === "CANCELED";
                    const notesCount = (r.notes || []).length;
                    const lastNote = lastNoteText(r.notes);
                    const showTime = (r.time ?? "").trim() ? String(r.time) : fmtTime(r.performedAt);
                    const open = Boolean(expandedNotes[r.id]);

                    return (
                      <tr key={r.id} className={cn("hover:bg-zinc-50/60 align-top", isCanceled && "opacity-60")}>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {showTime}
                          <div className="text-xs text-zinc-500">{fmtDateTime(r.performedAt)}</div>
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-zinc-900">{emp}</td>

                        <td className="px-4 py-3 text-sm text-zinc-700">{task}</td>

                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                              isCanceled
                                ? "border-red-200 bg-red-50 text-red-700"
                                : isDone
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-zinc-200 bg-zinc-50 text-zinc-700"
                            )}
                          >
                            {isCanceled ? "CANCELADA" : isDone ? "HECHA" : "PENDIENTE"}
                          </span>

                          {isCanceled && r.canceledAt && (
                            <div className="mt-1 text-xs text-zinc-500">Cancel: {fmtDateTime(r.canceledAt)}</div>
                          )}
                          {isDone && r.doneAt && !isCanceled && (
                            <div className="mt-1 text-xs text-zinc-500">Done: {fmtDateTime(r.doneAt)}</div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">{r.qty ?? "—"}</td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-xs text-zinc-500">
                                {notesCount} nota{notesCount === 1 ? "" : "s"}
                              </div>

                              <button
                                className="text-xs font-semibold text-zinc-700 hover:text-zinc-900 inline-flex items-center gap-1"
                                onClick={() => setExpandedNotes((m) => ({ ...m, [r.id]: !open }))}
                              >
                                {open ? (
                                  <>
                                    Ocultar <ChevronUp className="h-4 w-4" />
                                  </>
                                ) : (
                                  <>
                                    Ver notas <ChevronDown className="h-4 w-4" />
                                  </>
                                )}
                              </button>
                            </div>

                            {notesCount > 0 && !open && (
                              <div className="line-clamp-2 text-sm">{lastNote || "—"}</div>
                            )}

                            {open && (
                              <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                                {notesCount === 0 ? (
                                  <div className="text-sm text-zinc-600">Sin notas todavía.</div>
                                ) : (
                                  <ul className="space-y-2">
                                    {r.notes.map((n, idx) => (
                                      <li key={idx} className="text-sm text-zinc-800">
                                        <div className="flex items-center justify-between gap-2">
                                          <span className="font-semibold">{n.createdByName ?? "—"}</span>
                                          <span className="text-xs text-zinc-500">
                                            {n.createdAt ? fmtDateTime(n.createdAt) : "—"}
                                          </span>
                                        </div>
                                        <div className="mt-1 text-zinc-700 whitespace-pre-wrap">{n.text}</div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <Input
                                value={noteDraftById[r.id] ?? ""}
                                onChange={(e) => setNoteDraftById((m) => ({ ...m, [r.id]: e.target.value }))}
                                placeholder={isCanceled ? "Registro cancelado" : "Agregar nota…"}
                                disabled={busy || noteBusyId === r.id || isCanceled}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote(r.id);
                                }}
                              />
                              <Button
                                variant="secondary"
                                disabled={
                                  busy ||
                                  isCanceled ||
                                  noteBusyId === r.id ||
                                  !(noteDraftById[r.id] ?? "").trim()
                                }
                                loading={noteBusyId === r.id}
                                onClick={() => addNote(r.id)}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <Plus className="h-4 w-4" />
                                  Nota
                                </span>
                              </Button>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <Button
                              disabled={busy || doneBusyId === r.id || isCanceled}
                              loading={doneBusyId === r.id}
                              onClick={() => toggleDone(r)}
                            >
                              {isDone ? "Marcar pendiente" : "Marcar hecha"}
                            </Button>

                            <Button
                              variant={isCanceled ? "secondary" : "danger"}
                              disabled={busy || cancelBusyId === r.id}
                              loading={cancelBusyId === r.id}
                              onClick={() => toggleCanceled(r)}
                            >
                              <span className="inline-flex items-center gap-2">
                                {isCanceled ? <RotateCcw className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                                {isCanceled ? "Reabrir" : "Cancelar"}
                              </span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden p-4 text-sm text-zinc-500">
            Te lo adapto a mobile igual que desktop si querés (con acordeón de notas + cancelar/reabrir).
          </div>

          <div className="border-t border-zinc-100 px-5 py-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-zinc-500">Tip: Ctrl/⌘ + Enter para agregar nota rápido.</div>
            <Button variant="secondary" onClick={refresh} disabled={busy || busyRefresh} loading={busyRefresh}>
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
