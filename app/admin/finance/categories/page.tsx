"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
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
  order: string;
};

function buildEmptyForm(): FormState {
  return {
    mode: "create",
    open: false,
    name: "",
    type: "EXPENSE",
    parentId: "",
    order: "0",
  };
}

export default function FinanceCategoriesPage() {
  const [q, setQ] = useState("");
  const [type, setType] = useState<FinanceCategoryType | "">("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("active");

  const activeParam = useMemo(() => {
    if (activeFilter === "all") return undefined;
    if (activeFilter === "inactive") return false;
    return true;
  }, [activeFilter]);

  const { data, isLoading, error, refetch } = useGetFinanceCategoriesQuery({
    q: q.trim() || undefined,
    type: (type || undefined) as any,
    active: activeParam as any,
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
    window.setTimeout(() => setToast(null), 2800);
  }

  const byId = useMemo(() => {
    const m = new Map<string, FinanceCategoryRow>();
    for (const c of categories) m.set(c.id, c);
    return m;
  }, [categories]);

  const parents = useMemo(
    () => categories.filter((c) => c.parentId === null),
    [categories]
  );

  const childrenByParent = useMemo(() => {
    const m = new Map<string, FinanceCategoryRow[]>();
    for (const c of categories) {
      if (!c.parentId) continue;
      const arr = m.get(c.parentId) || [];
      arr.push(c);
      m.set(c.parentId, arr);
    }
    // sort hijos por order, luego name
    for (const [pid, arr] of m.entries()) {
      arr.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
      m.set(pid, arr);
    }
    return m;
  }, [categories]);

  const parentOptions = useMemo(() => {
    const arr = parents.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
    return arr;
  }, [parents]);

  // Filtro local “mejorado”: incluye padre/nombre/tipo
  const filteredTree = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const typeFilter = type || null;

    const parentMatches = (p: FinanceCategoryRow) => {
      if (typeFilter && p.type !== typeFilter) return false;
      if (!qq) return true;
      return p.name.toLowerCase().includes(qq) || typeLabel(p.type).toLowerCase().includes(qq);
    };

    const childMatches = (c: FinanceCategoryRow, parentName: string) => {
      if (typeFilter && c.type !== typeFilter) return false;
      if (!qq) return true;
      const hay = `${c.name} ${parentName} ${typeLabel(c.type)}`.toLowerCase();
      return hay.includes(qq);
    };

    const result: Array<{ parent: FinanceCategoryRow; children: FinanceCategoryRow[] }> = [];

    const sortedParents = parents
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));

    for (const p of sortedParents) {
      const kids = childrenByParent.get(p.id) || [];
      const kidsFiltered = kids.filter((k) => childMatches(k, p.name));

      if (parentMatches(p) || kidsFiltered.length > 0) {
        result.push({ parent: p, children: kidsFiltered });
      }
    }

    return result;
  }, [parents, childrenByParent, q, type]);

  // Modal/panel de form
  const [form, setForm] = useState<FormState>(() => buildEmptyForm());

  function openCreate(parent?: FinanceCategoryRow) {
    setForm({
      mode: "create",
      open: true,
      name: "",
      type: parent?.type === "INCOME" ? "INCOME" : parent?.type === "EXPENSE" ? "EXPENSE" : "EXPENSE",
      parentId: parent?.id ?? "",
      order: "0",
    });
  }

  function openEdit(row: FinanceCategoryRow) {
    setForm({
      mode: "edit",
      open: true,
      id: row.id,
      name: row.name ?? "",
      type: row.type ?? "EXPENSE",
      parentId: row.parentId ?? "",
      order: String(row.order ?? 0),
    });
  }

  function closeForm() {
    setForm((p) => ({ ...p, open: false }));
  }

  const formBusy = createState.isLoading || updateState.isLoading;
  const canSubmit = form.name.trim().length > 0;

  async function submitForm() {
    try {
      if (!canSubmit) return;

      const payload = {
        name: form.name.trim(),
        type: form.type,
        parentId: form.parentId ? form.parentId : null,
        order: Number(form.order || 0),
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
      showErr(String(e?.data?.message || e?.message || "Error guardando"));
    }
  }

  async function toggleActive(row: FinanceCategoryRow) {
    try {
      const next = !(row.isActive ?? true);
      await updateCategory({ id: row.id, isActive: next } as any).unwrap();
      showOk(next ? "Activada ✔" : "Desactivada ✔");
      refetch();
    } catch (e: any) {
      showErr(String(e?.data?.message || e?.message || "Error actualizando estado"));
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

  // Si la lista viene sin isActive (según tu backend), evitamos mostrar toggle
  const hasIsActive = useMemo(() => categories.some((c) => typeof c.isActive === "boolean"), [categories]);

  return (
    <AdminProtected>
      <div className="p-4 min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-6xl mx-auto space-y-4">
          <Card>
            <CardHeader
              title="Finance · Categorías"
              subtitle="Jerarquía + creación rápida + edición + activar/desactivar."
              right={
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => refetch()}>
                    <span className="inline-flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4" />
                      Refrescar
                    </span>
                  </Button>
                  <Button onClick={() => openCreate()}>
                    <span className="inline-flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Nueva
                    </span>
                  </Button>
                </div>
              }
            />
            <CardBody>
              {/* toast */}
              {toast && (
                <div
                  className={cn(
                    "mb-3 rounded-xl border px-3 py-2 text-sm flex items-center gap-2",
                    toast.type === "ok"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  )}
                >
                  {toast.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {toast.msg}
                </div>
              )}

              {/* filtros */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Buscar">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      className="pl-9"
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Nombre / padre / tipo…"
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

              {/* LISTA JERÁRQUICA */}
              <div className="mt-4 overflow-auto rounded-2xl border bg-white">
                {isLoading ? (
                  <div className="p-4 text-sm text-gray-600">Cargando…</div>
                ) : error ? (
                  <div className="p-4 text-sm text-red-600">
                    {String((error as any)?.data?.message || "Error")}
                  </div>
                ) : filteredTree.length === 0 ? (
                  <div className="p-4 text-sm text-gray-600">Sin resultados.</div>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3">Categoría</th>
                        <th className="text-left p-3">Tipo</th>
                        <th className="text-left p-3">Orden</th>
                        <th className="text-left p-3">Padre</th>
                        <th className="text-right p-3">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTree.map(({ parent, children }) => {
                        const parentActive = parent.isActive ?? true;
                        return (
                          <React.Fragment key={parent.id}>
                            {/* parent row */}
                            <tr className="border-t bg-white hover:bg-gray-50/60">
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <Layers className="h-4 w-4 text-zinc-500" />
                                  <div className="font-semibold text-zinc-900">{parent.name}</div>
                                  {hasIsActive && !parentActive && (
                                    <span className="ml-2 text-xs rounded-full border px-2 py-0.5 border-zinc-200 bg-zinc-50 text-zinc-600">
                                      Inactiva
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-zinc-500">{parent.id}</div>
                              </td>

                              <td className="p-3">
                                <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", typePillClass(parent.type))}>
                                  {typeLabel(parent.type)}
                                </span>
                              </td>

                              <td className="p-3 text-zinc-700">{parent.order ?? 0}</td>
                              <td className="p-3 text-zinc-500">—</td>

                              <td className="p-3">
                                <div className="flex justify-end gap-2">
                                  <Button variant="secondary" onClick={() => copyId(parent.id)}>
                                    <span className="inline-flex items-center gap-2">
                                      <Copy className="h-4 w-4" /> ID
                                    </span>
                                  </Button>
                                  <Button variant="secondary" onClick={() => openCreate(parent)}>
                                    <span className="inline-flex items-center gap-2">
                                      <Plus className="h-4 w-4" /> Sub
                                    </span>
                                  </Button>
                                  <Button variant="secondary" onClick={() => openEdit(parent)}>
                                    <span className="inline-flex items-center gap-2">
                                      <Pencil className="h-4 w-4" /> Editar
                                    </span>
                                  </Button>
                                  {hasIsActive && (
                                    <Button
                                      variant={parentActive ? "danger" : "secondary"}
                                      onClick={() => toggleActive(parent)}
                                    >
                                      <span className="inline-flex items-center gap-2">
                                        <Power className="h-4 w-4" />
                                        {parentActive ? "Desactivar" : "Activar"}
                                      </span>
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* children */}
                            {children.map((ch) => {
                              const chActive = ch.isActive ?? true;
                              return (
                                <tr key={ch.id} className="border-t hover:bg-gray-50/60">
                                  <td className="p-3">
                                    <div className="flex items-center gap-2 pl-6">
                                      <CornerDownRight className="h-4 w-4 text-zinc-400" />
                                      <div className="font-medium text-zinc-900">{ch.name}</div>
                                      {hasIsActive && !chActive && (
                                        <span className="ml-2 text-xs rounded-full border px-2 py-0.5 border-zinc-200 bg-zinc-50 text-zinc-600">
                                          Inactiva
                                        </span>
                                      )}
                                    </div>
                                    <div className="pl-10 text-xs text-zinc-500">{ch.id}</div>
                                  </td>

                                  <td className="p-3">
                                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", typePillClass(ch.type))}>
                                      {typeLabel(ch.type)}
                                    </span>
                                  </td>

                                  <td className="p-3 text-zinc-700">{ch.order ?? 0}</td>

                                  <td className="p-3 text-zinc-700">
                                    {parent.name} ({typeLabel(parent.type)})
                                  </td>

                                  <td className="p-3">
                                    <div className="flex justify-end gap-2">
                                      <Button variant="secondary" onClick={() => copyId(ch.id)}>
                                        <span className="inline-flex items-center gap-2">
                                          <Copy className="h-4 w-4" /> ID
                                        </span>
                                      </Button>
                                      <Button variant="secondary" onClick={() => openEdit(ch)}>
                                        <span className="inline-flex items-center gap-2">
                                          <Pencil className="h-4 w-4" /> Editar
                                        </span>
                                      </Button>
                                      {hasIsActive && (
                                        <Button
                                          variant={chActive ? "danger" : "secondary"}
                                          onClick={() => toggleActive(ch)}
                                        >
                                          <span className="inline-flex items-center gap-2">
                                            <Power className="h-4 w-4" />
                                            {chActive ? "Desactivar" : "Activar"}
                                          </span>
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

              <p className="mt-3 text-xs text-gray-500">
                Consejo: organizá padres e hijos con “Orden” (0, 10, 20…) para que sea fácil insertar nuevos.
              </p>
            </CardBody>
          </Card>

          {/* MODAL FORM (simple) */}
          {form.open && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl border overflow-hidden">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {form.mode === "create" ? "Nueva categoría" : "Editar categoría"}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {form.mode === "create" ? "Crear y usar en movimientos." : "Actualiza nombre, tipo, padre u orden."}
                    </div>
                  </div>
                  <button
                    onClick={closeForm}
                    className="rounded-xl border border-zinc-200 bg-white px-2 py-2 hover:bg-zinc-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Field label="Nombre">
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Ej: Impuestos"
                      autoFocus
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

                  <Field label="Padre (opcional)">
                    <Select
                      value={form.parentId}
                      onChange={(e) => setForm((p) => ({ ...p, parentId: e.target.value }))}
                    >
                      <option value="">Sin padre</option>
                      {parentOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({typeLabel(p.type)})
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Orden">
                    <Input
                      value={form.order}
                      onChange={(e) => setForm((p) => ({ ...p, order: e.target.value }))}
                      placeholder="0"
                    />
                  </Field>
                </div>

                <div className="border-t px-4 py-3 flex items-center justify-end gap-2">
                  {(createState.isError || updateState.isError) && (
                    <div className="mr-auto text-sm text-red-600">
                      {String(
                        ((createState.error as any)?.data?.message ||
                          (updateState.error as any)?.data?.message ||
                          "Error guardando")
                      )}
                    </div>
                  )}

                  <Button variant="secondary" onClick={closeForm} disabled={formBusy}>
                    Cancelar
                  </Button>
                  <Button onClick={submitForm} disabled={!canSubmit || formBusy} loading={formBusy}>
                    {form.mode === "create" ? "Crear" : "Guardar"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminProtected>
  );
}
