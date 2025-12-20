"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

// Icons (si ya los usás en el proyecto, suma UX)
import {
  RefreshCcw,
  Search,
  Plus,
  Shield,
  User as UserIcon,
  Briefcase,
  KeyRound,
  Power,
  Copy,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";

type Role = "USER" | "ADMIN" | "MANAGER" | "CASHIER";

type UserRow = {
  id: string;
  email: string;
  roles: Role[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function RolePill({ role }: { role: Role }) {
  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";
  const isCashier = role === "CASHIER";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border",
        isAdmin
          ? "bg-zinc-900 text-white border-zinc-900"
          : isManager
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : isCashier
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-zinc-100 text-zinc-800 border-zinc-200"
      )}
    >
      {role}
    </span>
  );
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

function SkeletonRow() {
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="h-4 w-56 animate-pulse rounded bg-zinc-200" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <div className="h-9 w-24 animate-pulse rounded-xl bg-zinc-200" />
          <div className="h-9 w-28 animate-pulse rounded-xl bg-zinc-200" />
          <div className="h-9 w-28 animate-pulse rounded-xl bg-zinc-200" />
        </div>
      </td>
    </tr>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  className,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800",
        "hover:bg-zinc-50 disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-zinc-100",
        className
      )}
    >
      {children}
    </button>
  );
}

export default function AdminUsersPage() {
  const { getAccessToken } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // UI helpers
  const [onlyActive, setOnlyActive] = useState(false);

  // reset modal
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetPass, setResetPass] = useState("");

  // create form
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState<Role>("USER");

  // loading states
  const [loadingList, setLoadingList] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  // create collapse
  const [createOpen, setCreateOpen] = useState(true);

  // focus
  const searchRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let base = users;
    if (onlyActive) base = base.filter((u) => u.isActive);
    if (!qq) return base;
    return base.filter((u) => u.email.toLowerCase().includes(qq));
  }, [users, q, onlyActive]);

  const totals = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const admins = users.filter((u) => u.roles.includes("ADMIN")).length;
    const cashiers = users.filter((u) => u.roles.includes("CASHIER")).length;
    const managers = users.filter((u) => u.roles.includes("MANAGER")).length;
    return { total, active, admins, cashiers, managers };
  }, [users]);

  const totalLabel = useMemo(() => {
    const shown = filtered.length;
    const total = users.length;
    const base = !q.trim()
      ? `${total} usuario${total === 1 ? "" : "s"}`
      : `${shown} de ${total}`;
    return onlyActive ? `${base} (solo activos)` : base;
  }, [filtered.length, users.length, q, onlyActive]);

  async function load() {
    setError(null);
    setOkMsg(null);
    setLoadingList(true);
    try {
      const data = await apiFetchAuthed<UserRow[]>(
        getAccessToken,
        "/admin/users"
      );
      setUsers(data);
      setOkMsg("Listado actualizado ✔");
      window.setTimeout(() => setOkMsg(null), 2000);
    } catch (e: any) {
      setError(e?.message || "Error cargando usuarios");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createUser() {
    if (!newEmail.trim() || !newPass.trim()) return;

    setError(null);
    setOkMsg(null);
    setBusyAction(true);
    try {
      await apiFetchAuthed(getAccessToken, "/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: newEmail.trim(),
          password: newPass,
          roles: [newRole],
        }),
      });

      setNewEmail("");
      setNewPass("");
      setNewRole("USER");
      setOkMsg("Usuario creado ✔");
      window.setTimeout(() => setOkMsg(null), 2000);
      await load();
    } catch (e: any) {
      setError(e?.message || "Error creando usuario");
    } finally {
      setBusyAction(false);
    }
  }

  async function setRoles(userId: string, roles: Role[]) {
    setError(null);
    setOkMsg(null);
    setBusyAction(true);
    try {
      await apiFetchAuthed(getAccessToken, `/admin/users/${userId}/roles`, {
        method: "PATCH",
        body: JSON.stringify({ roles }),
      });
      setOkMsg("Roles actualizados ✔");
      window.setTimeout(() => setOkMsg(null), 2000);
      await load();
    } catch (e: any) {
      setError(e?.message || "Error actualizando roles");
    } finally {
      setBusyAction(false);
    }
  }

  function confirmPromoteAdmin(email: string) {
    return window.confirm(
      `¿Seguro que querés darle ADMIN a ${email}?\n\nEsto habilita crear usuarios y cambiar roles.`
    );
  }

  function confirmSetManager(email: string) {
    return window.confirm(
      `¿Asignar MANAGER a ${email}?\n\nMANAGER podrá acceder al panel de Manager y operar producción/asistencia/stock.`
    );
  }

  function confirmDemoteAdmin(email: string) {
    return window.confirm(`⚠️ Vas a quitar ADMIN a ${email}.\n\n¿Seguro?`);
  }

  function openReset(u: UserRow) {
    setResetUser(u);
    setResetPass("");
    setResetOpen(true);
  }

  async function submitReset() {
    if (!resetUser || !resetPass.trim()) return;
    setError(null);
    setOkMsg(null);
    setBusyAction(true);
    try {
      await apiFetchAuthed(
        getAccessToken,
        `/admin/users/${resetUser.id}/password`,
        {
          method: "PATCH",
          body: JSON.stringify({ password: resetPass }),
        }
      );
      setResetOpen(false);
      setResetUser(null);
      setResetPass("");
      setOkMsg("Password reseteada ✔");
      window.setTimeout(() => setOkMsg(null), 2000);
    } catch (e: any) {
      setError(e?.message || "Error reseteando password");
    } finally {
      setBusyAction(false);
    }
  }

  async function toggleActive(u: UserRow) {
    const next = !u.isActive;
    const ok = window.confirm(
      next
        ? `¿Reactivar a ${u.email}?`
        : `¿Desactivar a ${u.email}?\n\nNo podrá loguearse y se cortará su sesión.`
    );
    if (!ok) return;

    setError(null);
    setOkMsg(null);
    setBusyAction(true);
    try {
      await apiFetchAuthed(getAccessToken, `/admin/users/${u.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      setOkMsg(next ? "Usuario reactivado ✔" : "Usuario desactivado ✔");
      window.setTimeout(() => setOkMsg(null), 2000);
      await load();
    } catch (e: any) {
      setError(e?.message || "Error cambiando estado");
    } finally {
      setBusyAction(false);
    }
  }

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      setOkMsg("Email copiado ✔");
      window.setTimeout(() => setOkMsg(null), 1200);
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
                <h1 className="text-2xl font-bold text-zinc-900">
                  Admin • Usuarios
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Crear usuarios y administrar roles (USER / MANAGER / ADMIN).
                </p>

                {/* Quick stats */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                    Total: {totals.total}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Activos: {totals.active}
                  </span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Cashiers: {totals.cashiers}
                  </span>
                  <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                    Managers: {totals.managers}
                  </span>
                  <span className="rounded-full border border-zinc-900 bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white">
                    Admins: {totals.admins}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={load}
                  loading={loadingList}
                  disabled={busyAction}
                >
                  <span className="inline-flex items-center gap-2">
                    <RefreshCcw className="h-4 w-4" />
                    Refrescar
                  </span>
                </Button>

                <IconBtn
                  title="Ir a búsqueda"
                  onClick={() => searchRef.current?.focus()}
                  disabled={loadingList}
                >
                  <Search className="h-4 w-4" />
                </IconBtn>
              </div>
            </div>

            {/* Search + filters */}
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  placeholder="Buscar por email…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                />
              </div>

              <button
                type="button"
                onClick={() => setOnlyActive((v) => !v)}
                className={cn(
                  "h-10 rounded-xl border px-3 text-sm font-semibold transition",
                  onlyActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                )}
              >
                {onlyActive ? "Solo activos ✔" : "Todos"}
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

          {/* Create user (collapsible) */}
          <Card>
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div>
                <div className="text-base font-semibold text-zinc-900">
                  Crear usuario
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Solo ADMIN puede crear usuarios.
                </div>
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
                <div className="grid gap-3 md:grid-cols-4">
                  <Field label="Email">
                    <Input
                      placeholder="nuevo@correo.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </Field>

                  <Field label="Password">
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                    />
                  </Field>

                  <Field label="Rol inicial">
                    <Select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as Role)}
                    >
                      <option value="USER">USER</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="CASHIER">CASHIER</option>
                    </Select>
                  </Field>

                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      onClick={createUser}
                      loading={busyAction}
                      disabled={
                        busyAction || !newEmail.trim() || !newPass.trim()
                      }
                    >
                      <span className="inline-flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Crear
                      </span>
                    </Button>
                  </div>
                </div>

                <p className="mt-3 text-xs text-zinc-500">
                  Tip: si querés, después agregamos vínculo Usuario ↔ Empleado y
                  auditoría de cambios.
                </p>
              </CardBody>
            )}
          </Card>

          {/* List */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Listado</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Cambiá roles con 1 click. Promover a ADMIN pide confirmación.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Usuario
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Roles
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Acciones rápidas
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-zinc-100">
                  {loadingList && (
                    <>
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </>
                  )}

                  {!loadingList && filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-6 text-sm text-zinc-500"
                      >
                        No hay usuarios para mostrar.
                      </td>
                    </tr>
                  )}

                  {!loadingList &&
                    filtered.map((u) => {
                      const isAdmin = u.roles.includes("ADMIN");
                      const isManager = u.roles.includes("MANAGER");

                      return (
                        <tr key={u.id} className="hover:bg-zinc-50/60">
                          {/* Email */}
                          <td className="px-4 py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-semibold text-zinc-900">
                                  {u.email}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  <StatusPill active={u.isActive} />
                                </div>
                              </div>

                              <IconBtn
                                title="Copiar email"
                                onClick={() => copyEmail(u.email)}
                                disabled={busyAction}
                              >
                                <Copy className="h-4 w-4" />
                              </IconBtn>
                            </div>
                          </td>

                          {/* Roles */}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {u.roles.map((r) => (
                                <RolePill key={r} role={r} />
                              ))}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="secondary"
                                disabled={busyAction}
                                onClick={() => {
                                  if (isAdmin && !confirmDemoteAdmin(u.email))
                                    return;
                                  setRoles(u.id, ["USER"]);
                                }}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <UserIcon className="h-4 w-4" />
                                  USER
                                </span>
                              </Button>

                              <Button
                                variant="secondary"
                                disabled={busyAction || isAdmin}
                                onClick={() => {
                                  const ok = window.confirm(
                                    `¿Asignar CASHIER a ${u.email}?\n\nCASHIER podrá acceder al panel de caja/finanzas.`
                                  );
                                  if (!ok) return;
                                  setRoles(u.id, ["CASHIER"]);
                                }}
                              >
                                <span className="inline-flex items-center gap-2">
                                  {/* podés usar un icono distinto si querés */}
                                  <Briefcase className="h-4 w-4" />
                                  CASHIER
                                </span>
                              </Button>

                              <Button
                                variant="secondary"
                                disabled={busyAction || isAdmin}
                                onClick={() => {
                                  if (!confirmSetManager(u.email)) return;
                                  setRoles(u.id, ["MANAGER"]);
                                }}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <Briefcase className="h-4 w-4" />
                                  {isManager ? "MANAGER ✔" : "MANAGER"}
                                </span>
                              </Button>

                              <Button
                                variant="secondary"
                                disabled={busyAction || isAdmin}
                                onClick={() => {
                                  if (!confirmPromoteAdmin(u.email)) return;
                                  setRoles(u.id, ["ADMIN"]);
                                }}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <Shield className="h-4 w-4" />
                                  ADMIN
                                </span>
                              </Button>

                              <Button
                                variant="secondary"
                                disabled={busyAction}
                                onClick={() => openReset(u)}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <KeyRound className="h-4 w-4" />
                                  Reset
                                </span>
                              </Button>

                              <Button
                                variant={u.isActive ? "danger" : "secondary"}
                                disabled={busyAction}
                                onClick={() => toggleActive(u)}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <Power className="h-4 w-4" />
                                  {u.isActive ? "Desactivar" : "Reactivar"}
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

            <div className="border-t border-zinc-100 px-5 py-4 text-xs text-zinc-500">
              Recomendación: próxima feature → auditoría (quién cambió roles,
              cuándo y desde qué IP).
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={resetOpen}
        title={`Reset password • ${resetUser?.email ?? ""}`}
        onClose={() => setResetOpen(false)}
      >
        <div className="grid gap-3">
          <p className="text-sm text-zinc-600">
            Esto debería invalidar la sesión del usuario (refresh token).
          </p>

          <Input
            type="password"
            placeholder="Nueva contraseña"
            value={resetPass}
            onChange={(e) => setResetPass(e.target.value)}
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setResetOpen(false)}
              disabled={busyAction}
            >
              Cancelar
            </Button>
            <Button
              onClick={submitReset}
              loading={busyAction}
              disabled={busyAction || !resetPass.trim()}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </AdminProtected>
  );
}

function Modal({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  // Escape cierra
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 p-5">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
          </div>
          <button
            className="rounded-xl border border-zinc-200 bg-white p-2 text-zinc-700 hover:bg-zinc-50"
            onClick={onClose}
            aria-label="Cerrar"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
