"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

type Role = "USER" | "ADMIN" | "MANAGER"; // ✅ NUEVO

type UserRow = {
  id: string;
  email: string;
  roles: Role[]; // ✅ tipado
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function RolePill({ role }: { role: Role }) {
  const isAdmin = role === "ADMIN";
  const isManager = role === "MANAGER";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border",
        isAdmin
          ? "bg-zinc-900 text-white border-zinc-900"
          : isManager
          ? "bg-blue-50 text-blue-700 border-blue-200"
          : "bg-zinc-100 text-zinc-800 border-zinc-200",
      ].join(" ")}
    >
      {role}
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
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <div className="h-9 w-20 animate-pulse rounded-xl bg-zinc-200" />
          <div className="h-9 w-20 animate-pulse rounded-xl bg-zinc-200" />
          <div className="h-9 w-24 animate-pulse rounded-xl bg-zinc-200" />
        </div>
      </td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const { getAccessToken } = useAuth();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [resetPass, setResetPass] = useState("");

  // create form
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState<Role>("USER"); // ✅ ahora soporta MANAGER

  // loading states
  const [loadingList, setLoadingList] = useState(true);
  const [busyAction, setBusyAction] = useState(false);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return users;
    return users.filter((u) => u.email.toLowerCase().includes(qq));
  }, [users, q]);

  const totalLabel = useMemo(() => {
    const shown = filtered.length;
    const total = users.length;
    if (!q.trim()) return `${total} usuario${total === 1 ? "" : "s"}`;
    return `${shown} de ${total}`;
  }, [filtered.length, users.length, q]);

  async function load() {
    setError(null);
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
    if (!newEmail.trim() || !newPass.trim()) return;

    setError(null);
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
      await load();
    } catch (e: any) {
      setError(e?.message || "Error creando usuario");
    } finally {
      setBusyAction(false);
    }
  }

  async function setRoles(userId: string, roles: Role[]) {
    setError(null);
    setBusyAction(true);
    try {
      await apiFetchAuthed(getAccessToken, `/admin/users/${userId}/roles`, {
        method: "PATCH",
        body: JSON.stringify({ roles }),
      });
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
      `¿Asignar MANAGER a ${email}?\n\nMANAGER podrá cargar producción/horarios (cuando lo implementemos).`
    );
  }

  function confirmDemoteAdmin(email: string) {
    return window.confirm(
      `⚠️ Vas a quitar ADMIN a ${email}.\n\n¿Seguro?`
    );
  }

  function openReset(u: UserRow) {
    setResetUser(u);
    setResetPass("");
    setResetOpen(true);
  }

  async function submitReset() {
    if (!resetUser || !resetPass.trim()) return;
    setError(null);
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
    setBusyAction(true);
    try {
      await apiFetchAuthed(getAccessToken, `/admin/users/${u.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });
      await load();
    } catch (e: any) {
      setError(e?.message || "Error cambiando estado");
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <AdminProtected>
      <div className="min-h-screen bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-8">
          {/* Header */}
          <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-zinc-100 bg-zinc-50/90 px-4 py-4 backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-zinc-900">
                  Admin • Usuarios
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Crear usuarios y administrar roles (USER / MANAGER / ADMIN).
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={load}
                  loading={loadingList}
                  disabled={busyAction}
                >
                  Refrescar
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                placeholder="Buscar por email…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="text-sm text-zinc-500">{totalLabel}</div>
            </div>

            {error && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Create user */}
          <Card>
            <CardHeader
              title="Crear usuario"
              subtitle="Solo ADMIN puede crear usuarios."
            />
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
                  </Select>
                </Field>

                <div className="flex items-end">
                  <Button
                    className="w-full"
                    onClick={createUser}
                    loading={busyAction}
                    disabled={busyAction || !newEmail.trim() || !newPass.trim()}
                  >
                    Crear
                  </Button>
                </div>
              </div>

              <p className="mt-3 text-xs text-zinc-500">
                El refresh token queda en cookie httpOnly. El access token se
                renueva automáticamente si expira.
              </p>
            </CardBody>
          </Card>

          {/* List */}
          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Listado</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Cambiá roles con un click. Promover a ADMIN pide confirmación.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Roles
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Acciones
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
                      <td colSpan={3} className="px-4 py-6 text-sm text-zinc-500">
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
                          <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                            {u.email}
                          </td>

                          {/* Roles */}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {u.roles.map((r) => (
                                <RolePill key={r} role={r} />
                              ))}
                            </div>
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {/* Estado */}
                              <span
                                className={[
                                  "rounded-full px-2.5 py-1 text-xs font-semibold border",
                                  u.isActive
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-zinc-100 text-zinc-600 border-zinc-200",
                                ].join(" ")}
                              >
                                {u.isActive ? "ACTIVO" : "INACTIVO"}
                              </span>

                              {/* Set USER */}
                              <Button
                                variant="secondary"
                                disabled={busyAction}
                                onClick={() => {
                                  if (isAdmin && !confirmDemoteAdmin(u.email)) return;
                                  setRoles(u.id, ["USER"]);
                                }}
                              >
                                Set USER
                              </Button>

                              {/* Set MANAGER */}
                              <Button
                                variant="secondary"
                                disabled={busyAction || isAdmin}
                                onClick={() => {
                                  if (!confirmSetManager(u.email)) return;
                                  setRoles(u.id, ["MANAGER"]);
                                }}
                              >
                                {isManager ? "MANAGER ✔" : "Set MANAGER"}
                              </Button>

                              {/* Set ADMIN */}
                              <Button
                                variant="secondary"
                                disabled={busyAction || isAdmin}
                                onClick={() => {
                                  if (!confirmPromoteAdmin(u.email)) return;
                                  setRoles(u.id, ["ADMIN"]);
                                }}
                              >
                                Set ADMIN
                              </Button>

                              {/* Reset password */}
                              <Button
                                variant="secondary"
                                disabled={busyAction}
                                onClick={() => openReset(u)}
                              >
                                Reset Pass
                              </Button>

                              {/* Activar / desactivar */}
                              <Button
                                variant={u.isActive ? "danger" : "secondary"}
                                disabled={busyAction}
                                onClick={() => toggleActive(u)}
                              >
                                {u.isActive ? "Desactivar" : "Reactivar"}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer note */}
          <div className="mt-6 text-xs text-zinc-500">
            Recomendación: agreguemos auditoría (quién cambió roles y cuándo)
            como próxima feature.
          </div>
        </div>
      </div>

      <Modal
        open={resetOpen}
        title={`Reset password ${resetUser?.email ?? ""}`}
        onClose={() => setResetOpen(false)}
      >
        <div className="grid gap-3">
          <p className="text-sm text-zinc-600">
            Esto invalidará la sesión del usuario (se corta refresh token).
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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 p-5">
          <div>
            <h3 className="text-lg font-semibold text-zinc-900">{title}</h3>
          </div>
          <button
            className="rounded-lg px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
