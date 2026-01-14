"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  Camera,
  ExternalLink,
  X,
  User,
  ClipboardCheck,
  LogIn,
  LogOut,
} from "lucide-react";

type EmployeeRow = { id: string; fullName: string; isActive: boolean };

type AttendanceRow = {
  id: string;
  dateKey: string;
  employeeId: string;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
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

function isValidDateKey(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function fmtTime(dt?: string | null) {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    return d.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Cordoba",
    });
  } catch {
    return "—";
  }
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function isValidUrl(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

type TabKey = "ALL" | "PENDING" | "DONE" | "NOTES";

/* ===========================
 * Page
 * =========================== */

export default function AttendancePage() {
  const { getAccessToken, user } = useAuth() as any;

  const roles: string[] = (user?.roles || []).map((r: any) =>
    String(r).toUpperCase()
  );
  const allowed = roles.includes("ADMIN") || roles.includes("MANAGER");

  const [dateKey, setDateKey] = useState(todayKeyArgentina());
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  // Form (accion principal)
  const [photoUrl, setPhotoUrl] = useState("");
  const [notes, setNotes] = useState("");

  // UI/filters
  const [tab, setTab] = useState<TabKey>("ALL");
  const [q, setQ] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");

  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [busyRefresh, setBusyRefresh] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // Modal detalle
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const employeeMap = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, e.fullName));
    return m;
  }, [employees]);

  const selectedRow = useMemo(() => {
    if (!selectedEmployeeId) return null;
    return rows.find((r) => r.employeeId === selectedEmployeeId) ?? null;
  }, [rows, selectedEmployeeId]);

  const stats = useMemo(() => {
    const total = rows.length;
    const checkedIn = rows.filter((r) => !!r.checkInAt).length;
    const checkedOut = rows.filter((r) => !!r.checkOutAt).length;
    const pendingCheckout = rows.filter((r) => !!r.checkInAt && !r.checkOutAt)
      .length;
    const withNotes = rows.filter((r) => (r.notes ?? "").trim()).length;
    return { total, checkedIn, checkedOut, pendingCheckout, withNotes };
  }, [rows]);

  const noEmployees = !loading && employees.length === 0;

  // “Acción sugerida” para el form superior
  const selectedHasCheckIn = !!selectedRow?.checkInAt;
  const selectedHasCheckOut = !!selectedRow?.checkOutAt;
  const canCheckIn = !!selectedEmployeeId && !selectedHasCheckIn; // si ya hay check-in, no
  const canCheckout = !!selectedEmployeeId && selectedHasCheckIn && !selectedHasCheckOut;

  const suggestedAction: "CHECKIN" | "CHECKOUT" | "NONE" = useMemo(() => {
    if (!selectedEmployeeId) return "NONE";
    if (canCheckout) return "CHECKOUT";
    if (canCheckIn) return "CHECKIN";
    return "NONE";
  }, [selectedEmployeeId, canCheckout, canCheckIn]);

  const photoLooksValid = photoUrl.trim() ? isValidUrl(photoUrl.trim()) : true;

  const filteredRows = useMemo(() => {
    const query = q.trim().toLowerCase();

    const base = rows.filter((r) => {
      // employee filter
      if (filterEmployeeId && r.employeeId !== filterEmployeeId) return false;

      // tab filter
      const pending = !!r.checkInAt && !r.checkOutAt;
      const done = !!r.checkInAt && !!r.checkOutAt;
      const hasNotes = !!(r.notes ?? "").trim();

      if (tab === "PENDING" && !pending) return false;
      if (tab === "DONE" && !done) return false;
      if (tab === "NOTES" && !hasNotes) return false;

      if (!query) return true;

      const emp = employeeMap.get(r.employeeId) ?? r.employeeId;
      const hay = `${emp} ${r.notes ?? ""}`.toLowerCase();
      return hay.includes(query);
    });

    // Orden: pendientes arriba, luego completos
    return base.slice().sort((a, b) => {
      const ap = a.checkInAt && !a.checkOutAt ? 1 : 0;
      const bp = b.checkInAt && !b.checkOutAt ? 1 : 0;
      if (ap !== bp) return bp - ap;
      const an = (employeeMap.get(a.employeeId) ?? "").toLowerCase();
      const bn = (employeeMap.get(b.employeeId) ?? "").toLowerCase();
      return an.localeCompare(bn);
    });
  }, [rows, q, filterEmployeeId, tab, employeeMap]);

  const openRow = useMemo(() => {
    if (!openRowId) return null;
    return rows.find((r) => r.id === openRowId) ?? null;
  }, [openRowId, rows]);

  async function loadAll(opts?: { keepSelection?: boolean }) {
    setError(null);
    setOkMsg(null);
    setLoading(true);

    try {
      const emps = await apiFetchAuthed<EmployeeRow[]>(
        getAccessToken,
        "/employees?activeOnly=true"
      );
      const safeEmps = Array.isArray(emps) ? emps : [];
      setEmployees(safeEmps);

      const dayRows = await apiFetchAuthed<AttendanceRow[]>(
        getAccessToken,
        `/attendance/day/${encodeURIComponent(dateKey)}`
      );
      const safeRows = Array.isArray(dayRows) ? dayRows : [];
      setRows(safeRows);

      // selección inicial / robusta
      if (!opts?.keepSelection) {
        if (!selectedEmployeeId && safeEmps?.[0]?.id)
          setSelectedEmployeeId(safeEmps[0].id);
      } else {
        if (
          selectedEmployeeId &&
          !safeEmps.some((e) => e.id === selectedEmployeeId)
        ) {
          setSelectedEmployeeId(safeEmps?.[0]?.id ?? "");
        }
      }
    } catch (e: any) {
      setError(e?.message || "Error cargando asistencia");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    setBusyRefresh(true);
    try {
      await loadAll({ keepSelection: true });
      setOkMsg("Actualizado ✔");
      window.setTimeout(() => setOkMsg(null), 2000);
    } finally {
      setBusyRefresh(false);
    }
  }

  useEffect(() => {
    if (!allowed) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, allowed]);

  async function doCheckIn(employeeId: string, extra?: { photoUrl?: string; notes?: string }) {
    setError(null);
    setOkMsg(null);
    setBusyAction(true);

    try {
      await apiFetchAuthed(getAccessToken, "/attendance/checkin", {
        method: "PUT",
        body: JSON.stringify({
          dateKey,
          employeeId,
          photoUrl: extra?.photoUrl?.trim() ? extra.photoUrl.trim() : null,
          notes: extra?.notes?.trim() ? extra.notes.trim() : null,
        }),
      });

      await loadAll({ keepSelection: true });
      setOkMsg("Check-in registrado ✔");
      window.setTimeout(() => setOkMsg(null), 2000);
    } catch (e: any) {
      setError(e?.message || "Error haciendo check-in");
    } finally {
      setBusyAction(false);
    }
  }

  async function doCheckOut(employeeId: string, extra?: { photoUrl?: string; notes?: string }) {
    setError(null);
    setOkMsg(null);
    setBusyAction(true);

    try {
      await apiFetchAuthed(getAccessToken, "/attendance/checkout", {
        method: "PUT",
        body: JSON.stringify({
          dateKey,
          employeeId,
          photoUrl: extra?.photoUrl?.trim() ? extra.photoUrl.trim() : null,
          notes: extra?.notes?.trim() ? extra.notes.trim() : null,
        }),
      });

      await loadAll({ keepSelection: true });
      setOkMsg("Check-out registrado ✔");
      window.setTimeout(() => setOkMsg(null), 2000);
    } catch (e: any) {
      setError(e?.message || "Error haciendo check-out");
    } finally {
      setBusyAction(false);
    }
  }

  async function onMainAction() {
    if (!selectedEmployeeId) return;
    if (!photoLooksValid) return;

    const payload = { photoUrl, notes };
    setPhotoUrl("");
    setNotes("");

    if (suggestedAction === "CHECKIN") return doCheckIn(selectedEmployeeId, payload);
    if (suggestedAction === "CHECKOUT") return doCheckOut(selectedEmployeeId, payload);
  }

  function resetFilters() {
    setTab("ALL");
    setQ("");
    setFilterEmployeeId("");
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700">
          No autorizado (requiere ADMIN o MANAGER).
        </div>
      </div>
    );
  }

  const hasFilters = tab !== "ALL" || q.trim() || filterEmployeeId;

  const selectedEmployeeLabel =
    employees.find((e) => e.id === selectedEmployeeId)?.fullName || "—";

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-65">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                  Asistencia
                </h1>

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
                Check-in / Check-out por día. Acciones rápidas + detalle por empleado.
              </p>

              {!loading && stats.pendingCheckout > 0 && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  Pendientes de check-out: <b>{stats.pendingCheckout}</b>
                </div>
              )}

              {!loading && employees.length === 0 && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  No hay empleados activos en esta sucursal.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dateKey}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isValidDateKey(v)) setDateKey(v);
                }}
              />
              <Button
                variant="secondary"
                onClick={refresh}
                disabled={busyAction || busyRefresh}
                loading={busyRefresh}
                title="Actualizar"
              >
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

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* KPI cards (clickable -> filtra tabs) */}
        <div className="grid gap-4 md:grid-cols-4">
          <Kpi
            label="Total"
            value={stats.total}
            icon={ClipboardCheck}
            active={tab === "ALL"}
            onClick={() => setTab("ALL")}
          />
          <Kpi
            label="Pendientes"
            value={stats.pendingCheckout}
            icon={AlertTriangle}
            tone="warn"
            active={tab === "PENDING"}
            onClick={() => setTab("PENDING")}
          />
          <Kpi
            label="Completos"
            value={stats.checkedOut}
            icon={CheckCircle2}
            tone="good"
            active={tab === "DONE"}
            onClick={() => setTab("DONE")}
          />
          <Kpi
            label="Con notas"
            value={stats.withNotes}
            icon={User}
            active={tab === "NOTES"}
            onClick={() => setTab("NOTES")}
          />
        </div>

        {/* Registrar (guided) */}
        <Card>
          <CardHeader
            title="Registrar"
            subtitle="Elegí empleado y ejecutá la acción sugerida (entrada o salida)."
          />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Empleado">
                <Select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  disabled={loading || noEmployees || busyAction}
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Foto URL (opcional)">
                <Input
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://..."
                  disabled={noEmployees || busyAction}
                />
                {!!photoUrl.trim() && !photoLooksValid && (
                  <div className="mt-1 text-xs text-red-600">
                    La URL no parece válida (http/https).
                  </div>
                )}
              </Field>

              <Field label="Notas (opcional)">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: llegó tarde"
                  disabled={noEmployees || busyAction}
                />
              </Field>

              <div className="flex items-end gap-2">
                <Button
                  className="w-full"
                  onClick={onMainAction}
                  disabled={
                    busyAction ||
                    noEmployees ||
                    !selectedEmployeeId ||
                    !photoLooksValid ||
                    suggestedAction === "NONE"
                  }
                  loading={busyAction}
                  title={
                    suggestedAction === "NONE"
                      ? "Ya tiene check-in y check-out registrados."
                      : suggestedAction === "CHECKIN"
                      ? "Registrar entrada"
                      : "Registrar salida"
                  }
                >
                  <span className="inline-flex items-center gap-2">
                    {suggestedAction === "CHECKIN" ? (
                      <LogIn className="h-4 w-4" />
                    ) : (
                      <LogOut className="h-4 w-4" />
                    )}
                    {suggestedAction === "CHECKIN"
                      ? "Registrar Check-in"
                      : suggestedAction === "CHECKOUT"
                      ? "Registrar Check-out"
                      : "Sin acción"}
                  </span>
                </Button>

                {/* Acción secundaria rápida (si aplica) */}
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => {
                    setPhotoUrl("");
                    setNotes("");
                  }}
                  disabled={busyAction}
                  title="Limpiar inputs"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Contexto del empleado */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-zinc-600">
                Seleccionado:{" "}
                <b className="text-zinc-900">{selectedEmployeeLabel}</b>
                {selectedRow?.checkInAt && (
                  <span className="ml-2 text-xs text-zinc-500">
                    Entrada:{" "}
                    <b className="text-zinc-800">{fmtTime(selectedRow.checkInAt)}</b>
                  </span>
                )}
                {selectedRow?.checkOutAt && (
                  <span className="ml-2 text-xs text-zinc-500">
                    • Salida:{" "}
                    <b className="text-zinc-800">{fmtTime(selectedRow.checkOutAt)}</b>
                  </span>
                )}
              </div>

              {!!photoUrl.trim() && photoLooksValid && (
                <a
                  href={photoUrl.trim()}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <Camera className="h-4 w-4" />
                  Ver foto
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Filters / Tabs */}
        <Card>
          <CardHeader title="Listado" subtitle="Buscá, filtrá por empleado y gestioná pendientes rápido." />
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <TabButton active={tab === "ALL"} onClick={() => setTab("ALL")}>
                  Todos
                </TabButton>
                <TabButton active={tab === "PENDING"} onClick={() => setTab("PENDING")}>
                  Pendientes
                  {stats.pendingCheckout > 0 && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                      {stats.pendingCheckout}
                    </span>
                  )}
                </TabButton>
                <TabButton active={tab === "DONE"} onClick={() => setTab("DONE")}>
                  Completos
                </TabButton>
                <TabButton active={tab === "NOTES"} onClick={() => setTab("NOTES")}>
                  Con notas
                </TabButton>
              </div>

              {/* Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar empleado o notas…"
                    className="pl-9 w-65"
                    disabled={loading}
                  />
                </div>

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

                {hasFilters && (
                  <Button variant="secondary" onClick={resetFilters} disabled={loading}>
                    <span className="inline-flex items-center gap-2">
                      <X className="h-4 w-4" />
                      Limpiar
                    </span>
                  </Button>
                )}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                Mostrando <b className="text-zinc-900">{filteredRows.length}</b> /{" "}
                {rows.length}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* List */}
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 px-5 py-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Registros del día</h2>
              <p className="mt-1 text-sm text-zinc-500">Fecha: {dateKey}</p>
            </div>

            <div className="text-xs text-zinc-500 pt-1">
              Tip: abrí el detalle para fotos/acciones.
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Empleado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Entrada
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Salida
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-sm text-zinc-500">
                      Cargando…
                    </td>
                  </tr>
                )}

                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-sm text-zinc-500">
                      {rows.length === 0 ? "Sin registros." : "No hay resultados con estos filtros."}
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredRows.map((r) => {
                    const emp = employeeMap.get(r.employeeId) ?? r.employeeId;
                    const pending = !!r.checkInAt && !r.checkOutAt;
                    const done = !!r.checkInAt && !!r.checkOutAt;

                    return (
                      <tr
                        key={r.id}
                        className={cn("hover:bg-zinc-50/60", pending && "bg-amber-50/50")}
                      >
                        <td className="px-4 py-3">
                          <div className="text-sm font-semibold text-zinc-900">{emp}</div>
                          <div className="text-xs text-zinc-500 line-clamp-1">
                            {r.notes?.trim() ? r.notes : "—"}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">{fmtTime(r.checkInAt)}</td>
                        <td className="px-4 py-3 text-sm text-zinc-700">{fmtTime(r.checkOutAt)}</td>

                        <td className="px-4 py-3">
                          <StatusPill pending={pending} done={done} />
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            {pending && (
                              <Button
                                onClick={() => doCheckOut(r.employeeId)}
                                disabled={busyAction}
                                loading={busyAction}
                                title="Check-out rápido (sin foto/nota)"
                              >
                                <span className="inline-flex items-center gap-2">
                                  <LogOut className="h-4 w-4" />
                                  Check-out
                                </span>
                              </Button>
                            )}

                            <Button
                              variant="secondary"
                              onClick={() => setOpenRowId(r.id)}
                              disabled={busyAction}
                            >
                              Ver
                            </Button>
                          </div>
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
                <div className="h-28 rounded-2xl bg-zinc-100 animate-pulse" />
                <div className="h-28 rounded-2xl bg-zinc-100 animate-pulse" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="text-sm text-zinc-500">
                {rows.length === 0 ? "Sin registros." : "No hay resultados con estos filtros."}
              </div>
            ) : (
              filteredRows.map((r) => {
                const emp = employeeMap.get(r.employeeId) ?? r.employeeId;
                const pending = !!r.checkInAt && !r.checkOutAt;
                const done = !!r.checkInAt && !!r.checkOutAt;

                return (
                  <div
                    key={r.id}
                    className={cn(
                      "rounded-2xl border p-4",
                      pending ? "border-amber-200 bg-amber-50" : "border-zinc-200 bg-white"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-900 truncate">{emp}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                            Entrada: <b className="text-zinc-900">{fmtTime(r.checkInAt)}</b>
                          </span>
                          <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                            Salida: <b className="text-zinc-900">{fmtTime(r.checkOutAt)}</b>
                          </span>
                        </div>
                      </div>
                      <StatusPill pending={pending} done={done} />
                    </div>

                    {r.notes?.trim() && (
                      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                        {r.notes}
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      {pending && (
                        <Button
                          className="w-full"
                          onClick={() => doCheckOut(r.employeeId)}
                          disabled={busyAction}
                          loading={busyAction}
                        >
                          <LogOut className="h-4 w-4" />
                          Check-out
                        </Button>
                      )}
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={() => setOpenRowId(r.id)}
                        disabled={busyAction}
                      >
                        Ver detalle
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-zinc-100 px-5 py-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-zinc-500">
              Pendientes arriba • Check-out rápido disponible cuando falta salida.
            </div>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      <DetailModal
        open={!!openRow}
        onClose={() => setOpenRowId(null)}
        row={openRow}
        employeeName={openRow ? employeeMap.get(openRow.employeeId) ?? openRow.employeeId : ""}
        onQuickCheckout={openRow ? () => doCheckOut(openRow.employeeId) : undefined}
      />
    </div>
  );
}

/* ===========================
 * Small UI pieces
 * =========================== */

function Kpi({
  label,
  value,
  icon: Icon,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: any;
  tone?: "good" | "warn";
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-sm text-left transition",
        active ? "border-zinc-900" : "border-zinc-200 hover:bg-zinc-50"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-zinc-500">{label}</span>
        <Icon className="h-4 w-4 text-zinc-400" />
      </div>
      <div
        className={cn(
          "mt-1 text-2xl font-bold",
          tone === "good" && "text-emerald-700",
          tone === "warn" && "text-amber-800"
        )}
      >
        {value}
      </div>
      {active && <div className="mt-2 text-xs text-zinc-500">Filtrando</div>}
    </button>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
      )}
    >
      {children}
    </button>
  );
}

function StatusPill({ pending, done }: { pending: boolean; done: boolean }) {
  if (pending) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
        <AlertTriangle className="h-4 w-4" />
        Pendiente
      </span>
    );
  }
  if (done) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        Completo
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
      —
    </span>
  );
}

function DetailModal({
  open,
  onClose,
  row,
  employeeName,
  onQuickCheckout,
}: {
  open: boolean;
  onClose: () => void;
  row: AttendanceRow | null;
  employeeName: string;
  onQuickCheckout?: () => void;
}) {
  if (!open || !row) return null;

  const pending = !!row.checkInAt && !row.checkOutAt;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl bg-white shadow-xl border border-zinc-200">
        <div className="flex items-start justify-between gap-3 p-4 border-b">
          <div className="min-w-0">
            <div className="text-sm text-zinc-500">Detalle</div>
            <div className="text-lg font-semibold text-zinc-900 truncate">
              {employeeName}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-600">
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">
                Entrada: <b>{fmtTime(row.checkInAt)}</b>
              </span>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">
                Salida: <b>{fmtTime(row.checkOutAt)}</b>
              </span>
              {pending && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                  Pendiente
                </span>
              )}
            </div>
          </div>

          <Button variant="secondary" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {row.notes?.trim() ? (
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              {row.notes}
            </div>
          ) : (
            <div className="text-sm text-zinc-500">Sin notas.</div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <PhotoLink label="Foto entrada" url={row.checkInPhotoUrl} />
            <PhotoLink label="Foto salida" url={row.checkOutPhotoUrl} />
          </div>

          <div className="flex justify-end gap-2">
            {pending && onQuickCheckout && (
              <Button onClick={onQuickCheckout}>
                <LogOut className="h-4 w-4" />
                Check-out rápido
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoLink({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
        <div className="font-semibold text-zinc-800">{label}</div>
        <div className="mt-1 text-zinc-500">No cargada</div>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="rounded-2xl border border-zinc-200 bg-white p-3 hover:bg-zinc-50 transition"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-zinc-900">{label}</div>
          <div className="mt-1 text-xs text-zinc-500 truncate">{url}</div>
        </div>
        <span className="inline-flex items-center gap-2 text-blue-600">
          <Camera className="h-4 w-4" />
          <ExternalLink className="h-4 w-4" />
        </span>
      </div>
    </a>
  );
}
