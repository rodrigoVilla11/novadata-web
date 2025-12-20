"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import {
  RefreshCcw,
  Search,
  Plus,
  Save,
  X,
  Pencil,
  Power,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Tag,
} from "lucide-react";

type TaskRow = {
  id: string;
  name: string;
  area: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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
      {active ? "ACTIVA" : "INACTIVA"}
    </span>
  );
}

export default function AdminTasksPage() {
  const { getAccessToken } = useAuth();

  const [items, setItems] = useState<TaskRow[]>([]);
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [loadingList, setLoadingList] = useState(true);
  const [busy, setBusy] = useState(false);

  // create form (colapsable)
  const [createOpen, setCreateOpen] = useState(true);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");

  // edit inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editArea, setEditArea] = useState("");

  const searchRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let base = items;
    if (onlyActive) base = base.filter((t) => t.isActive);
    if (!qq) return base;
    return base.filter(
      (t) =>
        t.name.toLowerCase().includes(qq) ||
        (t.area || "").toLowerCase().includes(qq)
    );
  }, [items, q, onlyActive]);

  const totals = useMemo(() => {
    const total = items.length;
    const active = items.filter((t) => t.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [items]);

  async function load() {
    setError(null);
    setOk(null);
    setLoadingList(true);
    try {
      const data = await apiFetchAuthed<TaskRow[]>(getAccessToken, "/tasks");
      setItems(data);
      setOk("Datos actualizados ✔");
      window.setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setError(e?.message || "Error cargando tareas");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTask() {
    if (!name.trim()) return;

    setError(null);
    setOk(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, "/tasks", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          area: area.trim() ? area.trim() : null,
        }),
      });

      setName("");
      setArea("");
      setOk("Tarea creada ✔");
      window.setTimeout(() => setOk(null), 1500);

      await load();
    } catch (e: any) {
      setError(e?.message || "Error creando tarea");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(t: TaskRow) {
    setEditingId(t.id);
    setEditName(t.name);
    setEditArea(t.area ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditArea("");
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;

    setError(null);
    setOk(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          area: editArea.trim() ? editArea.trim() : null,
        }),
      });

      cancelEdit();
      setOk("Tarea actualizada ✔");
      window.setTimeout(() => setOk(null), 1500);

      await load();
    } catch (e: any) {
      setError(e?.message || "Error actualizando tarea");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(t: TaskRow) {
    const next = !t.isActive;
    const ok = window.confirm(
      next ? `¿Reactivar tarea "${t.name}"?` : `¿Desactivar tarea "${t.name}"?`
    );
    if (!ok) return;

    setError(null);
    setOk(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/tasks/${t.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });

      setOk(next ? "Tarea reactivada ✔" : "Tarea desactivada ✔");
      window.setTimeout(() => setOk(null), 1500);

      await load();
    } catch (e: any) {
      setError(e?.message || "Error cambiando estado");
    } finally {
      setBusy(false);
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
                  Admin • Tareas
                </h1>
                <p className="mt-1 text-sm text-zinc-500">
                  Catálogo de tareas para producción.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                    Total: {totals.total}
                  </span>
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Activas: {totals.active}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                    Inactivas: {totals.inactive}
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
                  title="Buscar"
                  onClick={() => searchRef.current?.focus()}
                  disabled={loadingList}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Filtros */}
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nombre o área…"
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
                <Tag className="h-4 w-4" />
                {onlyActive ? "Solo activas" : "Todas"}
              </button>
            </div>

            {(error || ok) && (
              <div className="mt-3 grid gap-2">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      {error}
                    </span>
                  </div>
                )}
                {ok && !error && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    <span className="inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {ok}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Crear (colapsable) */}
          <Card>
            <div className="flex items-start justify-between gap-4 px-5 pt-5">
              <div>
                <div className="text-base font-semibold text-zinc-900">
                  Crear tarea
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Definí un nombre y un área opcional (ej: Cocina, Barra, Depósito).
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
                <div className="grid gap-4 md:grid-cols-4">
                  <Field label="Nombre">
                    <div className="relative">
                      <ClipboardList className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej: Lavar plancha"
                        className="pl-9"
                      />
                    </div>
                  </Field>

                  <Field label="Área (opcional)">
                    <Input
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="Ej: Cocina"
                    />
                  </Field>

                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      onClick={createTask}
                      disabled={busy || !name.trim()}
                      loading={busy}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Crear
                      </span>
                    </Button>
                  </div>

                  <div className="flex items-end">
                    <Button
                      className="w-full"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setName("");
                        setArea("");
                        setError(null);
                        setOk(null);
                      }}
                    >
                      Limpiar
                    </Button>
                  </div>
                </div>
              </CardBody>
            )}
          </Card>

          {/* Listado */}
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">Listado</h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {filtered.length} tarea(s) — editá inline y activá/desactivá.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Nombre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Área
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
                      <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                        Cargando…
                      </td>
                    </tr>
                  )}

                  {!loadingList && filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                        No hay tareas.
                      </td>
                    </tr>
                  )}

                  {!loadingList &&
                    filtered.map((t) => {
                      const isEditing = editingId === t.id;

                      return (
                        <tr key={t.id} className="hover:bg-zinc-50/60">
                          {/* Nombre */}
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                              />
                            ) : (
                              <div className="text-sm font-semibold text-zinc-900">
                                {t.name}
                              </div>
                            )}
                          </td>

                          {/* Área */}
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editArea}
                                onChange={(e) => setEditArea(e.target.value)}
                              />
                            ) : (
                              <div className="text-sm text-zinc-700">
                                {t.area ?? "—"}
                              </div>
                            )}
                          </td>

                          {/* Estado */}
                          <td className="px-4 py-3">
                            <StatusPill active={t.isActive} />
                          </td>

                          {/* Acciones */}
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              {!isEditing ? (
                                <>
                                  <Button
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => startEdit(t)}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <Pencil className="h-4 w-4" />
                                      Editar
                                    </span>
                                  </Button>

                                  <Button
                                    variant={t.isActive ? "danger" : "secondary"}
                                    disabled={busy}
                                    onClick={() => toggleActive(t)}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <Power className="h-4 w-4" />
                                      {t.isActive ? "Desactivar" : "Reactivar"}
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
                                    disabled={busy || !editName.trim()}
                                    loading={busy}
                                    onClick={() => saveEdit(t.id)}
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

            <div className="border-t border-zinc-100 px-5 py-4 text-sm text-zinc-500">
              Tip: definí áreas simples (Cocina / Barra / Depósito) para filtrar
              mentalmente rápido cuando cargan producción.
            </div>
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
