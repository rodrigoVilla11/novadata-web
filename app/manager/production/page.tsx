"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

import {
  RefreshCcw,
  Search,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  ClipboardList,
  Filter,
  X,
  ArrowLeft,
} from "lucide-react";

type EmployeeRow = { id: string; fullName: string };
type TaskRow = {
  id: string;
  name: string;
  area: string | null;
  isActive: boolean;
};
type ProductionRow = {
  id: string;
  dateKey: string;
  performedAt: string;
  employeeId: string;
  taskId: string;
  qty: number | null;
  notes: string | null;
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
    return new Date(dt).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });
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

export default function ProductionPage() {
  const router = useRouter();
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
  const [notes, setNotes] = useState("");

  // list filters
  const [q, setQ] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [filterTaskId, setFilterTaskId] = useState("");
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);
  const [onlyWithQty, setOnlyWithQty] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyRefresh, setBusyRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const qtyRef = useRef<HTMLInputElement | null>(null);
  const notesRef = useRef<HTMLInputElement | null>(null);

  const employeeMap = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, e.fullName));
    return m;
  }, [employees]);

  const taskMap = useMemo(() => {
    const m = new Map<string, string>();
    tasks.forEach((t) =>
      m.set(t.id, t.area ? `${t.name} • ${t.area}` : t.name)
    );
    return m;
  }, [tasks]);

  const stats = useMemo(() => {
    const total = rows.length;
    const withNotes = rows.filter((r) => (r.notes ?? "").trim()).length;
    const withQty = rows.filter(
      (r) => r.qty !== null && Number.isFinite(r.qty)
    ).length;
    return { total, withNotes, withQty };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterEmployeeId && r.employeeId !== filterEmployeeId) return false;
      if (filterTaskId && r.taskId !== filterTaskId) return false;
      if (onlyWithNotes && !(r.notes ?? "").trim()) return false;
      if (onlyWithQty && !(r.qty !== null && Number.isFinite(r.qty)))
        return false;

      if (!query) return true;

      const emp = employeeMap.get(r.employeeId) ?? r.employeeId;
      const task = taskMap.get(r.taskId) ?? r.taskId;
      const hay = `${emp} ${task} ${r.notes ?? ""} ${
        r.qty ?? ""
      }`.toLowerCase();
      return hay.includes(query);
    });
  }, [
    rows,
    q,
    filterEmployeeId,
    filterTaskId,
    onlyWithNotes,
    onlyWithQty,
    employeeMap,
    taskMap,
  ]);

  async function loadAll(opts?: { keepSelection?: boolean }) {
    setError(null);
    setOkMsg(null);
    setLoading(true);

    try {
      const emps = await apiFetchAuthed<EmployeeRow[]>(
        getAccessToken,
        "/employees?activeOnly=true"
      );
      setEmployees(emps);

      const activeTasks = await apiFetchAuthed<TaskRow[]>(
        getAccessToken,
        "/tasks?activeOnly=true"
      );
      setTasks(activeTasks);

      const prod = await apiFetchAuthed<ProductionRow[]>(
        getAccessToken,
        `/production?dateKey=${encodeURIComponent(dateKey)}&limit=500`
      );
      setRows(Array.isArray(prod) ? prod : []);

      if (!opts?.keepSelection) {
        if (!employeeId && emps[0]?.id) setEmployeeId(emps[0].id);
        if (!taskId && activeTasks[0]?.id) setTaskId(activeTasks[0].id);
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
      await apiFetchAuthed(getAccessToken, "/production", {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          taskId,
          qty: qtyValue,
          notes: notes.trim() ? notes.trim() : null,
        }),
      });

      setQty("");
      setNotes("");

      // UX: foco en qty para carga rápida
      notesRef.current?.blur();
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

  async function removeEntry(id: string) {
    const ok = window.confirm("¿Eliminar este registro?");
    if (!ok) return;

    setError(null);
    setOkMsg(null);
    setBusy(true);

    try {
      await apiFetchAuthed(getAccessToken, `/production/${id}`, {
        method: "DELETE",
      });

      await loadAll({ keepSelection: true });

      setOkMsg("Eliminado ✔");
      window.setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error eliminando registro");
    } finally {
      setBusy(false);
    }
  }

  function resetFilters() {
    setQ("");
    setFilterEmployeeId("");
    setFilterTaskId("");
    setOnlyWithNotes(false);
    setOnlyWithQty(false);
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
    q.trim() ||
    filterEmployeeId ||
    filterTaskId ||
    onlyWithNotes ||
    onlyWithQty;

  const lastPerformedAt = useMemo(() => {
    // Si tu backend ya devuelve ordenado DESC, rows[0] sirve.
    // Si no, calculamos por seguridad:
    const first = rows[0]?.performedAt;
    if (first) return first;
    return null;
  }, [rows]);

  return (
    <div className="space-y-6">
      {/* Sticky header (para ManagerShell) */}
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
                      stats.total > 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600"
                    )}
                  >
                    {stats.total > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        {stats.total} registros
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
                Registrá qué hizo cada empleado y a qué hora.
              </p>

              {!loading && lastPerformedAt && (
                <div className="mt-2 text-xs text-zinc-500">
                  Último:{" "}
                  <b className="text-zinc-900">
                    {fmtDateTime(lastPerformedAt)}
                  </b>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateKey}
                onChange={(e) => setDateKey(e.target.value)}
              />

              <Button
                variant="secondary"
                onClick={refresh}
                disabled={busy || busyRefresh}
                loading={busyRefresh}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                </span>
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

      {/* Content */}
      <div className="space-y-6">
        {/* Create card */}
        <Card>
          <CardHeader
            title="Nuevo registro"
            subtitle="Seleccioná empleado + tarea y guardá."
          />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Empleado">
                <Select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  disabled={loading || busy}
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Tarea">
                <Select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  disabled={loading || busy}
                >
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
                />
              </Field>

              <Field label="Notas (opcional)">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: antes de las 20hs"
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      createEntry();
                    }
                  }}
                />
              </Field>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-zinc-500">
                Tip: <b>Ctrl/⌘ + Enter</b> para guardar rápido cuando estás en
                Notas.
              </div>

              <Button
                onClick={createEntry}
                disabled={busy || !employeeId || !taskId}
                loading={busy}
              >
                Guardar registro
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Filters */}
        <Card>
          <CardHeader
            title="Filtros de registros"
            subtitle="Encontrá rápido por empleado, tarea o texto."
          />
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
                <Select
                  value={filterEmployeeId}
                  onChange={(e) => setFilterEmployeeId(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Todos</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Tarea">
                <Select
                  value={filterTaskId}
                  onChange={(e) => setFilterTaskId(e.target.value)}
                  disabled={loading}
                >
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
                  variant={onlyWithQty ? "secondary" : "ghost"}
                  onClick={() => setOnlyWithQty((v) => !v)}
                  disabled={loading}
                >
                  {onlyWithQty ? "Solo con qty" : "Con qty"}
                </Button>

                <Button
                  variant={onlyWithNotes ? "secondary" : "ghost"}
                  onClick={() => setOnlyWithNotes((v) => !v)}
                  disabled={loading}
                >
                  {onlyWithNotes ? "Solo con notas" : "Con notas"}
                </Button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                  <ClipboardList className="h-4 w-4 text-zinc-500" />
                  Mostrando{" "}
                  <b className="text-zinc-900">{filteredRows.length}</b> /{" "}
                  {rows.length}
                </span>

                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-700">
                  <User className="h-4 w-4 text-zinc-500" />
                  Con notas: <b className="text-zinc-900">{stats.withNotes}</b>
                </span>

                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-700">
                  <Filter className="h-4 w-4 text-zinc-500" />
                  Con qty: <b className="text-zinc-900">{stats.withQty}</b>
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

        {/* List */}
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  Registros del día
                </h2>
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

          {/* Desktop table */}
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
                {loading &&
                  [...Array(8)].map((_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-4">
                        <div className="h-4 w-16 bg-zinc-100 rounded animate-pulse" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-48 bg-zinc-100 rounded animate-pulse" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-56 bg-zinc-100 rounded animate-pulse" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-10 bg-zinc-100 rounded animate-pulse" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-64 bg-zinc-100 rounded animate-pulse" />
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-8 w-24 bg-zinc-100 rounded-xl animate-pulse" />
                      </td>
                    </tr>
                  ))}

                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-sm text-zinc-500">
                      {rows.length === 0
                        ? "Sin registros."
                        : "No hay resultados con estos filtros."}
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredRows.map((r) => {
                    const emp = employeeMap.get(r.employeeId) ?? r.employeeId;
                    const task = taskMap.get(r.taskId) ?? r.taskId;
                    const hasNotes = (r.notes ?? "").trim().length > 0;

                    return (
                      <tr key={r.id} className="hover:bg-zinc-50/60">
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {fmtTime(r.performedAt)}
                          <div className="text-xs text-zinc-500">
                            {fmtDateTime(r.performedAt)}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                          {emp}
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {task}
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {r.qty ?? "—"}
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {hasNotes ? (
                            <span className="line-clamp-2">{r.notes}</span>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <Button
                            variant="danger"
                            disabled={busy}
                            onClick={() => removeEntry(r.id)}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Trash2 className="h-4 w-4" />
                              Eliminar
                            </span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden p-4 space-y-3">
            {loading ? (
              <div className="space-y-3">
                <div className="h-20 rounded-2xl bg-zinc-100 animate-pulse" />
                <div className="h-20 rounded-2xl bg-zinc-100 animate-pulse" />
                <div className="h-20 rounded-2xl bg-zinc-100 animate-pulse" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="text-sm text-zinc-500">
                {rows.length === 0
                  ? "Sin registros."
                  : "No hay resultados con estos filtros."}
              </div>
            ) : (
              filteredRows.map((r) => {
                const emp = employeeMap.get(r.employeeId) ?? r.employeeId;
                const task = taskMap.get(r.taskId) ?? r.taskId;

                return (
                  <div
                    key={r.id}
                    className="rounded-2xl border border-zinc-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">
                          {emp}
                        </div>
                        <div className="mt-1 text-sm text-zinc-700">{task}</div>
                        <div className="mt-2 text-xs text-zinc-500">
                          {fmtDateTime(r.performedAt)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-zinc-500">Qty</div>
                        <div className="text-sm font-semibold text-zinc-900">
                          {r.qty ?? "—"}
                        </div>
                      </div>
                    </div>

                    {r.notes?.trim() && (
                      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                        {r.notes}
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => removeEntry(r.id)}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-zinc-100 px-5 py-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-zinc-500">
              Tip: usá filtros para encontrar rápido y refrescá si están
              cargando muchos registros.
            </div>
            <Button
              variant="secondary"
              onClick={refresh}
              disabled={busy || busyRefresh}
              loading={busyRefresh}
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
