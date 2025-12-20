"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

// Opcional pero recomendado (si ya usás lucide-react)
import {
  RefreshCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Camera,
  ExternalLink,
  X,
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

function fmtTime(dt?: string | null) {
  if (!dt) return "—";
  try {
    const d = new Date(dt);
    return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
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

export default function AttendancePage() {
  const { getAccessToken, user } = useAuth() as any;
  const roles: string[] = user?.roles || [];
  const allowed = roles.includes("ADMIN") || roles.includes("MANAGER");

  const [dateKey, setDateKey] = useState(todayKeyArgentina());
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  // form
  const [photoUrl, setPhotoUrl] = useState("");
  const [notes, setNotes] = useState("");

  // UX filters
  const [q, setQ] = useState("");
  const [filterEmployeeId, setFilterEmployeeId] = useState("");
  const [onlyPendingCheckout, setOnlyPendingCheckout] = useState(false);
  const [onlyWithNotes, setOnlyWithNotes] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyRefresh, setBusyRefresh] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const employeeMap = useMemo(() => {
    const m = new Map<string, string>();
    employees.forEach((e) => m.set(e.id, e.fullName));
    return m;
  }, [employees]);

  const stats = useMemo(() => {
    const total = rows.length;
    const checkedIn = rows.filter((r) => !!r.checkInAt).length;
    const checkedOut = rows.filter((r) => !!r.checkOutAt).length;
    const pendingCheckout = rows.filter((r) => !!r.checkInAt && !r.checkOutAt).length;
    return { total, checkedIn, checkedOut, pendingCheckout };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterEmployeeId && r.employeeId !== filterEmployeeId) return false;
      if (onlyPendingCheckout && !(r.checkInAt && !r.checkOutAt)) return false;
      if (onlyWithNotes && !(r.notes ?? "").trim()) return false;

      if (!query) return true;

      const emp = employeeMap.get(r.employeeId) ?? r.employeeId;
      const hay = `${emp} ${r.notes ?? ""}`.toLowerCase();
      return hay.includes(query);
    });
  }, [rows, q, filterEmployeeId, onlyPendingCheckout, onlyWithNotes, employeeMap]);

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

      const dayRows = await apiFetchAuthed<AttendanceRow[]>(
        getAccessToken,
        `/attendance/day/${encodeURIComponent(dateKey)}`
      );
      setRows(dayRows);

      if (!opts?.keepSelection) {
        if (!selectedEmployeeId && emps[0]?.id) setSelectedEmployeeId(emps[0].id);
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

  async function checkIn() {
    if (!selectedEmployeeId) return;

    setError(null);
    setOkMsg(null);
    setBusy(true);

    try {
      await apiFetchAuthed(getAccessToken, "/attendance/checkin", {
        method: "PUT",
        body: JSON.stringify({
          dateKey,
          employeeId: selectedEmployeeId,
          photoUrl: photoUrl.trim() ? photoUrl.trim() : null,
          notes: notes.trim() ? notes.trim() : null,
        }),
      });

      setPhotoUrl("");
      setNotes("");
      await loadAll({ keepSelection: true });

      setOkMsg("Check-in registrado ✔");
      window.setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error haciendo check-in");
    } finally {
      setBusy(false);
    }
  }

  async function checkOut() {
    if (!selectedEmployeeId) return;

    setError(null);
    setOkMsg(null);
    setBusy(true);

    try {
      await apiFetchAuthed(getAccessToken, "/attendance/checkout", {
        method: "PUT",
        body: JSON.stringify({
          dateKey,
          employeeId: selectedEmployeeId,
          photoUrl: photoUrl.trim() ? photoUrl.trim() : null,
          notes: notes.trim() ? notes.trim() : null,
        }),
      });

      setPhotoUrl("");
      setNotes("");
      await loadAll({ keepSelection: true });

      setOkMsg("Check-out registrado ✔");
      window.setTimeout(() => setOkMsg(null), 2500);
    } catch (e: any) {
      setError(e?.message || "Error haciendo check-out");
    } finally {
      setBusy(false);
    }
  }

  function resetFilters() {
    setQ("");
    setFilterEmployeeId("");
    setOnlyPendingCheckout(false);
    setOnlyWithNotes(false);
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

  const hasFilters =
    q.trim() || filterEmployeeId || onlyPendingCheckout || onlyWithNotes;

  const selectedEmployeeLabel =
    employees.find((e) => e.id === selectedEmployeeId)?.fullName || "—";

  const photoLooksValid = photoUrl.trim() ? isValidUrl(photoUrl.trim()) : true;

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-zinc-900">Asistencia</h1>

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
                Check-in / Check-out por día (foto URL opcional).
              </p>

              {!loading && stats.pendingCheckout > 0 && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  Pendientes de check-out: <b>{stats.pendingCheckout}</b>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
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
                  Refrescar
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

      <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        {/* Registrar */}
        <Card>
          <CardHeader
            title="Registrar"
            subtitle="Seleccioná empleado y marcá entrada o salida."
          />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Empleado">
                <Select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
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
                />
                {!!photoUrl.trim() && !photoLooksValid && (
                  <div className="mt-1 text-xs text-red-600">
                    La URL no parece válida (debe empezar con http/https).
                  </div>
                )}
              </Field>

              <Field label="Notas (opcional)">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: llegó tarde"
                />
              </Field>

              <div className="flex items-end gap-2">
                <Button
                  className="w-full"
                  onClick={checkIn}
                  disabled={busy || !selectedEmployeeId || !photoLooksValid}
                  loading={busy}
                >
                  Check-in
                </Button>
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={checkOut}
                  disabled={busy || !selectedEmployeeId || !photoLooksValid}
                  loading={busy}
                >
                  Check-out
                </Button>
              </div>
            </div>

            {/* Contexto del empleado */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-zinc-600">
                Seleccionado: <b className="text-zinc-900">{selectedEmployeeLabel}</b>
              </div>

              {!!photoUrl.trim() && photoLooksValid && (
                <a
                  href={photoUrl.trim()}
                  target="_blank"
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

        {/* Filtros */}
        <Card>
          <CardHeader
            title="Filtros"
            subtitle="Buscá rápido y detectá pendientes."
          />
          <CardBody>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Buscar (texto)">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Empleado o notas…"
                    className="pl-9"
                  />
                </div>
              </Field>

              <Field label="Empleado">
                <Select
                  value={filterEmployeeId}
                  onChange={(e) => setFilterEmployeeId(e.target.value)}
                >
                  <option value="">Todos</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName}
                    </option>
                  ))}
                </Select>
              </Field>

              <div className="flex items-end gap-2">
                <Button
                  variant={onlyPendingCheckout ? "secondary" : "ghost"}
                  onClick={() => setOnlyPendingCheckout((v) => !v)}
                  disabled={loading}
                >
                  {onlyPendingCheckout ? "Solo pendientes" : "Pendientes"}
                </Button>
                <Button
                  variant={onlyWithNotes ? "secondary" : "ghost"}
                  onClick={() => setOnlyWithNotes((v) => !v)}
                  disabled={loading}
                >
                  {onlyWithNotes ? "Solo con notas" : "Con notas"}
                </Button>
              </div>

              <div className="flex items-end justify-end">
                {hasFilters && (
                  <Button variant="secondary" onClick={resetFilters}>
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
                Mostrando <b className="text-zinc-900">{filteredRows.length}</b> / {rows.length}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-700">
                Check-in: <b className="text-zinc-900">{stats.checkedIn}</b>
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-zinc-700">
                Check-out: <b className="text-zinc-900">{stats.checkedOut}</b>
              </span>
            </div>
          </CardBody>
        </Card>

        {/* Tabla */}
        <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">Registros del día</h2>
            <p className="mt-1 text-sm text-zinc-500">Fecha: {dateKey}</p>
          </div>

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
                    Fotos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Notas
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
                    const pending = !!r.checkInAt && !r.checkOutAt;
                    return (
                      <tr
                        key={r.id}
                        className={cn("hover:bg-zinc-50/60", pending && "bg-amber-50")}
                      >
                        <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                          {employeeMap.get(r.employeeId) ?? r.employeeId}
                          {pending && (
                            <div className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                              <AlertTriangle className="h-4 w-4" />
                              Pendiente check-out
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {fmtTime(r.checkInAt)}
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {fmtTime(r.checkOutAt)}
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          <div className="flex flex-col gap-1">
                            {r.checkInPhotoUrl ? (
                              <a
                                className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                                href={r.checkInPhotoUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Camera className="h-4 w-4" />
                                Entrada <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : (
                              <span className="text-zinc-400">Entrada —</span>
                            )}

                            {r.checkOutPhotoUrl ? (
                              <a
                                className="inline-flex items-center gap-2 text-blue-600 hover:underline"
                                href={r.checkOutPhotoUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Camera className="h-4 w-4" />
                                Salida <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : (
                              <span className="text-zinc-400">Salida —</span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {r.notes?.trim() ? r.notes : "—"}
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
                <div className="h-24 rounded-2xl bg-zinc-100 animate-pulse" />
                <div className="h-24 rounded-2xl bg-zinc-100 animate-pulse" />
              </div>
            ) : filteredRows.length === 0 ? (
              <div className="text-sm text-zinc-500">
                {rows.length === 0 ? "Sin registros." : "No hay resultados con estos filtros."}
              </div>
            ) : (
              filteredRows.map((r) => {
                const pending = !!r.checkInAt && !r.checkOutAt;
                const emp = employeeMap.get(r.employeeId) ?? r.employeeId;

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
                        <div className="text-sm font-semibold text-zinc-900 truncate">
                          {emp}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                            Entrada: <b className="text-zinc-900">{fmtTime(r.checkInAt)}</b>
                          </span>
                          <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-zinc-700">
                            Salida: <b className="text-zinc-900">{fmtTime(r.checkOutAt)}</b>
                          </span>
                          {pending && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
                              Pendiente
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {(r.checkInPhotoUrl || r.checkOutPhotoUrl) && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {r.checkInPhotoUrl ? (
                          <a
                            href={r.checkInPhotoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-blue-600"
                          >
                            <Camera className="h-4 w-4" /> Entrada <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 text-center">
                            Sin foto entrada
                          </div>
                        )}

                        {r.checkOutPhotoUrl ? (
                          <a
                            href={r.checkOutPhotoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-blue-600"
                          >
                            <Camera className="h-4 w-4" /> Salida <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : (
                          <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 text-center">
                            Sin foto salida
                          </div>
                        )}
                      </div>
                    )}

                    {r.notes?.trim() && (
                      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                        {r.notes}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-zinc-100 px-5 py-4 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm text-zinc-500">
              Tip: activá “Pendientes” para ver quién falta check-out.
            </div>
            <Button variant="secondary" onClick={refresh} disabled={busy || busyRefresh} loading={busyRefresh}>
              Refrescar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
