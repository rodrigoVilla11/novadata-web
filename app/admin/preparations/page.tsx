"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  RefreshCcw,
  Search,
  Plus,
  Save,
  XCircle,
  Trash2,
  Calculator,
  Layers,
  Package,
  AlertTriangle,
  CheckCircle2,
  Power,
  Filter,
  Building2,
  X,
} from "lucide-react";

/* =============================================================================
 * Types
 * ========================================================================== */

type Supplier = { id: string; name: string; isActive: boolean };
type Unit = "UNIT" | "KG" | "L";
type Currency = "ARS" | "USD";

type Ingredient = {
  id: string;
  name: string;
  baseUnit: Unit;
  supplierId: string;
  isActive: boolean;
  cost?: { lastCost?: number; currency?: Currency };
  name_for_supplier?: string | null;
};

type PrepItemType = "INGREDIENT" | "PREPARATION";

type PreparationItem = {
  type: PrepItemType;
  ingredientId?: string | null;
  preparationId?: string | null;
  qty: number;
  note?: string | null;
};

type Preparation = {
  id: string;

  // ✅ branch aware
  branchId: string;

  name: string;
  description?: string | null;
  supplierId?: string | null;

  yieldQty: number;
  yieldUnit: Unit;

  wastePct: number;
  extraCost: number;
  currency: Currency;

  isActive: boolean;

  items: Array<{
    type: PrepItemType;
    ingredientId: string | null;
    preparationId: string | null;
    qty: number;
    note?: string | null;
  }>;

  computed: {
    ingredientsCost: number;
    totalCost: number;
    unitCost: number;
    currency: Currency;
    computedAt?: string | null;
  };
};

type MixedOption =
  | {
      kind: "INGREDIENT";
      id: string;
      label: string;
      unit: Unit;
      supplierId: string;
      extra?: string;
    }
  | {
      kind: "PREPARATION";
      id: string;
      label: string;
      unit: Unit;
      supplierId?: string | null;
      extra?: string;
    };

/* =============================================================================
 * Helpers
 * ========================================================================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
function unitLabel(u: Unit) {
  if (u === "UNIT") return "Unidad";
  if (u === "KG") return "Kg";
  if (u === "L") return "Litros";
  return u;
}
function isValidNumberDraft(v: string) {
  return v === "" || /^[0-9]*([.][0-9]*)?$/.test(v);
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function n0(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function fmtMoney(n: number, currency: Currency = "ARS") {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n0(n));
  } catch {
    return `${n0(n).toFixed(2)} ${currency}`;
  }
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

/** Drawer simple (sin dependencias) */
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
      <div
        className={cn(
          "absolute inset-0 bg-black/40 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "absolute right-0 top-0 h-full w-full sm:w-180 bg-white shadow-2xl transition-transform",
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

/* =============================================================================
 * Page
 * ========================================================================== */

export default function AdminPreparationsPage() {
  const { getAccessToken } = useAuth();

  // Data
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [preps, setPreps] = useState<Preparation[]>([]);

  // Page state
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // List filters
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(true);
  const [listSupplierId, setListSupplierId] = useState<string>(""); // "" => todos

  // Drawer state
  const [editorOpen, setEditorOpen] = useState(false);

  // Editor (create / edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [yieldQtyDraft, setYieldQtyDraft] = useState("1");
  const [yieldUnit, setYieldUnit] = useState<Unit>("UNIT");
  const [wastePctDraft, setWastePctDraft] = useState("0");
  const [extraCostDraft, setExtraCostDraft] = useState("0");
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [items, setItems] = useState<PreparationItem[]>([]);

  // Item picker (filtro opcional)
  const [itemSupplierId, setItemSupplierId] = useState<string>("");
  const [itemQuery, setItemQuery] = useState("");
  const [itemPick, setItemPick] = useState<string>(""); // encoded kind:id
  const [itemQtyDraft, setItemQtyDraft] = useState("1");
  const [itemNote, setItemNote] = useState("");

  // Inline actions
  const [recomputingById, setRecomputingById] = useState<
    Record<string, boolean>
  >({});
  const [togglingById, setTogglingById] = useState<Record<string, boolean>>({});

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive !== false),
    [suppliers]
  );

  const listSupplierName = useMemo(() => {
    if (!listSupplierId) return "Todos";
    return suppliers.find((s) => s.id === listSupplierId)?.name ?? "—";
  }, [suppliers, listSupplierId]);

  const itemSupplierName = useMemo(() => {
    if (!itemSupplierId) return "Todos";
    return suppliers.find((s) => s.id === itemSupplierId)?.name ?? "—";
  }, [suppliers, itemSupplierId]);

  // Build options for item select
  const mixedOptions: MixedOption[] = useMemo(() => {
    const q0 = itemQuery.trim().toLowerCase();

    const ingOpts: MixedOption[] = ingredients
      .filter((x) => x.isActive !== false)
      .filter((x) => !itemSupplierId || x.supplierId === itemSupplierId)
      .map((x) => ({
        kind: "INGREDIENT" as const,
        id: x.id,
        label: x.name,
        unit: x.baseUnit,
        supplierId: x.supplierId,
        extra:
          x.cost?.lastCost != null
            ? `${fmtMoney(
                n0(x.cost?.lastCost),
                (x.cost?.currency as any) || "ARS"
              )}/${unitLabel(x.baseUnit)}`
            : undefined,
      }));

    const prepOpts: MixedOption[] = preps
      .filter((p) => p.isActive !== false)
      .filter((p) => p.id !== editingId) // no auto include
      .filter((p) => {
        if (!itemSupplierId) return true;
        if (!p.supplierId) return true; // prep "global"
        return String(p.supplierId) === itemSupplierId;
      })
      .map((p) => ({
        kind: "PREPARATION" as const,
        id: p.id,
        label: p.name,
        unit: p.yieldUnit,
        supplierId: p.supplierId ?? null,
        extra:
          p.computed?.unitCost != null
            ? `${fmtMoney(
                n0(p.computed.unitCost),
                p.computed.currency || p.currency
              )}/${unitLabel(p.yieldUnit)}`
            : undefined,
      }));

    const all = [...ingOpts, ...prepOpts];

    if (!q0) return all.slice(0, 200);

    return all
      .filter((o) => {
        const hay = `${o.label} ${o.kind} ${unitLabel(o.unit)} ${
          o.extra || ""
        }`.toLowerCase();
        return hay.includes(q0);
      })
      .slice(0, 200);
  }, [ingredients, preps, itemSupplierId, itemQuery, editingId]);

  const listFiltered = useMemo(() => {
    const q0 = q.trim().toLowerCase();
    let base = preps;

    // filtro supplier en lista
    if (listSupplierId) {
      base = base.filter((p) => String(p.supplierId || "") === listSupplierId);
    }

    if (onlyActive) base = base.filter((p) => p.isActive !== false);
    if (!q0) return base;

    return base.filter((p) => {
      const hay = `${p.name} ${p.description || ""} ${unitLabel(
        p.yieldUnit
      )}`.toLowerCase();
      return hay.includes(q0);
    });
  }, [preps, q, onlyActive, listSupplierId]);

  const editorTotals = useMemo(() => {
    const ingById = new Map<string, Ingredient>();
    for (const i of ingredients) ingById.set(i.id, i);

    const prepById = new Map<string, Preparation>();
    for (const p of preps) prepById.set(p.id, p);

    let ingredientsCost = 0;

    for (const it of items) {
      const qty = n0(it.qty);
      if (qty <= 0) continue;

      if (it.type === "INGREDIENT") {
        const ing = it.ingredientId ? ingById.get(it.ingredientId) : undefined;
        const unitCost = n0(ing?.cost?.lastCost);
        ingredientsCost += qty * unitCost;
      } else {
        const prep = it.preparationId
          ? prepById.get(it.preparationId)
          : undefined;
        const unitCost = n0(prep?.computed?.unitCost);
        ingredientsCost += qty * unitCost;
      }
    }

    const wastePct = clamp(n0(wastePctDraft), 0, 1);
    const extraCost = Math.max(0, n0(extraCostDraft));
    const yieldQty = Math.max(0.000001, n0(yieldQtyDraft));

    const totalCost = ingredientsCost * (1 + wastePct) + extraCost;
    const unitCost = totalCost / yieldQty;

    return { ingredientsCost, totalCost, unitCost };
  }, [items, ingredients, preps, wastePctDraft, extraCostDraft, yieldQtyDraft]);

  /* =============================================================================
   * Loaders
   * ========================================================================== */

  async function loadSuppliers() {
    const s = await apiFetchAuthed<Supplier[]>(getAccessToken, "/suppliers");
    setSuppliers(s);
  }

  // ✅ ahora cargamos TODOS los ingredientes del branch
  async function loadIngredientsAll() {
    const data = await apiFetchAuthed<Ingredient[]>(
      getAccessToken,
      `/ingredients`
    );
    setIngredients(data);
  }

  async function loadPreparations() {
    const data = await apiFetchAuthed<Preparation[]>(
      getAccessToken,
      `/preparations`
    );
    setPreps(data);
  }

  async function loadAll() {
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      await Promise.all([
        loadSuppliers(),
        loadIngredientsAll(),
        loadPreparations(),
      ]);
      setOk("Datos actualizados ✔");
      setTimeout(() => setOk(null), 1400);
    } catch (e: any) {
      setErr(e?.message || "Error cargando");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =============================================================================
   * Editor helpers
   * ========================================================================== */

  function resetEditorStateOnly() {
    setEditingId(null);
    setName("");
    setDescription("");
    setYieldQtyDraft("1");
    setYieldUnit("UNIT");
    setWastePctDraft("0");
    setExtraCostDraft("0");
    setCurrency("ARS");
    setItems([]);

    setItemQuery("");
    setItemPick("");
    setItemQtyDraft("1");
    setItemNote("");
  }

  function openCreateDrawer() {
    setErr(null);
    setOk(null);
    resetEditorStateOnly();
    setEditorOpen(true);
  }

  function closeEditorDrawer() {
    setEditorOpen(false);
  }

  function startEdit(p: Preparation) {
    setErr(null);
    setOk(null);
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description ?? "");
    setYieldQtyDraft(String(p.yieldQty ?? 1));
    setYieldUnit(p.yieldUnit);
    setWastePctDraft(String(p.wastePct ?? 0));
    setExtraCostDraft(String(p.extraCost ?? 0));
    setCurrency(p.currency ?? "ARS");
    setItems(
      (p.items || []).map((it) => ({
        type: it.type,
        ingredientId: it.ingredientId ?? null,
        preparationId: it.preparationId ?? null,
        qty: n0(it.qty),
        note: it.note ?? null,
      }))
    );
    setEditorOpen(true);
  }

  function addItemFromPick() {
    if (!itemPick) return;
    const [kind, id] = itemPick.split(":") as [PrepItemType, string];
    const qty = n0(itemQtyDraft);
    if (!(qty > 0)) {
      setErr("La cantidad debe ser > 0");
      return;
    }

    const key = `${kind}:${id}`;
    const exists = items.some((it) =>
      it.type === "INGREDIENT"
        ? key === `INGREDIENT:${it.ingredientId}`
        : key === `PREPARATION:${it.preparationId}`
    );
    if (exists) {
      setErr("Ese item ya está agregado. Sumá la qty editando el existente.");
      return;
    }

    const next: PreparationItem =
      kind === "INGREDIENT"
        ? {
            type: "INGREDIENT",
            ingredientId: id,
            preparationId: null,
            qty,
            note: itemNote.trim() ? itemNote.trim() : null,
          }
        : {
            type: "PREPARATION",
            ingredientId: null,
            preparationId: id,
            qty,
            note: itemNote.trim() ? itemNote.trim() : null,
          };

    setItems((prev) => [...prev, next]);
    setItemPick("");
    setItemQtyDraft("1");
    setItemNote("");
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, patch: Partial<PreparationItem>) {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  }

  function getItemLabel(it: PreparationItem) {
    if (it.type === "INGREDIENT") {
      const ing = ingredients.find((x) => x.id === it.ingredientId);
      return ing?.name || `Ingrediente ${it.ingredientId}`;
    }
    const prep = preps.find((x) => x.id === it.preparationId);
    return prep?.name || `Preparación ${it.preparationId}`;
  }

  function getItemUnit(it: PreparationItem): Unit {
    if (it.type === "INGREDIENT") {
      const ing = ingredients.find((x) => x.id === it.ingredientId);
      return ing?.baseUnit || "UNIT";
    }
    const prep = preps.find((x) => x.id === it.preparationId);
    return prep?.yieldUnit || "UNIT";
  }

  /* =============================================================================
   * Actions
   * ========================================================================== */

  async function savePreparation() {
    setErr(null);
    setOk(null);

    const nName = name.trim();
    if (!nName) return setErr("El nombre es requerido");

    const yieldQty = n0(yieldQtyDraft);
    if (!(yieldQty > 0)) return setErr("yieldQty debe ser > 0");

    const wastePct = clamp(n0(wastePctDraft), 0, 1);
    const extraCost = Math.max(0, n0(extraCostDraft));

    if (!items.length) return setErr("Agregá al menos 1 item.");

    setBusy(true);
    try {
      const bodyBase = {
        name: nName,
        description: description.trim() ? description.trim() : null,
        supplierId: null as any, // si querés lo hacemos seleccionable
        yieldQty,
        yieldUnit,
        wastePct,
        extraCost,
        currency,
        items: items.map((it) => ({
          type: it.type,
          ingredientId: it.type === "INGREDIENT" ? it.ingredientId : null,
          preparationId: it.type === "PREPARATION" ? it.preparationId : null,
          qty: n0(it.qty),
          note: it.note ?? null,
        })),
      };

      if (editingId) {
        await apiFetchAuthed(getAccessToken, `/preparations/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyBase),
        });
        setOk("Preparación actualizada ✔");
      } else {
        await apiFetchAuthed(getAccessToken, "/preparations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bodyBase),
        });
        setOk("Preparación creada ✔");
        resetEditorStateOnly();
      }

      setTimeout(() => setOk(null), 1400);
      await loadPreparations();
      setEditorOpen(false);
    } catch (e: any) {
      setErr(e?.message || "Error guardando preparación");
    } finally {
      setBusy(false);
    }
  }

  async function recomputePrep(id: string) {
    setRecomputingById((p) => ({ ...p, [id]: true }));
    setErr(null);
    try {
      await apiFetchAuthed(getAccessToken, `/preparations/${id}/recompute`, {
        method: "POST",
      });
      await loadPreparations();
      setOk("Recalculado ✔");
      setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      setErr(e?.message || "Error recalculando");
    } finally {
      setRecomputingById((p) => ({ ...p, [id]: false }));
    }
  }

  async function toggleActive(p: Preparation) {
    const next = !p.isActive;
    if (
      !window.confirm(
        next
          ? `¿Reactivar "${p.name}"?`
          : `¿Desactivar "${p.name}"?\n\nNo se mostrará en selects si filtrás por activas.`
      )
    )
      return;

    setTogglingById((x) => ({ ...x, [p.id]: true }));
    setErr(null);
    try {
      await apiFetchAuthed(getAccessToken, `/preparations/${p.id}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      await loadPreparations();
    } catch (e: any) {
      setErr(e?.message || "Error cambiando estado");
    } finally {
      setTogglingById((x) => ({ ...x, [p.id]: false }));
    }
  }

  /* =============================================================================
   * Render
   * ========================================================================== */

  return (
    <AdminProtected allow={["ADMIN", "MANAGER"] as any}>
      <div className="space-y-6 text-zinc-500">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Preparaciones
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Recetas / preps: combinan ingredientes y otras preparaciones,
                con costo total y unitario.
              </p>

              <div className="mt-3 flex flex-wrap gap-4 text-sm">
                <span>
                  Total: <b>{preps.length}</b>
                </span>
                <span className="text-emerald-700">
                  Activas:{" "}
                  <b>{preps.filter((x) => x.isActive !== false).length}</b>
                </span>
                <span className="text-zinc-600">
                  Ingredientes: <b>{ingredients.length}</b>
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={loadAll} loading={loading}>
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </span>
              </Button>

              <Button onClick={openCreateDrawer} disabled={busy}>
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva preparación{" "}
                </span>
              </Button>
            </div>
          </div>

          {(err || ok) && (
            <div className="mt-4 grid gap-2">
              {err && <Notice tone="error">{err}</Notice>}
              {!err && ok && <Notice tone="ok">{ok}</Notice>}
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="grid gap-3 md:grid-cols-[220px_1fr_auto] md:items-end">
            <Field label="Proveedor (lista)">
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Select
                  value={listSupplierId}
                  onChange={(e) => setListSupplierId(e.target.value)}
                  className="pl-9"
                >
                  <option value="">Todos</option>
                  {activeSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            </Field>

            <Field label="Buscar preparación">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Nombre, descripción…"
                  className="pl-9"
                />
              </div>
            </Field>

            <div className="flex items-end justify-end gap-2">
              <Button
                variant={onlyActive ? "secondary" : "ghost"}
                onClick={() => setOnlyActive((v) => !v)}
              >
                {onlyActive ? "Solo activas" : "Todas"}
              </Button>
            </div>
          </div>

          <div className="mt-2 text-xs text-zinc-500">
            Lista filtrada por proveedor: <b>{listSupplierName}</b>
          </div>
        </div>

        {/* List (full width now) */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                    Preparación
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                    Rinde
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                    Costo total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                    Unitario
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
                {loading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-sm text-zinc-500"
                    >
                      Cargando…
                    </td>
                  </tr>
                )}

                {!loading &&
                  listFiltered.map((p) => {
                    const rec = recomputingById[p.id];
                    const tog = togglingById[p.id];
                    return (
                      <tr key={p.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-900">
                            {p.name}
                          </div>
                          {p.description ? (
                            <div className="mt-0.5 text-xs text-zinc-500 line-clamp-2">
                              {p.description}
                            </div>
                          ) : null}
                          <div className="mt-1 text-xs text-zinc-500">
                            Items: <b>{p.items?.length ?? 0}</b>
                            {p.supplierId ? (
                              <span className="ml-2">
                                · Prov:{" "}
                                <b>
                                  {suppliers.find((s) => s.id === p.supplierId)
                                    ?.name || "—"}
                                </b>
                              </span>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {n0(p.yieldQty)} {unitLabel(p.yieldUnit)}
                        </td>

                        <td className="px-4 py-3 text-sm">
                          <b>
                            {fmtMoney(
                              n0(p.computed?.totalCost),
                              p.computed?.currency || p.currency
                            )}
                          </b>
                        </td>

                        <td className="px-4 py-3 text-sm text-zinc-700">
                          {fmtMoney(
                            n0(p.computed?.unitCost),
                            p.computed?.currency || p.currency
                          )}
                          /{unitLabel(p.yieldUnit)}
                        </td>

                        <td className="px-4 py-3">
                          <StatusPill active={p.isActive !== false} />
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => startEdit(p)}
                              disabled={busy}
                            >
                              Editar
                            </Button>

                            <Button
                              variant="secondary"
                              onClick={() => recomputePrep(p.id)}
                              loading={rec}
                              disabled={rec || busy}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Calculator className="h-4 w-4" />
                                Recalcular
                              </span>
                            </Button>

                            <Button
                              variant={
                                p.isActive !== false ? "danger" : "secondary"
                              }
                              onClick={() => toggleActive(p)}
                              loading={tog}
                              disabled={tog || busy}
                            >
                              <span className="inline-flex items-center gap-2">
                                <Power className="h-4 w-4" />
                                {p.isActive !== false
                                  ? "Desactivar"
                                  : "Reactivar"}{" "}
                              </span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {!loading && listFiltered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-sm text-zinc-500"
                    >
                      No hay preparaciones para mostrar con estos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-zinc-500">
            Lista: proveedor <b>{listSupplierName}</b> ·{" "}
            {onlyActive ? "solo activas" : "todas"}.
          </div>
        </div>

        {/* Drawer Editor */}
        <Drawer
          open={editorOpen}
          title={editingId ? "Editar preparación" : "Nueva preparación"}
          subtitle="Combiná ingredientes y/o preparaciones. El costo se estima en vivo."
          onClose={() => {
            if (busy) return;
            closeEditorDrawer();
          }}
          footer={
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  if (busy) return;
                  closeEditorDrawer();
                }}
                disabled={busy}
              >
                Cancelar
              </Button>

              {editingId ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (busy) return;
                    resetEditorStateOnly();
                  }}
                  disabled={busy}
                >
                  <XCircle className="h-4 w-4" />
                  Nuevo
                </Button>
              ) : null}

              <Button
                onClick={savePreparation}
                loading={busy}
                disabled={busy || !name.trim()}
              >
                <Save className="h-4 w-4" />
                {editingId ? "Guardar cambios" : "Crear"}
              </Button>
            </div>
          }
        >
          <Card>
            <div className="flex items-start justify-between px-5 pt-5">
              <div>
                <div className="text-base font-semibold text-zinc-900">
                  {editingId ? "Editor" : "Crear"}
                </div>
                <div className="text-sm text-zinc-500">
                  Items pueden ser ingredientes o preparaciones.
                </div>
              </div>

              <span className="inline-flex items-center gap-2 text-xs text-zinc-500">
                <Calculator className="h-4 w-4" />
                Estimación en vivo
              </span>
            </div>

            <CardBody>
              <div className="grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nombre">
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Field>

                  <Field label="Moneda">
                    <Select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as Currency)}
                    >
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </Select>
                  </Field>
                </div>

                <Field label="Descripción (opcional)">
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ej: Arroz para sushi ya mezclado"
                  />
                </Field>

                <div className="grid gap-4 md:grid-cols-4">
                  <Field label="Rinde (qty)">
                    <Input
                      value={yieldQtyDraft}
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) &&
                        setYieldQtyDraft(e.target.value)
                      }
                      inputMode="decimal"
                    />
                  </Field>

                  <Field label="Rinde (unidad)">
                    <Select
                      value={yieldUnit}
                      onChange={(e) => setYieldUnit(e.target.value as Unit)}
                    >
                      <option value="UNIT">Unidad</option>
                      <option value="KG">Kg</option>
                      <option value="L">Litros</option>
                    </Select>
                  </Field>

                  <Field label="Merma (0..1)">
                    <Input
                      value={wastePctDraft}
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) &&
                        setWastePctDraft(e.target.value)
                      }
                      placeholder="0.05"
                      inputMode="decimal"
                    />
                  </Field>

                  <Field label="Extra $">
                    <Input
                      value={extraCostDraft}
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) &&
                        setExtraCostDraft(e.target.value)
                      }
                      inputMode="decimal"
                    />
                  </Field>
                </div>

                {/* Live computed */}
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-600">Costo ingredientes</span>
                      <b className="text-zinc-900">
                        {fmtMoney(editorTotals.ingredientsCost, currency)}
                      </b>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-600">Costo total</span>
                      <b className="text-zinc-900">
                        {fmtMoney(editorTotals.totalCost, currency)}
                      </b>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-600">
                        Costo unitario ({unitLabel(yieldUnit)})
                      </span>
                      <b className="text-zinc-900">
                        {fmtMoney(editorTotals.unitCost, currency)}
                      </b>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="rounded-2xl border border-zinc-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                      <Layers className="h-4 w-4" />
                      Items
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline text-xs text-zinc-500">
                        Proveedor:
                      </span>
                      <div className="relative">
                        <Filter className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <select
                          value={itemSupplierId}
                          onChange={(e) => setItemSupplierId(e.target.value)}
                          className="h-9 rounded-xl border border-zinc-200 bg-white pl-8 pr-3 text-sm"
                          title="Filtrar items por proveedor"
                        >
                          <option value="">Todos</option>
                          {activeSuppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-zinc-500">
                    Mostrando items de: <b>{itemSupplierName}</b>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px]">
                    <Field label="Buscar (ingrediente o preparación)">
                      <Input
                        value={itemQuery}
                        onChange={(e) => setItemQuery(e.target.value)}
                        placeholder="Ej: arroz / salsa / prep…"
                      />
                    </Field>

                    <Field label="Cantidad">
                      <Input
                        value={itemQtyDraft}
                        onChange={(e) =>
                          isValidNumberDraft(e.target.value) &&
                          setItemQtyDraft(e.target.value)
                        }
                        inputMode="decimal"
                      />
                    </Field>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_180px]">
                    <Field label="Seleccionar item">
                      <Select
                        value={itemPick}
                        onChange={(e) => setItemPick(e.target.value)}
                      >
                        <option value="">— Elegí —</option>
                        {mixedOptions.map((o) => (
                          <option
                            key={`${o.kind}:${o.id}`}
                            value={`${o.kind}:${o.id}`}
                          >
                            {o.kind === "INGREDIENT" ? "Ing" : "Prep"} ·{" "}
                            {o.label} · {unitLabel(o.unit)}
                            {o.extra ? ` · ${o.extra}` : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Nota (opcional)">
                      <Input
                        value={itemNote}
                        onChange={(e) => setItemNote(e.target.value)}
                        placeholder="Ej: marca / detalle"
                      />
                    </Field>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      variant="secondary"
                      onClick={addItemFromPick}
                      disabled={!itemPick || busy}
                    >
                      <Plus className="h-4 w-4" />
                      Agregar
                    </Button>
                  </div>

                  {/* Items table */}
                  <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                    <table className="min-w-full">
                      <thead className="bg-zinc-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                            Tipo
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                            Item
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                            Qty
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                            Unidad
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                            Nota
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-500">
                            —
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {items.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-3 py-6 text-sm text-zinc-500"
                            >
                              Sin items todavía. Elegí un item y tocá “Agregar”.
                            </td>
                          </tr>
                        )}

                        {items.map((it, idx) => {
                          const u = getItemUnit(it);
                          return (
                            <tr
                              key={`${it.type}-${
                                it.ingredientId || it.preparationId
                              }-${idx}`}
                            >
                              <td className="px-3 py-2 text-xs">
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-full border px-2 py-1 font-semibold",
                                    it.type === "INGREDIENT"
                                      ? "border-zinc-200 bg-white text-zinc-700"
                                      : "border-indigo-200 bg-indigo-50 text-indigo-700"
                                  )}
                                >
                                  {it.type === "INGREDIENT" ? (
                                    <Package className="h-3.5 w-3.5" />
                                  ) : (
                                    <Layers className="h-3.5 w-3.5" />
                                  )}
                                  {it.type}
                                </span>
                              </td>

                              <td className="px-3 py-2 text-sm font-medium text-zinc-900">
                                {getItemLabel(it)}
                              </td>

                              <td className="px-3 py-2">
                                <input
                                  className="w-24 rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                                  value={String(it.qty ?? 0)}
                                  onChange={(e) => {
                                    if (!isValidNumberDraft(e.target.value))
                                      return;
                                    updateItem(idx, {
                                      qty: n0(e.target.value),
                                    });
                                  }}
                                />
                              </td>

                              <td className="px-3 py-2 text-sm text-zinc-600">
                                {unitLabel(u)}
                              </td>

                              <td className="px-3 py-2">
                                <input
                                  className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
                                  value={it.note ?? ""}
                                  onChange={(e) =>
                                    updateItem(idx, { note: e.target.value })
                                  }
                                  placeholder="—"
                                />
                              </td>

                              <td className="px-3 py-2 text-right">
                                <Button
                                  variant="ghost"
                                  onClick={() => removeItem(idx)}
                                  disabled={busy}
                                  title="Quitar"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-3 text-xs text-zinc-500">
                    Tip: el filtro de proveedor es solo para buscar rápido
                    items. La preparación puede mezclar proveedores.
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </Drawer>
      </div>
    </AdminProtected>
  );
}
