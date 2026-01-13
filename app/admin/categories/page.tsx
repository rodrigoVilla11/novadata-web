"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import {
  RefreshCcw,
  Search,
  Plus,
  Save,
  Power,
  CheckCircle2,
  AlertTriangle,
  Tags,
  Image as ImageIcon,
  ChevronDown,
  RotateCcw,
  Eye,
  EyeOff,
  BadgeCheck,
  BadgeX,
  X,
} from "lucide-react";

/* ============================================================================
 * Types
 * ========================================================================== */

type Category = {
  id: string;
  name: string;
  branchId: string;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type CategoryFormDraft = {
  name: string;
  description: string;
  imageUrl: string;
  tagsRaw: string;
  sortOrder: string;
  isActive: boolean;
};

type DrawerMode = "create" | "edit";

/* ============================================================================
 * Helpers
 * ========================================================================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toNum(raw: string) {
  if (raw == null || raw === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function parseTags(raw: string) {
  return raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x.toLowerCase());
}

function joinTags(tags: string[]) {
  return (tags || []).join(", ");
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border",
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-zinc-100 text-zinc-600 border-zinc-200"
      )}
    >
      {active ? (
        <BadgeCheck className="h-3.5 w-3.5" />
      ) : (
        <BadgeX className="h-3.5 w-3.5" />
      )}
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

function Drawer({
  open,
  title,
  subtitle,
  onClose,
  footer,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-full sm:w-130 bg-white shadow-2xl transition-transform",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-zinc-200 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-zinc-900">
                  {title}
                </div>
                {subtitle ? (
                  <div className="mt-0.5 text-sm text-zinc-500">{subtitle}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-zinc-200 bg-white p-2 text-zinc-700 hover:bg-zinc-50"
                aria-label="Cerrar"
                title="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-5">{children}</div>

          {footer ? (
            <div className="border-t border-zinc-200 bg-white p-4">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
 * Page
 * ========================================================================== */

export default function AdminCategoriesPage() {
  const { getAccessToken } = useAuth();

  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [filtersOpenMobile, setFiltersOpenMobile] = useState(false);

  // drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);

  const emptyDraft: CategoryFormDraft = {
    name: "",
    description: "",
    imageUrl: "",
    tagsRaw: "",
    sortOrder: "0",
    isActive: true,
  };

  const [draft, setDraft] = useState<CategoryFormDraft>(emptyDraft);

  const filtered = useMemo(() => {
    let base = items;
    if (onlyActive) base = base.filter((c) => c.isActive);

    const qq = q.trim().toLowerCase();
    if (!qq) return base;

    return base.filter((c) => {
      const hay =
        (c.name || "").toLowerCase().includes(qq) ||
        (c.description || "").toLowerCase().includes(qq) ||
        (c.tags || []).some((t) => (t || "").toLowerCase().includes(qq));
      return hay;
    });
  }, [items, q, onlyActive]);

  const totals = useMemo(() => {
    const total = items.length;
    const active = items.filter((x) => x.isActive).length;
    return { total, active, inactive: total - active };
  }, [items]);

  const hasFilters = useMemo(() => !!q.trim() || onlyActive, [q, onlyActive]);

  async function loadAll() {
    setErr(null);
    setOk(null);
    setLoading(true);

    try {
      const data = await apiFetchAuthed<Category[]>(
        getAccessToken,
        `/categories`
      );
      setItems(data);

      setOk("Datos actualizados ✔");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message || "Error cargando categorías");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreateDrawer() {
    setDrawerMode("create");
    setEditingId(null);
    setDraft(emptyDraft);
    setErr(null);
    setOk(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(c: Category) {
    setDrawerMode("edit");
    setEditingId(c.id);
    setDraft({
      name: c.name ?? "",
      description: c.description ?? "",
      imageUrl: c.imageUrl ?? "",
      tagsRaw: joinTags(c.tags ?? []),
      sortOrder: String(c.sortOrder ?? 0),
      isActive: !!c.isActive,
    });
    setErr(null);
    setOk(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  async function submitDrawer() {
    setErr(null);
    setOk(null);

    const payload = {
      name: (draft.name || "").trim(),
      description: (draft.description || "").trim() || null,
      imageUrl: (draft.imageUrl || "").trim() || null,
      tags: parseTags(draft.tagsRaw || ""),
      sortOrder: toNum(draft.sortOrder || "0"),
    };

    if (!payload.name) {
      setErr("El nombre es obligatorio.");
      return;
    }

    setBusy(true);
    try {
      if (drawerMode === "create") {
        await apiFetchAuthed(getAccessToken, "/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setOk("Categoría creada ✔");
      } else {
        if (!editingId) throw new Error("Missing editingId");
        await apiFetchAuthed(getAccessToken, `/categories/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setOk("Guardado ✔");
      }

      setTimeout(() => setOk(null), 1200);
      await loadAll();
      setDrawerOpen(false);
    } catch (e: any) {
      setErr(e?.message || "Error guardando categoría");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(c: Category) {
    const next = !c.isActive;

    if (
      !window.confirm(
        next
          ? `¿Reactivar categoría "${c.name}"?`
          : `¿Desactivar categoría "${c.name}"?\n\nNo se podrá usar para productos si filtrás solo activas.`
      )
    ) {
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      await apiFetchAuthed(getAccessToken, `/categories/${c.id}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Error actualizando estado");
    } finally {
      setBusy(false);
    }
  }

  function clearFilters() {
    setQ("");
    setOnlyActive(false);
  }

  return (
    <AdminProtected allow={["ADMIN", "MANAGER"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Categorías
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Creá y mantené categorías para organizar Productos.
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1">
                  Totales: <b>{totals.total}</b>
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
                  Activas: <b>{totals.active}</b>
                </span>
                <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-zinc-700">
                  Inactivas: <b>{totals.inactive}</b>
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button variant="secondary" onClick={loadAll} loading={loading}>
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </span>
              </Button>

              <Button onClick={openCreateDrawer} disabled={busy}>
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva categoría
                </span>
              </Button>
            </div>
          </div>
        </div>

        {(err || ok) && (
          <div className="grid gap-2">
            {err && <Notice tone="error">{err}</Notice>}
            {!err && ok && <Notice tone="ok">{ok}</Notice>}
          </div>
        )}

        {/* Filters (responsive, collapsable in mobile) */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-zinc-700">
                Mostrando <b>{filtered.length}</b> de <b>{items.length}</b>
              </div>

              <button
                type="button"
                onClick={() => setFiltersOpenMobile((v) => !v)}
                className="sm:hidden inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
                aria-expanded={filtersOpenMobile}
                aria-controls="cats-filters"
                title="Mostrar/ocultar filtros"
              >
                Filtros
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    filtersOpenMobile ? "rotate-180" : "rotate-0"
                  )}
                />
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOnlyActive((v) => !v)}
                className={cn(
                  "h-10 flex-1 sm:flex-none rounded-2xl border px-3 text-sm font-semibold inline-flex items-center justify-center gap-2 transition",
                  onlyActive
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                )}
              >
                {onlyActive ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
                {onlyActive ? "Solo activas" : "Todas"}
              </button>

              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasFilters}
                className={cn(
                  "h-10 flex-1 sm:flex-none rounded-2xl border px-3 text-sm font-semibold inline-flex items-center justify-center gap-2 transition",
                  hasFilters
                    ? "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                    : "border-zinc-200 bg-zinc-50 text-zinc-400 cursor-not-allowed"
                )}
              >
                <RotateCcw className="h-4 w-4" />
                Limpiar
              </button>
            </div>
          </div>

          <div
            id="cats-filters"
            className={cn(
              "mt-3",
              "sm:block",
              filtersOpenMobile ? "block" : "hidden"
            )}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, descripción o tags…"
                className="pl-9 pr-10"
                inputMode="search"
              />
              {!!q.trim() && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl border border-zinc-200 bg-white p-1.5 text-zinc-700 hover:bg-zinc-50"
                  aria-label="Limpiar búsqueda"
                  title="Limpiar"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Categoría
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Tags
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Orden
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-900">{c.name}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {c.description ? c.description : "Sin descripción"}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500 inline-flex items-center gap-2">
                      <ImageIcon className="h-3.5 w-3.5" />
                      {c.imageUrl ? (
                        <span className="truncate max-w-105">{c.imageUrl}</span>
                      ) : (
                        "Sin imagen"
                      )}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(c.tags || []).slice(0, 6).map((t) => (
                        <span
                          key={t}
                          className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-700"
                        >
                          {t}
                        </span>
                      ))}
                      {(c.tags || []).length > 6 ? (
                        <span className="text-[11px] text-zinc-400">
                          +{(c.tags || []).length - 6}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-700">
                      #{c.sortOrder}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <StatusPill active={c.isActive} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => openEditDrawer(c)}
                        disabled={busy}
                      >
                        <Save className="h-4 w-4" />
                        Editar
                      </Button>

                      <Button
                        variant={c.isActive ? "danger" : "secondary"}
                        onClick={() => toggleActive(c)}
                        disabled={busy}
                      >
                        <Power className="h-4 w-4" />
                        {c.isActive ? "Desactivar" : "Reactivar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-sm text-zinc-500">
                    No hay categorías para mostrar.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-sm text-zinc-500">
                    Cargando…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Drawer: Create/Edit */}
        <Drawer
          open={drawerOpen}
          title={
            drawerMode === "create" ? "Nueva categoría" : "Editar categoría"
          }
          subtitle={
            drawerMode === "create"
              ? "Completá los datos y guardá."
              : "Actualizá los datos y guardá."
          }
          onClose={closeDrawer}
          footer={
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeDrawer} disabled={busy}>
                Cancelar
              </Button>
              <Button
                onClick={submitDrawer}
                loading={busy}
                disabled={!draft.name.trim()}
              >
                {drawerMode === "create" ? (
                  <>
                    <Plus className="h-4 w-4" />
                    Crear
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Guardar cambios
                  </>
                )}
              </Button>
            </div>
          }
        >
          <div className="grid gap-4">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              Tip: Tags coma-separado. SortOrder define el orden en el
              menú/tienda.
            </div>

            <Field label="Nombre">
              <Input
                value={draft.name}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Ej: Combos"
                disabled={busy}
              />
            </Field>

            <Field label="Descripción">
              <Input
                value={draft.description}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Opcional"
                disabled={busy}
              />
            </Field>

            <Field label="Image URL">
              <div className="relative">
                <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={draft.imageUrl}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, imageUrl: e.target.value }))
                  }
                  placeholder="https://..."
                  className="pl-9"
                  disabled={busy}
                />
              </div>
              {draft.imageUrl.trim() ? (
                <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-3 text-xs text-zinc-600">
                  Vista previa:{" "}
                  <span className="break-all font-semibold text-zinc-800">
                    {draft.imageUrl.trim()}
                  </span>
                </div>
              ) : null}
            </Field>

            <Field label="Tags">
              <div className="relative">
                <Tags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={draft.tagsRaw}
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, tagsRaw: e.target.value }))
                  }
                  placeholder="sushi, promo, combos"
                  className="pl-9"
                  disabled={busy}
                />
              </div>

              {parseTags(draft.tagsRaw).length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {parseTags(draft.tagsRaw)
                    .slice(0, 10)
                    .map((t) => (
                      <span
                        key={t}
                        className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] text-zinc-700"
                      >
                        {t}
                      </span>
                    ))}
                  {parseTags(draft.tagsRaw).length > 10 ? (
                    <span className="text-[11px] text-zinc-400">
                      +{parseTags(draft.tagsRaw).length - 10}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </Field>

            <Field label="SortOrder">
              <Input
                value={draft.sortOrder}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, sortOrder: e.target.value }))
                }
                inputMode="numeric"
                disabled={busy}
              />
            </Field>
          </div>
        </Drawer>

        <div className="text-xs text-zinc-500">
          Mostrando <b>{filtered.length}</b> de <b>{items.length}</b>{" "}
          categorías.
        </div>
      </div>
    </AdminProtected>
  );
}
