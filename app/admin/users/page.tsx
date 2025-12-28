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

/* ============================================================================
 * Types & helpers
 * ========================================================================== */

type Role = "USER" | "ADMIN" | "MANAGER" | "CASHIER";

type UserRow = {
  id: string;
  email: string;
  roles: Role[];
  isActive: boolean;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ============================================================================
 * Pills
 * ========================================================================== */

function RolePill({ role }: { role: Role }) {
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

/* ============================================================================
 * Page
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
  const [createOpen, setCreateOpen] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState<Role>("USER");

  // reset modal
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetPass, setResetPass] = useState("");

  const searchRef = useRef<HTMLInputElement | null>(null);

  /* ============================================================================
   * Derived
   * ========================================================================== */

  const filtered = useMemo(() => {
    let base = users;
    if (onlyActive) base = base.filter((u) => u.isActive);
    if (!q.trim()) return base;
    return base.filter((u) =>
      u.email.toLowerCase().includes(q.trim().toLowerCase())
    );
  }, [users, q, onlyActive]);

  const totals = useMemo(() => {
    return {
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      admins: users.filter((u) => u.roles.includes("ADMIN")).length,
      managers: users.filter((u) => u.roles.includes("MANAGER")).length,
      cashiers: users.filter((u) => u.roles.includes("CASHIER")).length,
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
      const data = await apiFetchAuthed<UserRow[]>(
        getAccessToken,
        "/admin/users"
      );
      setUsers(data);
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
    if (!newEmail || !newPass) return;
    setBusyAction(true);
    try {
      await apiFetchAuthed(getAccessToken, "/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: newEmail,
          password: newPass,
          roles: [newRole],
        }),
      });
      setNewEmail("");
      setNewPass("");
      setNewRole("USER");
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
    try {
      await apiFetchAuthed(getAccessToken, `/admin/users/${id}/roles`, {
        method: "PATCH",
        body: JSON.stringify({ roles }),
      });
      await load();
    } finally {
      setBusyAction(false);
    }
  }

  async function toggleActive(u: UserRow) {
    const ok = window.confirm(
      u.isActive
        ? `¿Desactivar a ${u.email}?`
        : `¿Reactivar a ${u.email}?`
    );
    if (!ok) return;

    setBusyAction(true);
    try {
      await apiFetchAuthed(getAccessToken, `/admin/users/${u.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      await load();
    } finally {
      setBusyAction(false);
    }
  }

  async function submitReset() {
    if (!resetUser || !resetPass) return;
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
    } finally {
      setBusyAction(false);
    }
  }

  /* ============================================================================
   * Render
   * ========================================================================== */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Usuarios
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Gestión de accesos, roles y estado de usuarios.
        </p>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <span>Total: <b>{totals.total}</b></span>
          <span className="text-emerald-700">Activos: <b>{totals.active}</b></span>
          <span className="text-blue-700">Managers: <b>{totals.managers}</b></span>
          <span className="text-amber-700">Cashiers: <b>{totals.cashiers}</b></span>
          <span className="text-zinc-900">Admins: <b>{totals.admins}</b></span>
        </div>
      </div>

      {/* Toolbar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
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
            onClick={() => setOnlyActive((v) => !v)}
            className={cn(
              "h-10 rounded-xl border px-3 text-sm font-semibold",
              onlyActive
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
            )}
          >
            {onlyActive ? "Solo activos" : "Todos"}
          </button>

          <Button
            variant="secondary"
            onClick={load}
            loading={loadingList}
            disabled={busyAction}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Create */}
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
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </Field>

              <Field label="Password">
                <Input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
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
                  <option value="ADMIN">ADMIN</option>
                </Select>
              </Field>

              <div className="flex items-end">
                <Button
                  className="w-full"
                  onClick={createUser}
                  disabled={busyAction || !newEmail || !newPass}
                >
                  <Plus className="h-4 w-4" />
                  Crear
                </Button>
              </div>
            </div>
          </CardBody>
        )}
      </Card>

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">
                Usuario
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">
                Roles
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-zinc-50 transition">
                <td className="px-4 py-3">
                  <div className="font-semibold text-zinc-900">{u.email}</div>
                  <StatusPill active={u.isActive} />
                </td>

                <td className="px-4 py-3 flex flex-wrap gap-2">
                  {u.roles.map((r) => (
                    <RolePill key={r} role={r} />
                  ))}
                </td>

                <td className="px-4 py-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setRoles(u.id, ["USER"])}>USER</Button>
                  <Button variant="secondary" onClick={() => setRoles(u.id, ["MANAGER"])}>MANAGER</Button>
                  <Button variant="secondary" onClick={() => setRoles(u.id, ["CASHIER"])}>CASHIER</Button>
                  <Button variant="secondary" onClick={() => setRoles(u.id, ["ADMIN"])}>ADMIN</Button>
                  <Button variant="secondary" onClick={() => { setResetUser(u); setResetOpen(true); }}>
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={u.isActive ? "danger" : "secondary"}
                    onClick={() => toggleActive(u)}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Reset modal */}
      <Modal
        open={resetOpen}
        title={`Reset password • ${resetUser?.email ?? ""}`}
        onClose={() => setResetOpen(false)}
      >
        <Input
          type="password"
          placeholder="Nueva contraseña"
          value={resetPass}
          onChange={(e) => setResetPass(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setResetOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submitReset}>Confirmar</Button>
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
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
