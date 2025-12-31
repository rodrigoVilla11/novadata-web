"use client";

import React, { useMemo, useState } from "react";
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
  if (t === "INCOME") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (t === "EXPENSE") return "border-red-200 bg-red-50 text-red-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function safeLower(s: any) {
  return String(s ?? "").toLowerCase();
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

  // IMPORTANT: para que "Todas" funcione aunque el backend hacía default true,
  // mandamos explícito "all"
  const activeQueryValue = useMemo(() => {
    if (activeFilter === "all") return ("all" as any);
    if (activeFilter === "inactive") return false as any;
    return true as any;
  }, [activeFilter]);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetFinanceCategoriesQuery({
    q: q.trim() || undefined,
    type: (type || undefined) as any,
    active: activeQueryValue,
  });

  const categories = (data || []) as FinanceCategoryRow[];

  const [createCategory, createState] = useCreateFinanceCategoryMutation();
  const [updateCategory, updateState] = useUpdateFinanceCategoryMutation();

  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);

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
        (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)
      );
    }
    return map;
  }, [categories]);

  const filteredTree = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const typeFilter = type || null;

    const sortedParents = parents
      .slice()
      .sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name)
      );

    return sortedParents
      .map((p) => {
        const kidsAll = childrenByParent.get(p.id) || [];
        const kids = kidsAll.filter((k) => {
          if (typeFilter && k.type !== typeFilter) return false;
          if (!qq) return true;
          return safeLower(k.name).includes(qq) || safeLower(p.name).includes(qq);
        });

        const parentMatches =
          (!typeFilter || p.type === typeFilter) && (!qq || safeLower(p.name).includes(qq));

        if (!parentMatches && kids.length === 0) return null;
        return { parent: p, children: kids };
      })
      .filter(Boolean) as Array<{ parent: FinanceCategoryRow; children: FinanceCategoryRow[] }>;
  }, [parents, childrenByParent, q, type]);

  /* ====================== */
  /* Form */
  /* ====================== */

  const [form, setForm] = useState<FormState>(() => emptyForm());
  const busy = createState.isLoading || updateState.isLoading;

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
        const ok = window.confirm(`¿Desactivar "${row.name}"?\n\nNo se borra, solo se oculta.`);
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

  const hasIsActive = categories.some((c) => typeof c.isActive === "boolean");

  /* ====================== */
  /* Render */
  /* ====================== */

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900">Finance · Categorías</h1>
              <p className="mt-1 text-sm text-zinc-500">
                Jerarquía de ingresos y egresos (padre → hijos).
              </p>
            </div>

            <div className="flex gap-2">
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
                <Plus className="h-4 w-4" />
                Nueva
              </Button>
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={cn(
              "rounded-xl border px-3 py-2 text-sm flex items-center gap-2",
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

        {/* Filters */}
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
          </CardBody>
        </Card>

        {/* Tree table */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          {isLoading ? (
            <div className="p-4 text-sm text-zinc-500">Cargando…</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-600">Error cargando categorías</div>
          ) : filteredTree.length === 0 ? (
            <div className="p-4 text-sm text-zinc-500">Sin resultados.</div>
          ) : (
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

                  return (
                    <React.Fragment key={parent.id}>
                      {/* Parent */}
                      <tr className={!pActive ? "opacity-60" : ""}>
                        <td className="px-4 py-3 font-semibold">
                          <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-zinc-500" />
                            {parent.name}
                          </div>
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
                            <Button variant="secondary" onClick={() => copyId(parent.id)} title="Copiar ID">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => openCreate(parent)}
                              title="Crear subcategoría"
                            >
                              <Plus className="h-4 w-4" />
                              <span className="hidden sm:inline">Hijo</span>
                            </Button>
                            <Button variant="secondary" onClick={() => openEdit(parent)} title="Editar">
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
                      {children.map((ch) => {
                        const cActive = ch.isActive ?? true;
                        return (
                          <tr key={ch.id} className={!cActive ? "opacity-60" : ""}>
                            <td className="px-4 py-3 pl-10">
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
                                <Button variant="secondary" onClick={() => copyId(ch.id)} title="Copiar ID">
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button variant="secondary" onClick={() => openEdit(ch)} title="Editar">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                {hasIsActive && (
                                  <Button
                                    variant={cActive ? "danger" : "secondary"}
                                    onClick={() => toggleActive(ch)}
                                    title={cActive ? "Desactivar" : "Activar"}
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
          )}
        </div>

        {/* Modal */}
        {form.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white border shadow-xl">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="font-semibold">
                  {form.mode === "create" ? "Nueva categoría" : "Editar categoría"}
                </div>
                <button onClick={closeForm} className="rounded-xl border p-2" title="Cerrar">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <Field label="Nombre">
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ej: Ventas, Proveedores…"
                  />
                </Field>

                <Field label="Tipo">
                  <Select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as FinanceCategoryType }))}
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
                    onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
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
                    onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                    placeholder="0"
                  />
                </Field>
              </div>

              <div className="border-t px-4 py-3 flex justify-end gap-2">
                <Button variant="secondary" onClick={closeForm} disabled={busy}>
                  Cancelar
                </Button>
                <Button onClick={submitForm} disabled={!canSubmit || busy} loading={busy}>
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminProtected>
  );
}
