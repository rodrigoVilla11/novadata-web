"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
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
  CheckCircle2,
  AlertTriangle,
  Filter,
  ChevronUp,
  ChevronDown,
  Info,
} from "lucide-react";

type EmployeeRow = {
  id: string;
  branchId?: string | null; // ✅ NUEVO (backend multi-branch)
  fullName: string;
  hireDate: string; // ISO
  hourlyRate: number;
  userId?: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type UserRow = {
  id: string;
  branchId?: string | null; // ✅ opcional si lo devolvés en /admin/users
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
  }).format(new Date());
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

function Notice({
  tone,
  children,
}: {
  tone: "error" | "ok";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2 text-sm",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      <span className="inline-flex items-center gap-2">
        {tone === "error" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {children}
      </span>
    </div>
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
  const [newUserId, setNewUserId] = useState<string>("");

  // edit inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editHireDate, setEditHireDate] = useState("");
  const [editHourlyRate, setEditHourlyRate] = useState<number>(0);

  // link drafts (employeeId -> selectedUserId)
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
    const base = !q.trim()
      ? `${total} empleado${total === 1 ? "" : "s"}`
      : `${shown} de ${total}`;
    return onlyActive ? `${base} (solo activos)` : base;
  }, [filtered.length, items.length, q, onlyActive]);

  function flashOk(msg: string) {
    setOkMsg(msg);
    window.setTimeout(() => setOkMsg(null), 1800);
  }

  async function load() {
    setError(null);
    setOkMsg(null);
    setLoadingList(true);
    try {
      // ✅ opcional: pedir solo activos al backend si querés
      const qs = onlyActive ? "?activeOnly=true" : "";

      const [emps, us] = await Promise.all([
        apiFetchAuthed<EmployeeRow[]>(getAccessToken, `/employees${qs}`),
        apiFetchAuthed<UserRow[]>(getAccessToken, "/users"),
      ]);

      setItems(Array.isArray(emps) ? emps : []);
      setUsers(Array.isArray(us) ? us : []);

      setLinkDraft((prev) => {
        const next = { ...prev };
        for (const e of emps) {
          if (next[e.id] === undefined) next[e.id] = e.userId ?? "";
        }
        return next;
      });

      // ✅ si querés, no flashes en el primer load (a gusto)
      // flashOk("Datos actualizados ✔");
    } catch (e: any) {
      setError(e?.message || "Error cargando empleados/usuarios");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyActive]); // ✅ recarga si cambiás filtro server-side

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
          hireDate,
          hourlyRate: Number(hourlyRate),
          userId: newUserId ? newUserId : null,
        }),
      });

      setFullName("");
      setHireDate(todayKeyArgentina());
      setHourlyRate(0);
      setNewUserId("");

      flashOk("Empleado creado ✔");
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
    if (!editFullName.trim() || !editHireDate.trim()) return;

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
      flashOk("Empleado actualizado ✔");
      await load();
    } catch (e: any) {
      setError(e?.message || "Error actualizando empleado");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(e: EmployeeRow) {
    const next = !e.isActive;
    const okConfirm = window.confirm(
      next ? `¿Reactivar a ${e.fullName}?` : `¿Desactivar a ${e.fullName}?`
    );
    if (!okConfirm) return;

    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/employees/${e.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });

      flashOk(next ? "Empleado reactivado ✔" : "Empleado desactivado ✔");
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

      flashOk("Vínculo actualizado ✔");
      await load();
    } catch (e: any) {
      setError(e?.message || "Error vinculando usuario");
    } finally {
      setBusy(false);
    }
  }

  async function unlink(employeeId: string) {
    const okConfirm = window.confirm("¿Desvincular usuario de este empleado?");
    if (!okConfirm) return;

    setError(null);
    setOkMsg(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/employees/${employeeId}/user`, {
        method: "PATCH",
        body: JSON.stringify({ userId: null }),
      });

      setLinkDraft((p) => ({ ...p, [employeeId]: "" }));

      flashOk("Usuario desvinculado ✔");
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
      flashOk("Copiado ✔");
    } catch {
      // noop
    }
  }

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Empleados
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Nombre, fecha de ingreso, $/hora y vínculo a usuario.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
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
        </div>

        {(error || okMsg) && (
          <div className="grid gap-2">
            {error && <Notice tone="error">{error}</Notice>}
            {!error && okMsg && <Notice tone="ok">{okMsg}</Notice>}
          </div>
        )}

        {/* Search + filter */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
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
        </div>

        {/* Create employee */}
        <Card>
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className={cn(
              "w-full text-left",
              "flex items-start justify-between gap-4 px-5 pt-5",
              "rounded-2xl",
              "hover:bg-zinc-50/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
            )}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-base font-semibold text-zinc-900">
                  Crear empleado
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                    createOpen
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-zinc-200 bg-white text-zinc-600"
                  )}
                >
                  {createOpen ? "Abierto" : "Cerrado"}
                </span>
              </div>

              <div className="mt-1 text-sm text-zinc-500">
                Alta de empleado y vínculo opcional con usuario.
              </div>
            </div>

            <div
              className={cn(
                "shrink-0",
                "inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-semibold",
                "border-zinc-200 text-zinc-800 hover:bg-zinc-50"
              )}
              aria-hidden="true"
            >
              {createOpen ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  Ocultar
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  Mostrar
                </>
              )}
            </div>
          </button>

          <div
            className={cn(
              "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
              createOpen ? "max-h-[520px] opacity-100" : "max-h-0 opacity-0"
            )}
          >
            <CardBody>
              <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 text-zinc-400" />
                  <div>
                    Completá <b>Nombre</b> y <b>Fecha ingreso</b>. El usuario es
                    opcional.
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-12">
                <div className="md:col-span-5">
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
                </div>

                <div className="md:col-span-3">
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
                </div>

                <div className="md:col-span-2">
                  <Field label="Pago por hora">
                    <div className="relative">
                      <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        type="number"
                        value={String(hourlyRate)}
                        onChange={(e) => setHourlyRate(Number(e.target.value))}
                        className="pl-9"
                        inputMode="numeric"
                        min={0}
                      />
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Vista:{" "}
                      <span className="font-semibold text-zinc-700">
                        {money(hourlyRate)}
                      </span>
                    </div>
                  </Field>
                </div>

                <div className="md:col-span-2 flex items-end">
                  <Button
                    className="w-full"
                    onClick={createEmployee}
                    disabled={busy || !fullName.trim() || !hireDate.trim()}
                    loading={busy}
                  >
                    <span className="inline-flex items-center gap-2 text-black">
                      <Plus className="h-4 w-4" />
                      Crear
                    </span>
                  </Button>
                </div>

                <div className="md:col-span-6">
                  <Field label="Usuario (opcional)">
                    <Select
                      value={newUserId}
                      onChange={(e) => setNewUserId(e.target.value)}
                      disabled={busy}
                    >
                      <option value="">— Sin usuario —</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {userLabel(u)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>
            </CardBody>
          </div>
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
                    const currentUser = currentUserId
                      ? usersById.get(currentUserId)
                      : null;

                    const draftDiffers = draft !== (currentUserId || "");

                    return (
                      <tr key={e.id} className="hover:bg-zinc-50/60">
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <Input
                              value={editFullName}
                              onChange={(ev) => setEditFullName(ev.target.value)}
                            />
                          ) : (
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
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {isEditing ? (
                            <Input
                              type="date"
                              value={editHireDate}
                              onChange={(ev) => setEditHireDate(ev.target.value)}
                            />
                          ) : (
                            <div className="text-sm text-zinc-700">
                              {e.hireDate?.slice(0, 10)}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={String(editHourlyRate)}
                              onChange={(ev) =>
                                setEditHourlyRate(Number(ev.target.value))
                              }
                              inputMode="numeric"
                            />
                          ) : (
                            <div className="text-sm text-zinc-700">
                              {money(e.hourlyRate)}
                            </div>
                          )}
                        </td>

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
                                    Actual:{" "}
                                    <span className="font-medium text-zinc-700">
                                      {currentUser.email}
                                    </span>
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

                        <td className="px-4 py-3">
                          <StatusPill active={e.isActive} />
                        </td>

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
                                <Button
                                  variant="secondary"
                                  disabled={busy}
                                  onClick={cancelEdit}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <X className="h-4 w-4" />
                                    Cancelar
                                  </span>
                                </Button>

                                <Button
                                  disabled={
                                    busy ||
                                    !editFullName.trim() ||
                                    !editHireDate.trim()
                                  }
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
          Tip: ya estás protegido en backend para que no se pueda asignar un user
          de otra sucursal.
        </div>
      </div>
    </AdminProtected>
  );
}
