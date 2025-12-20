"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  RefreshCcw,
  Search,
  Plus,
  User as UserIcon,
  CalendarDays,
  DollarSign,
  Link2,
  Unlink2,
  Pencil,
  Save,
  X,
  Power,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Filter,
} from "lucide-react";

type EmployeeRow = {
  id: string;
  fullName: string;
  hireDate: string; // ISO
  hourlyRate: number;
  userId?: string | null; // ObjectId
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type UserRow = {
  id: string; // ObjectId
  email: string;
  roles: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // YYYY-MM-DD
}

function isObjectId(v?: string | null) {
  if (!v) return false;
  return /^[a-fA-F0-9]{24}$/.test(v);
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border",
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-zinc-100 text-zinc-600 border-zinc-200"
      )}
    >
      {active ? "ACTIVO" : "INACTIVO"}
    </span>
  );
}

function money(n: number) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-AR");
}

export default function AdminEmployeesPage() {
  const { getAccessToken } = useAuth();

  const [items, setItems] = useState<EmployeeRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [loadingList, setLoadingList] = useState(true);
  const [busy, setBusy] = useState(false);

  // create form
  const [createOpen, setCreateOpen] = useState(true);
  const [fullName, setFullName] = useState("");
  const [hireDate, setHireDate] = useState(todayKeyArgentina());
  const [hourlyRate, setHourlyRate] = useState<number>(0);
  const [newUserId, setNewUserId] = useState<string>(""); // optional link on create

  // edit inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editHireDate, setEditHireDate] = useState("");
  const [editHourlyRate, setEditHourlyRate] = useState<number>(0);

  // link user drafts (employeeId -> selectedUserId)
  const [linkDraft, setLinkDraft] = useState<Record<string, string>>({});

  const searchRef = useRef<HTMLInputElement | null>(null);

  const usersById = useMemo(() => {
    const m = new Map<string, UserRow>();
    users.forEach((u) => m.set(u.id, u));
    return m;
  }, [users]);

  function userLabel(u: UserRow) {
    const roleTxt = u.roles?.length ? ` • ${u.roles.join(", ")}` : "";
    const activeTxt = u.isActive ? "" : " • INACTIVO";
    return `${u.email}${roleTxt}${activeTxt}`;
  }

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let base = items;
    if (onlyActive) base = base.filter((e) => e.isActive);
    if (!qq) return base;
    return base.filter((e) => e.fullName.toLowerCase().includes(qq));
  }, [items, q, onlyActive]);

  const totals = useMemo(() => {
    const total = items.length;
    const active = items.filter((e) => e.isActive).length;
    const linked = items.filter((e) => !!e.userId).length;
    return { total, active, linked };
  }, [items]);

  const totalLabel = useMemo(() => {
    const shown = filtered.length;
    const total = items.length;
    const base = !q.trim() ? `${total} empleado${total === 1 ? "" : "s"}` : `${shown} de ${total}`;
    return onlyActive ? `${base} (solo activos)` : base;
  }, [filtered.length, items.length, q, onlyActive]);

  async function load() {
    setError(null);
    setOkMsg(null);
    setLoadingList(true);
    try {
      const [emps, us] = await Promise.all([
        apiFetchAuthed<EmployeeRow[]>(getAccessToken, "/employees"),
        apiFetchAuthed<UserRow[]>(getAccessToken, "/admin/users"),
      ]);
      setItems(emps);
      setUsers(us);

      // inicializar drafts con lo que viene del server (si no existía)
      setLinkDraft((prev) => {
        const next = { ...prev };
        for (const e of emps) {
          if (next[e.id] === undefined) next[e.id] = e.userId ?? "";
        }
        return next;
      });

      setOkMsg("Datos actualizados ✔");
      window.setTimeout(() => setOkMsg(null), 1800);
    } catch (e: any) {
      setError(e?.message || "Error cargando empleados/usuarios");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createEmployee() {
    if (!fullName.trim() || !hireDate.trim()) return;

    if (newUserId && !isObjectId(newUserId)) {
      setError("El usuario seleccionado no es un ObjectId válido.");
      return;
    }

    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, "/employees", {
        method: "POST",
        body: JSON.stringify({
          fullName: fullName.trim(),
          hireDate, // YYYY-MM-DD
          hourlyRate: Number(hourlyRate),
          userId: newUserId ? newUserId : null,
        }),
      });

      setFullName("");
      setHireDate(todayKeyArgentina());
      setHourlyRate(0);
      setNewUserId("");

      setOkMsg("Empleado creado ✔");
      window.setTimeout(() => setOkMsg(null), 1800);

      await load();
    } catch (e: any) {
      setError(e?.message || "Error creando empleado");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(e: EmployeeRow) {
    setEditingId(e.id);
    setEditFullName(e.fullName);
    setEditHireDate(e.hireDate?.slice(0, 10) || todayKeyArgentina());
    setEditHourlyRate(e.hourlyRate || 0);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditFullName("");
    setEditHireDate("");
    setEditHourlyRate(0);
  }

  async function saveEdit(id: string) {
    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/employees/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: editFullName.trim(),
          hireDate: editHireDate,
          hourlyRate: Number(editHourlyRate),
        }),
      });

      cancelEdit();
      setOkMsg("Empleado actualizado ✔");
      window.setTimeout(() => setOkMsg(null), 1800);
      await load();
    } catch (e: any) {
      setError(e?.message || "Error actualizando empleado");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(e: EmployeeRow) {
    const next = !e.isActive;
    const ok = window.confirm(
      next ? `¿Reactivar a ${e.fullName}?` : `¿Desactivar a ${e.fullName}?`
    );
    if (!ok) return;

    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/employees/${e.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });

      setOkMsg(next ? "Empleado reactivado ✔" : "Empleado desactivado ✔");
      window.setTimeout(() => setOkMsg(null), 1800);

      await load();
    } catch (err: any) {
      setError(err?.message || "Error cambiando estado");
    } finally {
      setBusy(false);
    }
  }

  async function saveLink(employeeId: string) {
    const selected = linkDraft[employeeId] ?? "";
    if (selected && !isObjectId(selected)) {
      setError("El usuario seleccionado no es un ObjectId válido.");
      return;
    }

    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/employees/${employeeId}/user`, {
        method: "PATCH",
        body: JSON.stringify({ userId: selected ? selected : null }),
      });

      setOkMsg("Vínculo actualizado ✔");
      window.setTimeout(() => setOkMsg(null), 1800);

      await load();
    } catch (e: any) {
      setError(e?.message || "Error vinculando usuario");
    } finally {
      setBusy(false);
    }
  }

  async function unlink(employeeId: string) {
    const ok = window.confirm("¿Desvincular usuario de este empleado?");
    if (!ok) return;

    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/employees/${employeeId}/user`, {
        method: "PATCH",
        body: JSON.stringify({ userId: null }),
      });

      // optimista
      setLinkDraft((p) => ({ ...p, [employeeId]: "" }));

      setOkMsg("Usuario desvinculado ✔");
      window.setTimeout(() => setOkMsg(null), 1800);

      await load();
    } catch (e: any) {
      setError(e?.message || "Error desvinculando usuario");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(txt: string) {
    try {
      await navigator.clipboard.writeText(txt);
      setOkMsg("Copiado ✔");
      window.setTimeout(() => setOkMsg(null), 1000);
    } catch {
      // noop
    }
  }

  return (
    <AdminProtected>
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
          {/* Sticky header */}
          <div className="sticky top-0 z-10 -mx-4 border-b border-zinc-200 bg-white/80 px-4 py-4 backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">Admin • Empleados</h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Nombre, fecha de ingreso, $/hora y vínculo a usuario.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                    Total: {totals.total}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Activos: {totals.active}
                  </span>
                  <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                    Vinculados: {totals.linked}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={load}
                  disabled={busy}
                  loading={loadingList}
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4" />
                    Refrescar
                  </span>
                </Button>

                <button
                  type="button"
                  title="Ir a búsqueda"
                  onClick={() => searchRef.current?.focus()}
                  disabled={loadingList}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Search + filter */}
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nombre…"
                  className="pl-9"
                />
              </div>

              <button
                type="button"
                onClick={() => setOnlyActive((v) => !v)}
                className={cn(
                  "h-10 rounded-xl border px-3 text-sm font-semibold transition inline-flex items-center gap-2",
                  onlyActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                )}
              >
                <Filter className="h-4 w-4" />
                {onlyActive ? "Solo activos" : "Todos"}
              </button>

              <div className="text-sm text-zinc-500">{totalLabel}</div>
            </div>

            {(error || okMsg) && (
              <div className="mt-3 grid gap-2">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {error}
                    </span>
                  </div>
                )}
                {okMsg && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {okMsg}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Create employee (collapsible) */}
          <Card>
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div>
                <div className="text-base font-semibold text-zinc-900">Crear empleado</div>
                <div className="mt-1 text-sm text-zinc-500">Solo ADMIN</div>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen((v) => !v)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
              >
                {createOpen ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {createOpen && (
              <CardBody>
                <div className="grid gap-3 md:grid-cols-5">
                  <Field label="Nombre">
                    <div className="relative">
                      <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="pl-9"
                      />
                    </div>
                  </Field>

                  <Field label="Fecha ingreso">
                    <div className="relative">
                      <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        type="date"
                        value={hireDate}
                        onChange={(e) => setHireDate(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </Field>

                  <Field label="Pago por hora">
                    <div className="relative">
                      <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        type="number"
                        value={String(hourlyRate)}
                        onChange={(e) => setHourlyRate(Number(e.target.value))}
                        placeholder="Ej: 3500"
                        className="pl-9"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Vista: {money(hourlyRate)}
                    </div>
                  </Field>

                  <Field label="Usuario (opcional)">
                    <Select value={newUserId} onChange={(e) => setNewUserId(e.target.value)}>
                      <option value="">— Sin usuario —</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {userLabel(u)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      onClick={createEmployee}
                      disabled={busy || !fullName.trim() || !hireDate.trim()}
                      loading={busy}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Crear
                      </span>
                    </Button>
                  </div>
                </div>
              </CardBody>
            )}
          </Card>

          {/* List */}
          <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Listado</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Editá inline, activá/desactivá y vinculá usuarios.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Empleado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Ingreso
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      $/hora
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Usuario
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {loadingList && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-sm text-zinc-500">
                        Cargando…
                      </td>
                    </tr>
                  )}

                  {!loadingList && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-sm text-zinc-500">
                        No hay empleados.
                      </td>
                    </tr>
                  )}

                  {!loadingList &&
                    filtered.map((e) => {
                      const isEditing = editingId === e.id;

                      const currentUserId = e.userId ?? "";
                      const draft = linkDraft[e.id] ?? currentUserId;
                      const currentUser = currentUserId ? usersById.get(currentUserId) : null;

                      const draftDiffers = draft !== (currentUserId || "");

                      return (
                        <tr key={e.id} className="hover:bg-zinc-50/60">
                          {/* Empleado */}
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editFullName}
                                onChange={(ev) => setEditFullName(ev.target.value)}
                              />
                            ) : (
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm font-semibold text-zinc-900">
                                    {e.fullName}
                                  </div>
                                  <div className="mt-1 text-xs text-zinc-500">
                                    ID:{" "}
                                    <button
                                      type="button"
                                      className="underline decoration-zinc-300 hover:decoration-zinc-500"
                                      onClick={() => copyText(e.id)}
                                    >
                                      copiar
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Ingreso */}
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                type="date"
                                value={editHireDate}
                                onChange={(ev) => setEditHireDate(ev.target.value)}
                              />
                            ) : (
                              <div className="text-sm text-zinc-700">{e.hireDate?.slice(0, 10)}</div>
                            )}
                          </td>

                          {/* hourly */}
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={String(editHourlyRate)}
                                onChange={(ev) => setEditHourlyRate(Number(ev.target.value))}
                                inputMode="numeric"
                              />
                            ) : (
                              <div className="text-sm text-zinc-700">{money(e.hourlyRate)}</div>
                            )}
                          </td>

                          {/* Usuario link */}
                          <td className="px-4 py-3">
                            <div className="grid gap-2">
                              <Select
                                value={draft}
                                disabled={busy || isEditing}
                                onChange={(ev) =>
                                  setLinkDraft((p) => ({
                                    ...p,
                                    [e.id]: ev.target.value,
                                  }))
                                }
                              >
                                <option value="">— Sin usuario —</option>
                                {users.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {userLabel(u)}
                                  </option>
                                ))}
                              </Select>

                              {!isEditing && (
                                <div className="text-xs text-zinc-500">
                                  {currentUser ? (
                                    <span>
                                      Actual: <span className="font-medium text-zinc-700">{currentUser.email}</span>
                                    </span>
                                  ) : currentUserId ? (
                                    <span>Actual: {currentUserId}</span>
                                  ) : (
                                    <span>Sin vínculo</span>
                                  )}
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="secondary"
                                  disabled={busy || isEditing || !draftDiffers}
                                  onClick={() => saveLink(e.id)}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <Link2 className="h-4 w-4" />
                                    Guardar
                                  </span>
                                </Button>

                                <Button
                                  variant="secondary"
                                  disabled={busy || isEditing || !currentUserId}
                                  onClick={() => unlink(e.id)}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <Unlink2 className="h-4 w-4" />
                                    Desvincular
                                  </span>
                                </Button>
                              </div>
                            </div>
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3">
                            <StatusPill active={e.isActive} />
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {!isEditing ? (
                                <>
                                  <Button
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => startEdit(e)}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <Pencil className="h-4 w-4" />
                                      Editar
                                    </span>
                                  </Button>

                                  <Button
                                    variant={e.isActive ? "danger" : "secondary"}
                                    disabled={busy}
                                    onClick={() => toggleActive(e)}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <Power className="h-4 w-4" />
                                      {e.isActive ? "Desactivar" : "Reactivar"}
                                    </span>
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button variant="secondary" disabled={busy} onClick={cancelEdit}>
                                    <span className="inline-flex items-center gap-2">
                                      <X className="h-4 w-4" />
                                      Cancelar
                                    </span>
                                  </Button>
                                  <Button
                                    disabled={busy || !editFullName.trim() || !editHireDate.trim()}
                                    loading={busy}
                                    onClick={() => saveEdit(e.id)}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <Save className="h-4 w-4" />
                                      Guardar
                                    </span>
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            Tip: si querés evitar el mismo usuario asignado a 2 empleados, lo validamos en backend
            (unique parcial sobre userId).
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
