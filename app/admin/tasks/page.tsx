"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

type TaskRow = {
  id: string;
  name: string;
  area: string | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  branchId?: string | null; // (opcional) si backend lo devuelve
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

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="h-4 w-44 rounded bg-zinc-100" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-28 rounded bg-zinc-100" />
      </td>
      <td className="px-4 py-3">
        <div className="h-6 w-20 rounded-full bg-zinc-100" />
      </td>
      <td className="px-4 py-3">
        <div className="h-10 w-56 rounded-xl bg-zinc-100" />
      </td>
    </tr>
  );
}

type SortKey = "name" | "area" | "isActive";
type SortDir = "asc" | "desc";

function sortLabel(k: SortKey) {
  if (k === "name") return "Nombre";
  if (k === "area") return "Área";
  return "Estado";
}

function cmpStr(a: string, b: string) {
  return a.localeCompare(b, "es", { sensitivity: "base" });
}

export default function AdminTasksPage() {
  const { getAccessToken } = useAuth();

  const [items, setItems] = useState<TaskRow[]>([]);
  const [qRaw, setQRaw] = useState("");
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);

  const [areaFilter, setAreaFilter] = useState(""); // NEW (filtro exacto backend)

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const [loadingList, setLoadingList] = useState(true);
  const [busy, setBusy] = useState(false);

  // create form (colapsable)
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [area, setArea] = useState("");

  // edit inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editArea, setEditArea] = useState("");

  const searchRef = useRef<HTMLInputElement | null>(null);

  function flashOk(msg: string) {
    setOk(msg);
    window.setTimeout(() => setOk(null), 1500);
  }

  // Debounce búsqueda local
  useEffect(() => {
    const t = window.setTimeout(() => setQ(qRaw.trim()), 150);
    return () => window.clearTimeout(t);
  }, [qRaw]);

  function buildListUrl() {
    const sp = new URLSearchParams();
    if (onlyActive) sp.set("activeOnly", "true");
    if (areaFilter.trim()) sp.set("area", areaFilter.trim());
    const qs = sp.toString();
    return qs ? `/tasks?${qs}` : "/tasks";
  }

  async function load(opts?: { silentOk?: boolean }) {
    setError(null);
    if (!opts?.silentOk) setOk(null);
    setLoadingList(true);
    try {
      const url = buildListUrl(); // NEW
      const data = await apiFetchAuthed<TaskRow[]>(getAccessToken, url);
      setItems(Array.isArray(data) ? data : []);
      if (!opts?.silentOk) flashOk("Datos actualizados ✔");
    } catch (e: any) {
      setError(e?.message || "Error cargando tareas");
    } finally {
      setLoadingList(false);
    }
  }

  // inicial
  useEffect(() => {
    load({ silentOk: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // NEW: recargar cuando cambian filtros backend
  useEffect(() => {
    load({ silentOk: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onlyActive, areaFilter]);

  // Atajos: "/" enfoca buscar, "Esc" limpia/cancela
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as any)?.tagName?.toLowerCase?.();
      const inInput =
        tag === "input" ||
        tag === "textarea" ||
        (e.target as any)?.isContentEditable;

      if (!inInput && e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (editingId) cancelEdit();
        else if (qRaw) setQRaw("");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingId, qRaw]);

  const totals = useMemo(() => {
    const total = items.length;
    const active = items.filter((t) => t.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [items]);

  // Client-side search + sort (sobre lo que ya filtró backend)
  const filteredSorted = useMemo(() => {
    const qq = q.toLowerCase();
    let base = items;

    if (qq) {
      base = base.filter(
        (t) =>
          t.name.toLowerCase().includes(qq) ||
          (t.area || "").toLowerCase().includes(qq)
      );
    }

    const dir = sortDir === "asc" ? 1 : -1;

    const sorted = [...base].sort((a, b) => {
      if (sortKey === "name") return dir * cmpStr(a.name, b.name);
      if (sortKey === "area") return dir * cmpStr(a.area ?? "", b.area ?? "");
      return dir * (Number(b.isActive) - Number(a.isActive));
    });

    return sorted;
  }, [items, q, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
      return;
    }
    setSortDir((d) => (d === "asc" ? "desc" : "asc"));
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

  async function createTask() {
    const n = name.trim();
    if (!n) return;

    setError(null);
    setOk(null);
    setBusy(true);

    const tempId = `tmp_${Date.now()}`;
    const optimistic: TaskRow = {
      id: tempId,
      name: n,
      area: area.trim() ? area.trim() : null,
      isActive: true,
    };
    setItems((prev) => [optimistic, ...prev]);

    try {
      await apiFetchAuthed(getAccessToken, "/tasks", {
        method: "POST",
        body: JSON.stringify({
          name: n,
          area: area.trim() ? area.trim() : null,
        }),
      });

      setName("");
      setArea("");
      flashOk("Tarea creada ✔");
      await load({ silentOk: true });
    } catch (e: any) {
      setItems((prev) => prev.filter((x) => x.id !== tempId));
      setError(e?.message || "Error creando tarea");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(id: string) {
    const n = editName.trim();
    if (!n) return;

    setError(null);
    setOk(null);
    setBusy(true);

    const prev = items;
    setItems((curr) =>
      curr.map((t) =>
        t.id === id
          ? { ...t, name: n, area: editArea.trim() ? editArea.trim() : null }
          : t
      )
    );

    try {
      await apiFetchAuthed(getAccessToken, `/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: n,
          area: editArea.trim() ? editArea.trim() : null,
        }),
      });

      cancelEdit();
      flashOk("Tarea actualizada ✔");
      await load({ silentOk: true });
    } catch (e: any) {
      setItems(prev);
      setError(e?.message || "Error actualizando tarea");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(t: TaskRow) {
    const next = !t.isActive;
    const okConfirm = window.confirm(
      next ? `¿Reactivar tarea "${t.name}"?` : `¿Desactivar tarea "${t.name}"?`
    );
    if (!okConfirm) return;

    setError(null);
    setOk(null);
    setBusy(true);

    const prev = items;
    setItems((curr) =>
      curr.map((x) => (x.id === t.id ? { ...x, isActive: next } : x))
    );

    try {
      await apiFetchAuthed(getAccessToken, `/tasks/${t.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });

      flashOk(next ? "Tarea reactivada ✔" : "Tarea desactivada ✔");
      await load({ silentOk: true });
    } catch (e: any) {
      setItems(prev);
      setError(e?.message || "Error cambiando estado");
    } finally {
      setBusy(false);
    }
  }

  const showEmpty = !loadingList && filteredSorted.length === 0;

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Tareas
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Catálogo de tareas para producción (con área opcional).
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
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

              <div className="mt-2 text-xs text-zinc-400">
                Tip: presioná <span className="font-semibold">/</span> para buscar ·{" "}
                <span className="font-semibold">Esc</span> para limpiar/cancelar
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => load()}
                disabled={busy}
                loading={loadingList}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </span>
              </Button>

              <button
                type="button"
                title="Buscar (/) "
                onClick={() => searchRef.current?.focus()}
                disabled={loadingList}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {(error || ok) && (
          <div className="grid gap-2">
            {error && <Notice tone="error">{error}</Notice>}
            {!error && ok && <Notice tone="ok">{ok}</Notice>}
          </div>
        )}

        {/* Filters */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px_auto_auto] sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={qRaw}
                onChange={(e) => setQRaw(e.target.value)}
                placeholder="Buscar por nombre o área…"
                className="pl-9"
              />
              {qRaw && (
                <button
                  type="button"
                  onClick={() => setQRaw("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
                  title="Limpiar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* NEW: filtro por área exacto (backend) */}
            <Input
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              placeholder="Filtrar área (ej: Cocina)"
              title="Filtra por área exacta (backend)"
            />

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

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500">Orden:</span>
              <button
                type="button"
                onClick={() => toggleSort(sortKey)}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 inline-flex items-center gap-2"
                title="Cambiar asc/desc"
              >
                {sortLabel(sortKey)}
                {sortDir === "asc" ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  toggleSort(
                    sortKey === "name"
                      ? "area"
                      : sortKey === "area"
                      ? "isActive"
                      : "name"
                  )
                }
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 inline-flex items-center gap-2"
                title="Cambiar criterio"
              >
                <ArrowUpDown className="h-4 w-4" />
                Criterio
              </button>
            </div>
          </div>
        </div>

        {/* Create */}
        <Card>
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div>
              <div className="text-base font-semibold text-zinc-900">
                Crear tarea
              </div>
              <div className="mt-1 text-sm text-zinc-500">
                Nombre + área opcional (Cocina, Barra, Depósito).
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

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">Listado</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {filteredSorted.length} tarea(s). Editá inline y activá/desactivá.
            </p>
          </div>

          {showEmpty ? (
            <div className="px-5 py-10">
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-6">
                <div className="text-base font-semibold text-zinc-900">
                  No hay resultados
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  Probá limpiar filtros o crear una nueva tarea.
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    onClick={() => {
                      setCreateOpen(true);
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Crear tarea
                    </span>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQRaw("");
                      setOnlyActive(false);
                      setAreaFilter(""); // NEW
                      setSortKey("name");
                      setSortDir("asc");
                    }}
                  >
                    Reset filtros
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-zinc-50">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 cursor-pointer select-none"
                      onClick={() => toggleSort("name")}
                      title="Ordenar por nombre"
                    >
                      <span className="inline-flex items-center gap-2">
                        Nombre{" "}
                        {sortKey === "name" && (sortDir === "asc" ? "↑" : "↓")}
                      </span>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 cursor-pointer select-none"
                      onClick={() => toggleSort("area")}
                      title="Ordenar por área"
                    >
                      <span className="inline-flex items-center gap-2">
                        Área{" "}
                        {sortKey === "area" && (sortDir === "asc" ? "↑" : "↓")}
                      </span>
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 cursor-pointer select-none"
                      onClick={() => toggleSort("isActive")}
                      title="Ordenar por estado"
                    >
                      <span className="inline-flex items-center gap-2">
                        Estado{" "}
                        {sortKey === "isActive" &&
                          (sortDir === "asc" ? "↑" : "↓")}
                      </span>
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

                  {!loadingList &&
                    filteredSorted.map((t) => {
                      const isEditing = editingId === t.id;

                      return (
                        <tr key={t.id} className="hover:bg-zinc-50/60">
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                autoFocus
                              />
                            ) : (
                              <div className="text-sm font-semibold text-zinc-900">
                                {t.name}
                              </div>
                            )}
                          </td>

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

                          <td className="px-4 py-3">
                            <StatusPill active={t.isActive} />
                          </td>

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
          )}

          <div className="border-t border-zinc-100 px-5 py-4 text-sm text-zinc-500">
            Tip: mantené áreas cortas (Cocina / Barra / Depósito) para filtrar
            mentalmente rápido.
          </div>
        </div>
      </div>
    </AdminProtected>
  );
}
