"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  RefreshCcw,
  Search,
  Plus,
  KeyRound,
  Power,
  X,
  Mail,
  User as UserIcon,
  ShieldCheck,
} from "lucide-react";

/* ============================================================================
 * Types
 * ========================================================================== */

type Role = "USER" | "MANAGER" | "CASHIER"; // ✅ ADMIN NO acá (no puede ser asignado por ADMIN)

type UserRow = {
  id: string;
  email: string;
  username?: string | null;
  roles: Array<"USER" | "ADMIN" | "MANAGER" | "CASHIER" | "SUPERADMIN">;
  isActive: boolean;
  branchId?: string | null;
};

/* ============================================================================
 * Helpers
 * ========================================================================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ============================================================================
 * Pills
 * ========================================================================== */

function RolePill({ role }: { role: UserRow["roles"][number] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border",
        role === "ADMIN"
          ? "bg-zinc-900 text-white border-zinc-900"
          : role === "MANAGER"
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : role === "CASHIER"
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : role === "SUPERADMIN"
          ? "bg-indigo-50 text-indigo-800 border-indigo-200"
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

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warn" | "info";
}) {
  const cls =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "info"
      ? "border-sky-200 bg-sky-50 text-sky-900"
      : "border-zinc-200 bg-zinc-50 text-zinc-800";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        cls
      )}
    >
      <span className="text-zinc-500">{label}</span>
      <span>{value}</span>
    </span>
  );
}

/* ============================================================================
 * Page (ruta Next: /admin/users)
 * ========================================================================== */

export default function AdminUsersPage() {
  const { getAccessToken } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  const [loadingList, setLoadingList] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  // create
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState<Role>("USER");

  // reset modal
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetPass, setResetPass] = useState("");

  const searchRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    let base = users;
    if (onlyActive) base = base.filter((u) => u.isActive);
    if (!q.trim()) return base;
    const needle = q.trim().toLowerCase();
    return base.filter((u) => u.email.toLowerCase().includes(needle));
  }, [users, q, onlyActive]);

  const totals = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      admins: users.filter((u) => u.roles.includes("ADMIN")).length,
      managers: users.filter((u) => u.roles.includes("MANAGER")).length,
      cashiers: users.filter((u) => u.roles.includes("CASHIER")).length,
      users: users.filter((u) => u.roles.includes("USER")).length,
    };
  }, [users]);

  /* ============================================================================
   * API
   * ========================================================================== */

  async function load() {
    setError(null);
    setOkMsg(null);
    setLoadingList(true);
    try {
      const data = await apiFetchAuthed<UserRow[]>(getAccessToken, "/users");
      setUsers(Array.isArray(data) ? data : []);
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
    if (!newEmail.trim() || !newPass) return;

    setBusyAction(true);
    setError(null);
    setOkMsg(null);

    try {
      await apiFetchAuthed(getAccessToken, "/users", {
        method: "POST",
        body: JSON.stringify({
          email: newEmail.trim().toLowerCase(),
          password: newPass,
          roles: [newRole],
          username: newUsername.trim() || null,
        }),
      });

      setNewEmail("");
      setNewPass("");
      setNewUsername("");
      setNewRole("USER");
      setCreateOpen(false);

      setOkMsg("Usuario creado ✔");
      await load();
    } catch (e: any) {
      setError(e?.message || "Error creando usuario");
    } finally {
      setBusyAction(false);
    }
  }

  async function setRoles(id: string, roles: Role[]) {
    setBusyAction(true);
    setError(null);
    setOkMsg(null);

    try {
      await apiFetchAuthed(getAccessToken, `/users/${id}/roles`, {
        method: "PATCH",
        body: JSON.stringify({ roles }),
      });
      await load();
      setOkMsg("Roles actualizados ✔");
    } catch (e: any) {
      setError(e?.message || "Error actualizando roles");
    } finally {
      setBusyAction(false);
    }
  }

  async function toggleActive(u: UserRow) {
    const ok = window.confirm(
      u.isActive ? `¿Desactivar a ${u.email}?` : `¿Reactivar a ${u.email}?`
    );
    if (!ok) return;

    setBusyAction(true);
    setError(null);
    setOkMsg(null);

    try {
      await apiFetchAuthed(getAccessToken, `/users/${u.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      await load();
      setOkMsg(u.isActive ? "Usuario desactivado ✔" : "Usuario reactivado ✔");
    } catch (e: any) {
      setError(e?.message || "Error cambiando estado");
    } finally {
      setBusyAction(false);
    }
  }

  async function submitReset() {
    if (!resetUser || !resetPass) return;

    setBusyAction(true);
    setError(null);
    setOkMsg(null);

    try {
      await apiFetchAuthed(getAccessToken, `/users/${resetUser.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword: resetPass }),
      });

      setResetOpen(false);
      setResetUser(null);
      setResetPass("");

      setOkMsg("Password reseteada ✔");
      await load();
    } catch (e: any) {
      setError(e?.message || "Error reseteando password");
    } finally {
      setBusyAction(false);
    }
  }

  /* ============================================================================
   * UX helpers
   * ========================================================================== */

  const canCreate = !!newEmail.trim() && !!newPass && !busyAction;
  const hasFilters = !!q.trim() || onlyActive;

  /* ============================================================================
   * Render
   * ========================================================================== */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl border bg-white flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-zinc-900">
                  Usuarios 
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Gestión de accesos, roles y estado de usuarios de tu sucursal.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <StatChip label="Total" value={totals.total} tone="neutral" />
              <StatChip label="Activos" value={totals.active} tone="success" />
              <StatChip label="Managers" value={totals.managers} tone="info" />
              <StatChip label="Cashiers" value={totals.cashiers} tone="warn" />
              <StatChip label="Admins" value={totals.admins} tone="neutral" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-end">
            <Button
              variant="secondary"
              onClick={load}
              loading={loadingList}
              disabled={busyAction}
              className="w-full sm:w-auto"
            >
              <div className="inline-flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                <span className="sm:hidden">Recargar</span>
              </div>
            </Button>

            <Button
              onClick={() => setCreateOpen(true)}
              disabled={busyAction}
              className="w-full sm:w-auto"
            >
              <div className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Nuevo usuario
              </div>
            </Button>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(error || okMsg) && (
        <div
          className={cn(
            "rounded-2xl border p-4 text-sm",
            error
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          )}
        >
          {error || okMsg}
        </div>
      )}

      {/* Toolbar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              ref={searchRef as any}
              placeholder="Buscar por email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>

          <button
            onClick={() => setOnlyActive((v) => !v)}
            className={cn(
              "h-10 rounded-xl border px-3 text-sm font-semibold w-full sm:w-auto",
              onlyActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
            )}
          >
            {onlyActive ? "Solo activos" : "Todos"}
          </button>

          <Button
            variant="secondary"
            onClick={() => {
              setQ("");
              setOnlyActive(false);
              searchRef.current?.focus?.();
            }}
            disabled={busyAction || !hasFilters}
            className="w-full sm:w-auto"
          >
            Limpiar
          </Button>
        </div>
      </div>

      {/* List (desktop table) */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">
                Usuario
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">
                Roles
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-zinc-50 transition">
                <td className="px-4 py-3">
                  <div className="font-semibold text-zinc-900">{u.email}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusPill active={u.isActive} />
                    {u.username ? (
                      <span className="text-xs text-zinc-500 truncate">
                        {u.username}
                      </span>
                    ) : null}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {u.roles.map((r) => (
                      <RolePill key={r} role={r} />
                    ))}
                  </div>
                </td>

                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => setRoles(u.id, ["USER"])}
                      disabled={busyAction}
                    >
                      USER
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setRoles(u.id, ["MANAGER"])}
                      disabled={busyAction}
                    >
                      MANAGER
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setRoles(u.id, ["CASHIER"])}
                      disabled={busyAction}
                    >
                      CASHIER
                    </Button>

                    <Button
                      variant="secondary"
                      onClick={() => {
                        setResetUser(u);
                        setResetOpen(true);
                      }}
                      disabled={busyAction}
                      title="Reset password"
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>

                    <Button
                      variant={u.isActive ? "danger" : "secondary"}
                      onClick={() => toggleActive(u)}
                      disabled={busyAction}
                      title={u.isActive ? "Desactivar" : "Reactivar"}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}

            {!loadingList && filtered.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-sm text-zinc-500" colSpan={3}>
                  No hay usuarios para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* List (mobile cards) */}
      <div className="md:hidden space-y-3">
        {filtered.map((u) => (
          <div
            key={u.id}
            className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl border border-zinc-200 bg-zinc-50 p-2 shrink-0">
                <Mail className="h-4 w-4 text-zinc-700" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="font-semibold text-zinc-900 truncate">
                  {u.email}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <StatusPill active={u.isActive} />
                  {u.username ? (
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
                      <UserIcon className="h-3.5 w-3.5" />
                      <span className="truncate max-w-55">
                        {u.username}
                      </span>
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {u.roles.map((r) => (
                    <RolePill key={r} role={r} />
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setRoles(u.id, ["USER"])}
                    disabled={busyAction}
                    className="w-full"
                  >
                    USER
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setRoles(u.id, ["MANAGER"])}
                    disabled={busyAction}
                    className="w-full"
                  >
                    MANAGER
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setRoles(u.id, ["CASHIER"])}
                    disabled={busyAction}
                    className="w-full"
                  >
                    CASHIER
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setResetUser(u);
                      setResetOpen(true);
                    }}
                    disabled={busyAction}
                    className="w-full"
                    title="Reset password"
                  >
                    <div className="inline-flex items-center gap-2">
                      <KeyRound className="h-4 w-4" />
                      Reset
                    </div>
                  </Button>

                  <div className="col-span-2">
                    <Button
                      variant={u.isActive ? "danger" : "secondary"}
                      onClick={() => toggleActive(u)}
                      disabled={busyAction}
                      className="w-full"
                      title={u.isActive ? "Desactivar" : "Reactivar"}
                    >
                      <div className="inline-flex items-center gap-2">
                        <Power className="h-4 w-4" />
                        {u.isActive ? "Desactivar" : "Reactivar"}
                      </div>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {!loadingList && filtered.length === 0 && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
            No hay usuarios para mostrar.
          </div>
        )}
      </div>

      {/* Create Drawer/Modal */}
      <Modal
        open={createOpen}
        title="Crear usuario"
        onClose={() => setCreateOpen(false)}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            Como ADMIN podés crear <b>USER</b>, <b>MANAGER</b> o <b>CASHIER</b>{" "}
            para tu sucursal.
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Email">
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="mail@dominio.com"
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            <Field label="Username (opcional)">
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Nombre visible"
              />
            </Field>

            <Field label="Rol">
              <Select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
              >
                <option value="USER">USER</option>
                <option value="MANAGER">MANAGER</option>
                <option value="CASHIER">CASHIER</option>
              </Select>
            </Field>
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setCreateOpen(false)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={createUser}
              disabled={!canCreate}
              className="w-full sm:w-auto"
            >
              <div className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Crear
              </div>
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reset modal */}
      <Modal
        open={resetOpen}
        title={`Reset password • ${resetUser?.email ?? ""}`}
        onClose={() => {
          setResetOpen(false);
          setResetUser(null);
          setResetPass("");
        }}
      >
        <Input
          type="password"
          placeholder="Nueva contraseña"
          value={resetPass}
          onChange={(e) => setResetPass(e.target.value)}
        />

        <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setResetOpen(false);
              setResetUser(null);
              setResetPass("");
            }}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button
            onClick={submitReset}
            disabled={busyAction || !resetPass}
            className="w-full sm:w-auto"
          >
            Confirmar
          </Button>
        </div>
      </Modal>
    </div>
  );
}

/* ============================================================================
 * Modal
 * ========================================================================== */

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-100 p-5">
          <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-200 p-2 hover:bg-zinc-50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
