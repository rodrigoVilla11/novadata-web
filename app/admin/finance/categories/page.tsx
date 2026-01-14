"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  FinanceCategoryType,
  useCreateFinanceCategoryMutation,
  useGetFinanceCategoriesQuery,
  useUpdateFinanceCategoryMutation,
} from "@/redux/services/financeApi";
import {
  Plus,
  RefreshCcw,
  Search,
  Copy,
  Pencil,
  Power,
  CornerDownRight,
  Layers,
  X,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

/* ====================== */
/* Helpers */
/* ====================== */

const TYPE_OPTIONS: Array<{ label: string; value: FinanceCategoryType }> = [
  { label: "Ingreso", value: "INCOME" },
  { label: "Egreso", value: "EXPENSE" },
  { label: "Ambos", value: "BOTH" },
];

type ActiveFilter = "active" | "inactive" | "all";

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function typeLabel(t: FinanceCategoryType) {
  if (t === "INCOME") return "INGRESO";
  if (t === "EXPENSE") return "EGRESO";
  return "AMBOS";
}

function typePillClass(t: FinanceCategoryType) {
  if (t === "INCOME")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (t === "EXPENSE") return "border-red-200 bg-red-50 text-red-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function safeLower(s: any) {
  return String(s ?? "").toLowerCase();
}

function useDebouncedValue<T>(value: T, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/* ====================== */
/* Drawer (no deps) */
/* ====================== */

function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    setTimeout(() => panelRef.current?.focus(), 0);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-70">
      <button
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-hidden rounded-t-3xl border-t border-zinc-200 bg-white shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-10 rounded-full bg-zinc-200" />
            <h3 className="text-sm font-semibold text-zinc-900">
              {title || "Panel"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            <X className="h-4 w-4" />
            Cerrar
          </button>
        </div>

        <div className="max-h-[calc(88vh-112px)] overflow-auto p-4">
          {children}
        </div>

        {footer ? (
          <div className="border-t border-zinc-100 bg-white p-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}

/* ====================== */
/* Types */
/* ====================== */

type FinanceCategoryRow = {
  id: string;
  name: string;
  type: FinanceCategoryType;
  parentId: string | null;
  order: number;
  isActive?: boolean;
};

type Mode = "create" | "edit";

type FormState = {
  mode: Mode;
  open: boolean;
  id?: string;
  name: string;
  type: FinanceCategoryType;
  parentId: string | "";
  order: string; // input
};

function emptyForm(): FormState {
  return {
    mode: "create",
    open: false,
    name: "",
    type: "EXPENSE",
    parentId: "",
    order: "0",
  };
}

/* ====================== */
/* Page */
/* ====================== */

export default function FinanceCategoriesPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<FinanceCategoryType | "">("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({}); // parentId -> collapsed
  const [filtersOpen, setFiltersOpen] = useState(false);

  const qDebounced = useDebouncedValue(q, 250);

  // IMPORTANT: para que "Todas" funcione aunque el backend hacía default true,
  // mandamos explícito "all"
  const activeQueryValue = useMemo(() => {
    if (activeFilter === "all") return "all" as any;
    if (activeFilter === "inactive") return false as any;
    return true as any;
  }, [activeFilter]);

  const { data, isLoading, isFetching, error, refetch } =
    useGetFinanceCategoriesQuery({
      q: qDebounced.trim() || undefined,
      type: (type || undefined) as any,
      active: activeQueryValue,
    });

  const categories = (data || []) as FinanceCategoryRow[];

  const [createCategory, createState] = useCreateFinanceCategoryMutation();
  const [updateCategory, updateState] = useUpdateFinanceCategoryMutation();

  const busy = createState.isLoading || updateState.isLoading;

  const [toast, setToast] = useState<{
    type: "ok" | "err";
    msg: string;
  } | null>(null);

  function showOk(msg: string) {
    setToast({ type: "ok", msg });
    window.setTimeout(() => setToast(null), 2200);
  }
  function showErr(msg: string) {
    setToast({ type: "err", msg });
    window.setTimeout(() => setToast(null), 3200);
  }

  /* ====================== */
  /* Tree */
  /* ====================== */

  const parents = useMemo(
    () => categories.filter((c) => c.parentId === null),
    [categories]
  );

  const childrenByParent = useMemo(() => {
    const map = new Map<string, FinanceCategoryRow[]>();
    for (const c of categories) {
      if (!c.parentId) continue;
      const arr = map.get(c.parentId) || [];
      arr.push(c);
      map.set(c.parentId, arr);
    }
    for (const arr of map.values()) {
      arr.sort(
        (a, b) =>
          (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)
      );
    }
    return map;
  }, [categories]);

  const stats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter(
      (c) => (c.isActive ?? true) === true
    ).length;
    const inactive = total - active;
    const parentsCount = parents.length;
    const childrenCount = total - parentsCount;
    return { total, active, inactive, parentsCount, childrenCount };
  }, [categories, parents.length]);

  const filteredTree = useMemo(() => {
    const qq = qDebounced.trim().toLowerCase();
    const typeFilter = type || null;

    const sortedParents = parents
      .slice()
      .sort(
        (a, b) =>
          (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)
      );

    return sortedParents
      .map((p) => {
        const kidsAll = childrenByParent.get(p.id) || [];
        const kids = kidsAll.filter((k) => {
          if (typeFilter && k.type !== typeFilter) return false;
          if (!qq) return true;
          return (
            safeLower(k.name).includes(qq) || safeLower(p.name).includes(qq)
          );
        });

        const parentMatches =
          (!typeFilter || p.type === typeFilter) &&
          (!qq || safeLower(p.name).includes(qq));

        if (!parentMatches && kids.length === 0) return null;
        return { parent: p, children: kids };
      })
      .filter(Boolean) as Array<{
      parent: FinanceCategoryRow;
      children: FinanceCategoryRow[];
    }>;
  }, [parents, childrenByParent, qDebounced, type]);

  const hasIsActive = categories.some((c) => typeof c.isActive === "boolean");

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (q.trim()) n++;
    if (type) n++;
    if (activeFilter !== "active") n++;
    return n;
  }, [q, type, activeFilter]);

  /* ====================== */
  /* Form */
  /* ====================== */

  const [form, setForm] = useState<FormState>(() => emptyForm());

  function openCreate(parent?: FinanceCategoryRow) {
    setForm({
      mode: "create",
      open: true,
      name: "",
      type: parent?.type ?? "EXPENSE",
      parentId: parent?.id ?? "",
      order: "0",
    });
  }

  function openEdit(row: FinanceCategoryRow) {
    setForm({
      mode: "edit",
      open: true,
      id: row.id,
      name: row.name,
      type: row.type,
      parentId: row.parentId ?? "",
      order: String(row.order ?? 0),
    });
  }

  function closeForm() {
    setForm((p) => ({ ...p, open: false }));
  }

  const canSubmit = form.name.trim().length > 0;

  async function submitForm() {
    try {
      const orderNum = Math.max(0, Number(form.order || 0) || 0);
      const payload = {
        name: form.name.trim(),
        type: form.type,
        parentId: form.parentId || null,
        order: orderNum,
      };

      if (form.mode === "create") {
        await createCategory(payload as any).unwrap();
        showOk("Categoría creada ✔");
      } else {
        await updateCategory({ id: form.id!, ...payload } as any).unwrap();
        showOk("Categoría actualizada ✔");
      }

      closeForm();
      refetch();
    } catch (e: any) {
      showErr(String(e?.data?.message || e?.message || "Error"));
    }
  }

  async function toggleActive(row: FinanceCategoryRow) {
    try {
      const next = !(row.isActive ?? true);

      if (!next) {
        const ok = window.confirm(
          `¿Desactivar "${row.name}"?\n\nNo se borra, solo se oculta.`
        );
        if (!ok) return;
      }

      await updateCategory({ id: row.id, isActive: next } as any).unwrap();
      showOk(next ? "Activada ✔" : "Desactivada ✔");
      refetch();
    } catch {
      showErr("Error cambiando estado");
    }
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      showOk("ID copiado ✔");
    } catch {
      showErr("No se pudo copiar");
    }
  }

  function toggleCollapse(parentId: string) {
    setCollapsed((prev) => ({ ...prev, [parentId]: !prev[parentId] }));
  }

  /* ====================== */
  /* UI blocks */
  /* ====================== */

  function FiltersContent() {
    return (
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Field label="Buscar">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre…"
            />
          </div>
        </Field>

        <Field label="Tipo">
          <Select value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="">Todos</option>
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Estado">
          <Select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          >
            <option value="active">Activas</option>
            <option value="inactive">Inactivas</option>
            <option value="all">Todas</option>
          </Select>
        </Field>
      </div>
    );
  }

  return (
    <AdminProtected>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-zinc-900 md:text-2xl">
                Finance · Categorías
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Jerarquía de ingresos y egresos (padre → hijos).
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border px-3 py-1 text-xs font-semibold text-zinc-700">
                  Total: {stats.total}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Activas: {stats.active}
                </span>
                <span className="rounded-full border px-3 py-1 text-xs font-semibold text-zinc-700">
                  Inactivas: {stats.inactive}
                </span>
                <span className="rounded-full border px-3 py-1 text-xs font-semibold text-zinc-700">
                  Padres: {stats.parentsCount}
                </span>
                <span className="rounded-full border px-3 py-1 text-xs font-semibold text-zinc-700">
                  Hijos: {stats.childrenCount}
                </span>
              </div>
            </div>

            {/* Desktop actions */}
            <div className="hidden gap-2 md:flex">
              <Button
                variant="secondary"
                onClick={refetch}
                loading={isFetching}
                disabled={isLoading}
                title="Refrescar"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
              <Button onClick={() => openCreate()} title="Nueva categoría">
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva{" "}
                </span>
              </Button>
            </div>

            {/* Mobile actions */}
            <div className="flex gap-2 md:hidden">
              <Button
                variant="secondary"
                onClick={() => setFiltersOpen(true)}
                className="flex-1"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFiltersCount ? (
                  <span className="ml-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-bold text-white">
                    {activeFiltersCount}
                  </span>
                ) : null}
              </Button>
              <Button onClick={() => openCreate()} className="flex-1">
                <Plus className="h-4 w-4" />
                Nueva
              </Button>
            </div>
          </div>

          {/* Toast */}
          {toast && (
            <div
              className={cn(
                "mt-4 rounded-xl border px-3 py-2 text-sm flex items-center gap-2",
                toast.type === "ok"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              )}
            >
              {toast.type === "ok" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              {toast.msg}
            </div>
          )}
        </div>

        {/* Desktop Filters */}
        <div className="hidden md:block">
          <Card>
            <CardBody>
              <FiltersContent />
              <div className="mt-3 text-xs text-zinc-500">
                Tip: Buscar filtra con debounce (250ms).
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Mobile Filters Drawer */}
        <Drawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Filtros"
          footer={
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                disabled={isLoading || isFetching}
                onClick={() => {
                  setQ("");
                  setType("");
                  setActiveFilter("active");
                  setFiltersOpen(false);
                }}
              >
                Limpiar
              </button>
              <button
                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
                onClick={() => setFiltersOpen(false)}
              >
                Aplicar
              </button>
            </div>
          }
        >
          <FiltersContent />
          <div className="mt-3 text-xs text-zinc-500">
            Tip: Buscar filtra con debounce (250ms).
          </div>
        </Drawer>

        {/* Tree */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="p-4 text-sm text-zinc-500">Cargando…</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-600">
              Error cargando categorías
            </div>
          ) : filteredTree.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">Sin resultados.</div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-50 text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Categoría</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Orden</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-100">
                    {filteredTree.map(({ parent, children }) => {
                      const pActive = parent.isActive ?? true;
                      const isCollapsed = !!collapsed[parent.id];

                      return (
                        <React.Fragment key={parent.id}>
                          {/* Parent */}
                          <tr className={!pActive ? "opacity-60" : ""}>
                            <td className="px-4 py-3 font-semibold">
                              <button
                                onClick={() => toggleCollapse(parent.id)}
                                className="group inline-flex items-center gap-2"
                                title={isCollapsed ? "Expandir" : "Colapsar"}
                              >
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 group-hover:bg-zinc-50">
                                  {isCollapsed ? (
                                    <ChevronRight className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </span>
                                <span className="inline-flex items-center gap-2">
                                  <Layers className="h-4 w-4 text-zinc-500" />
                                  {parent.name}
                                </span>
                                <span className="ml-2 text-xs font-semibold text-zinc-400">
                                  ({children.length})
                                </span>
                              </button>
                            </td>

                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-xs font-semibold",
                                  typePillClass(parent.type)
                                )}
                              >
                                {typeLabel(parent.type)}
                              </span>
                            </td>

                            <td className="px-4 py-3">{parent.order ?? 0}</td>

                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="secondary"
                                  onClick={() => copyId(parent.id)}
                                  title="Copiar ID"
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => openCreate(parent)}
                                  title="Crear subcategoría"
                                >
                                  <Plus className="h-4 w-4" />
                                  Hijo
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => openEdit(parent)}
                                  title="Editar"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {hasIsActive && (
                                  <Button
                                    variant={pActive ? "danger" : "secondary"}
                                    onClick={() => toggleActive(parent)}
                                    title={pActive ? "Desactivar" : "Activar"}
                                  >
                                    <Power className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Children */}
                          {!isCollapsed &&
                            children.map((ch) => {
                              const cActive = ch.isActive ?? true;

                              return (
                                <tr
                                  key={ch.id}
                                  className={!cActive ? "opacity-60" : ""}
                                >
                                  <td className="px-4 py-3 pl-16">
                                    <div className="flex items-center gap-2">
                                      <CornerDownRight className="h-4 w-4 text-zinc-400" />
                                      {ch.name}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span
                                      className={cn(
                                        "rounded-full border px-2.5 py-1 text-xs font-semibold",
                                        typePillClass(ch.type)
                                      )}
                                    >
                                      {typeLabel(ch.type)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">{ch.order ?? 0}</td>
                                  <td className="px-4 py-3 text-right">
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="secondary"
                                        onClick={() => copyId(ch.id)}
                                        title="Copiar ID"
                                      >
                                        <Copy className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="secondary"
                                        onClick={() => openEdit(ch)}
                                        title="Editar"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      {hasIsActive && (
                                        <Button
                                          variant={
                                            cActive ? "danger" : "secondary"
                                          }
                                          onClick={() => toggleActive(ch)}
                                          title={
                                            cActive ? "Desactivar" : "Activar"
                                          }
                                        >
                                          <Power className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile: cards */}
              <div className="md:hidden divide-y divide-zinc-100">
                {filteredTree.map(({ parent, children }) => {
                  const pActive = parent.isActive ?? true;
                  const isCollapsed = !!collapsed[parent.id];

                  return (
                    <div
                      key={parent.id}
                      className={cn("p-4", !pActive && "opacity-70")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <button
                            onClick={() => toggleCollapse(parent.id)}
                            className="flex w-full items-center gap-2 text-left"
                          >
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">
                              <Layers className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-zinc-900">
                                {parent.name}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-2">
                                <span
                                  className={cn(
                                    "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                                    typePillClass(parent.type)
                                  )}
                                >
                                  {typeLabel(parent.type)}
                                </span>
                                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                                  Orden: {parent.order ?? 0}
                                </span>
                                <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                                  Hijos: {children.length}
                                </span>
                              </div>
                            </div>

                            <div className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-600">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </div>
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                          onClick={() => copyId(parent.id)}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Copy className="h-4 w-4" /> ID
                          </span>
                        </button>
                        <button
                          className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                          onClick={() => openCreate(parent)}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Plus className="h-4 w-4" /> Hijo
                          </span>
                        </button>
                        <button
                          className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                          onClick={() => openEdit(parent)}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Pencil className="h-4 w-4" /> Editar
                          </span>
                        </button>
                        {hasIsActive && (
                          <button
                            className={cn(
                              "rounded-2xl border px-3 py-2 text-xs font-semibold",
                              pActive
                                ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                            )}
                            onClick={() => toggleActive(parent)}
                            disabled={busy}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Power className="h-4 w-4" />{" "}
                              {pActive ? "Desactivar" : "Activar"}
                            </span>
                          </button>
                        )}
                      </div>

                      {!isCollapsed && children.length > 0 ? (
                        <div className="mt-4 space-y-2">
                          {children.map((ch) => {
                            const cActive = ch.isActive ?? true;
                            return (
                              <div
                                key={ch.id}
                                className={cn(
                                  "rounded-2xl border border-zinc-200 bg-white p-3",
                                  !cActive && "opacity-70"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <CornerDownRight className="h-4 w-4 text-zinc-400" />
                                      <div className="truncate text-sm font-semibold text-zinc-900">
                                        {ch.name}
                                      </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                      <span
                                        className={cn(
                                          "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                                          typePillClass(ch.type)
                                        )}
                                      >
                                        {typeLabel(ch.type)}
                                      </span>
                                      <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700">
                                        Orden: {ch.order ?? 0}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="shrink-0 flex gap-2">
                                    <button
                                      className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                                      onClick={() => copyId(ch.id)}
                                    >
                                      <Copy className="h-4 w-4" />
                                    </button>
                                    <button
                                      className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                                      onClick={() => openEdit(ch)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    {hasIsActive && (
                                      <button
                                        className={cn(
                                          "rounded-2xl border px-3 py-2 text-xs font-semibold",
                                          cActive
                                            ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                            : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"
                                        )}
                                        onClick={() => toggleActive(ch)}
                                        disabled={busy}
                                      >
                                        <Power className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Drawer: Create/Edit */}
        <Drawer
          open={form.open}
          onClose={closeForm}
          title={
            form.mode === "create" ? "Nueva categoría" : "Editar categoría"
          }
          footer={
            <div className="grid grid-cols-2 gap-2">
              <button
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:opacity-60"
                onClick={closeForm}
                disabled={busy}
              >
                Cancelar
              </button>
              <button
                className="rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60"
                onClick={submitForm}
                disabled={!canSubmit || busy}
              >
                {busy ? "Guardando…" : "Guardar"}
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <Field label="Nombre">
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Ej: Ventas, Proveedores…"
              />
            </Field>

            <Field label="Tipo">
              <Select
                value={form.type}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    type: e.target.value as FinanceCategoryType,
                  }))
                }
              >
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Padre">
              <Select
                value={form.parentId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, parentId: e.target.value }))
                }
              >
                <option value="">Sin padre</option>
                {parents
                  .filter((p) => form.mode !== "edit" || p.id !== form.id) // no permitir self-parent
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </Select>
            </Field>

            <Field label="Orden">
              <Input
                type="number"
                min={0}
                value={form.order}
                onChange={(e) =>
                  setForm((p) => ({ ...p, order: e.target.value }))
                }
                placeholder="0"
              />
            </Field>

            <div className="md:col-span-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600">
              Tip: el <b>orden</b> se usa para ordenar dentro del mismo padre.
              Si queda igual, se ordena por nombre.
            </div>
          </div>
        </Drawer>

        {/* Mobile sticky bar */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-3xl items-center gap-2">
            <button
              className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-sm hover:bg-zinc-50 disabled:opacity-60"
              disabled={isLoading}
              onClick={() => refetch()}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <RefreshCcw
                  className={cn("h-4 w-4", isFetching && "animate-spin")}
                />
                Actualizar
              </span>
            </button>

            <button
              className="flex-1 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-60"
              onClick={() => openCreate()}
              disabled={busy}
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />
                Nueva
              </span>
            </button>
          </div>
        </div>
        <div className="h-16 md:hidden" />
      </div>
    </AdminProtected>
  );
}
