"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
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
  BadgeDollarSign,
  Calculator,
  Layers,
  Trash2,
  RotateCcw,
  Filter,
} from "lucide-react";

/* ============================================================================
 * Types
 * ========================================================================== */

type Unit = "UNIT" | "KG" | "L";

type Supplier = { id: string; name: string; isActive: boolean };

type Category = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

type Ingredient = {
  id: string;
  name: string;
  unit: Unit;
  supplierId: string;
  isActive: boolean;
  minQty: number;
  // asumimos que existe cost.lastCost en backend ingredients
  cost?: { lastCost?: number; currency?: "ARS" | "USD" };
};

type Preparation = {
  id: string;
  name: string;
  yieldQty: number;
  yieldUnit: Unit;
  isActive: boolean;
  computed?: { unitCost?: number; totalCost?: number; currency?: "ARS" | "USD" };
};

type ProductItemType = "INGREDIENT" | "PREPARATION";

type ProductItemDraft = {
  type: ProductItemType;
  ingredientId?: string;
  preparationId?: string;
  qty: string; // draft
  note?: string;
};

type Product = {
  id: string;
  name: string;
  description: string | null;

  categoryId: string | null;
  categoryName: string | null;

  sku: string | null;
  barcode: string | null;

  isSellable: boolean;
  isProduced: boolean;

  yieldQty: number;
  yieldUnit: Unit;

  wastePct: number;
  extraCost: number;
  packagingCost: number;

  currency: "ARS" | "USD";

  salePrice: number | null;
  marginPct: number | null;

  tags: string[];
  imageUrl: string | null;

  isActive: boolean;

  items: Array<{
    type: ProductItemType;
    ingredientId: string | null;
    preparationId: string | null;
    qty: number;
    note: string | null;
  }>;

  computed?: {
    ingredientsCost: number;
    totalCost: number;
    unitCost: number;
    suggestedPrice: number | null;
    marginPctUsed: number | null;
    grossMarginPct: number | null;
    currency: "ARS" | "USD";
    computedAt: string | null;
  };

  createdAt?: string;
  updatedAt?: string;
};

/* ============================================================================
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

function toNum(raw: string | undefined) {
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

function money(n: number, currency: "ARS" | "USD" = "ARS") {
  const v = Number(n ?? 0) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency });
}

function pct(n: number) {
  const v = Number(n ?? 0) || 0;
  return `${(v * 100).toFixed(1)}%`;
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

/* ============================================================================
 * Page
 * ========================================================================== */

export default function AdminProductsPage() {
  const { getAccessToken } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [preparations, setPreparations] = useState<Preparation[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [sellableOnly, setSellableOnly] = useState(false);
  const [producedOnly, setProducedOnly] = useState(false);
  const [categoryIdFilter, setCategoryIdFilter] = useState("");

  // create form
  const [createOpen, setCreateOpen] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [categoryId, setCategoryId] = useState<string>("");

  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");

  const [tagsRaw, setTagsRaw] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [yieldQty, setYieldQty] = useState("1");
  const [yieldUnit, setYieldUnit] = useState<Unit>("UNIT");

  const [wastePct, setWastePct] = useState("0"); // 0..1
  const [extraCost, setExtraCost] = useState("0");
  const [packagingCost, setPackagingCost] = useState("0");

  const [currency, setCurrency] = useState<"ARS" | "USD">("ARS");

  const [salePrice, setSalePrice] = useState(""); // if set, overrides suggested
  const [marginPct, setMarginPct] = useState("0.3"); // 0..1

  const [isSellable, setIsSellable] = useState(true);
  const [isProduced, setIsProduced] = useState(true);

  // item adder with supplier filter
  const [supplierFilterForAdder, setSupplierFilterForAdder] = useState<string>(""); // "" = all
  const [addType, setAddType] = useState<ProductItemType>("INGREDIENT");
  const [addRefId, setAddRefId] = useState<string>("");
  const [addQty, setAddQty] = useState<string>("1");
  const [addNote, setAddNote] = useState<string>("");

  const [itemsDraft, setItemsDraft] = useState<ProductItemDraft[]>([]);

  const activeCategories = useMemo(
    () =>
      (categories || [])
        .filter((c) => c.isActive !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name)),
    [categories]
  );

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive !== false),
    [suppliers]
  );

  const activeIngredients = useMemo(
    () => ingredients.filter((i) => i.isActive !== false),
    [ingredients]
  );

  const activePreparations = useMemo(
    () => preparations.filter((p) => p.isActive !== false),
    [preparations]
  );

  const ingredientsForAdder = useMemo(() => {
    if (!supplierFilterForAdder) return activeIngredients;
    return activeIngredients.filter((i) => i.supplierId === supplierFilterForAdder);
  }, [activeIngredients, supplierFilterForAdder]);

  const addOptions = useMemo(() => {
    if (addType === "INGREDIENT") {
      return ingredientsForAdder.map((i) => ({
        id: i.id,
        label: `${i.name} · ${unitLabel(i.unit)}`,
      }));
    }
    return activePreparations.map((p) => ({
      id: p.id,
      label: `${p.name} · (${p.yieldQty} ${unitLabel(p.yieldUnit)})`,
    }));
  }, [addType, ingredientsForAdder, activePreparations]);

  const filteredProducts = useMemo(() => {
    let base = products;

    if (onlyActive) base = base.filter((p) => p.isActive);
    if (sellableOnly) base = base.filter((p) => p.isSellable);
    if (producedOnly) base = base.filter((p) => p.isProduced);
    if (categoryIdFilter) base = base.filter((p) => (p.categoryId || "") === categoryIdFilter);

    const qq = q.trim().toLowerCase();
    if (!qq) return base;

    return base.filter((p) => {
      const hay =
        (p.name || "").toLowerCase().includes(qq) ||
        (p.description || "").toLowerCase().includes(qq) ||
        (p.categoryName || "").toLowerCase().includes(qq) ||
        (p.tags || []).some((t) => (t || "").toLowerCase().includes(qq)) ||
        (p.sku || "").toLowerCase().includes(qq) ||
        (p.barcode || "").toLowerCase().includes(qq);
      return hay;
    });
  }, [products, onlyActive, sellableOnly, producedOnly, categoryIdFilter, q]);

  /* ============================================================================
   * Loaders
   * ========================================================================== */

  async function loadAll() {
    setErr(null);
    setOk(null);
    setLoading(true);

    try {
      const [cats, sups, ings, preps, prods] = await Promise.all([
        apiFetchAuthed<Category[]>(getAccessToken, "/categories?onlyActive=false"),
        apiFetchAuthed<Supplier[]>(getAccessToken, "/suppliers"),
        apiFetchAuthed<Ingredient[]>(getAccessToken, "/ingredients"),
        apiFetchAuthed<Preparation[]>(getAccessToken, "/preparations"),
        apiFetchAuthed<Product[]>(getAccessToken, "/products"),
      ]);

      setCategories(cats);
      setSuppliers(sups);
      setIngredients(ings);
      setPreparations(preps);
      setProducts(prods);

      // default category selection
      if (!categoryId && cats?.length) {
        const first = cats.find((c) => c.isActive !== false) || cats[0];
        if (first) setCategoryId(first.id);
      }

      setOk("Datos actualizados ✔");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message || "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================================================================
   * Create actions
   * ========================================================================== */

  function addItem() {
    if (!addRefId) return;

    const qty = toNum(addQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErr("La cantidad debe ser > 0");
      return;
    }

    // avoid duplicates
    const key = addType === "INGREDIENT" ? `I:${addRefId}` : `P:${addRefId}`;
    const exists = itemsDraft.some((it) => {
      const k = it.type === "INGREDIENT" ? `I:${it.ingredientId}` : `P:${it.preparationId}`;
      return k === key;
    });
    if (exists) {
      setErr("Ese item ya fue agregado.");
      return;
    }

    setItemsDraft((prev) => [
      ...prev,
      addType === "INGREDIENT"
        ? { type: "INGREDIENT", ingredientId: addRefId, qty: String(qty), note: addNote || "" }
        : { type: "PREPARATION", preparationId: addRefId, qty: String(qty), note: addNote || "" },
    ]);

    setAddRefId("");
    setAddQty("1");
    setAddNote("");
  }

  function removeItem(idx: number) {
    setItemsDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  function setItemQty(idx: number, v: string) {
    if (!isValidNumberDraft(v)) return;
    setItemsDraft((prev) => prev.map((it, i) => (i === idx ? { ...it, qty: v } : it)));
  }

  async function create() {
    if (!name.trim()) return;

    if (!itemsDraft.length) {
      setErr("Agregá al menos 1 item (ingrediente o preparación).");
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      categoryId: categoryId || null,
      sku: sku.trim() || null,
      barcode: barcode.trim() || null,
      tags: parseTags(tagsRaw),
      imageUrl: imageUrl.trim() || null,
      galleryUrls: [],

      isSellable,
      isProduced,

      yieldQty: toNum(yieldQty) || 1,
      yieldUnit,

      wastePct: Math.max(0, Math.min(1, toNum(wastePct))),
      extraCost: Math.max(0, toNum(extraCost)),
      packagingCost: Math.max(0, toNum(packagingCost)),

      currency,

      salePrice: salePrice.trim() === "" ? null : Math.max(0, toNum(salePrice)),
      marginPct: marginPct.trim() === "" ? null : Math.max(0, Math.min(1, toNum(marginPct))),

      items: itemsDraft.map((it) => ({
        type: it.type,
        ingredientId: it.type === "INGREDIENT" ? it.ingredientId : null,
        preparationId: it.type === "PREPARATION" ? it.preparationId : null,
        qty: toNum(it.qty),
        note: (it.note || "").trim() || null,
      })),
      allergens: [],
    };

    if (payload.yieldQty <= 0) {
      setErr("yieldQty debe ser > 0");
      return;
    }

    setBusy(true);
    setErr(null);
    setOk(null);

    try {
      await apiFetchAuthed(getAccessToken, "/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setName("");
      setDescription("");
      setSku("");
      setBarcode("");
      setTagsRaw("");
      setImageUrl("");
      setYieldQty("1");
      setYieldUnit("UNIT");
      setWastePct("0");
      setExtraCost("0");
      setPackagingCost("0");
      setCurrency("ARS");
      setSalePrice("");
      setMarginPct("0.3");
      setIsSellable(true);
      setIsProduced(true);
      setItemsDraft([]);

      setOk("Producto creado ✔");
      setTimeout(() => setOk(null), 1500);

      await loadAll();
    } catch (e: any) {
      setErr(e?.message || "Error creando producto");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: Product) {
    const next = !p.isActive;
    if (
      !window.confirm(
        next
          ? `¿Reactivar "${p.name}"?`
          : `¿Desactivar "${p.name}"?\n\nNo aparecerá en flujos si filtrás solo activos.`
      )
    )
      return;

    setBusy(true);
    setErr(null);

    try {
      await apiFetchAuthed(getAccessToken, `/products/${p.id}/active`, {
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

  async function recompute(p: Product) {
    setBusy(true);
    setErr(null);

    try {
      await apiFetchAuthed(getAccessToken, `/products/${p.id}/recompute`, {
        method: "POST",
      });
      await loadAll();
      setOk("Recalculado ✔");
      setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      setErr(e?.message || "Error recalculando");
    } finally {
      setBusy(false);
    }
  }

  /* ============================================================================
   * Preview cost for create form (client-side approx)
   * ========================================================================== */

  const preview = useMemo(() => {
    if (!itemsDraft.length) return null;

    let ingredientsCost = 0;

    for (const it of itemsDraft) {
      const qty = toNum(it.qty);
      if (qty <= 0) continue;

      if (it.type === "INGREDIENT") {
        const ing = activeIngredients.find((x) => x.id === it.ingredientId);
        const unitCost = Number(ing?.cost?.lastCost ?? 0) || 0;
        ingredientsCost += qty * unitCost;
      } else {
        const prep = activePreparations.find((x) => x.id === it.preparationId);
        const unitCost = Number(prep?.computed?.unitCost ?? 0) || 0;
        ingredientsCost += qty * unitCost;
      }
    }

    const w = Math.max(0, Math.min(1, toNum(wastePct)));
    const extra = Math.max(0, toNum(extraCost));
    const pack = Math.max(0, toNum(packagingCost));
    const yQty = Math.max(0.000001, toNum(yieldQty) || 1);

    const totalCost = ingredientsCost * (1 + w) + extra + pack;
    const unitCost = totalCost / yQty;

    const sp = salePrice.trim() === "" ? null : Math.max(0, toNum(salePrice));
    const m = marginPct.trim() === "" ? null : Math.max(0, Math.min(1, toNum(marginPct)));

    const suggestedPrice = sp != null ? null : m != null ? unitCost * (1 + m) : null;

    return { ingredientsCost, totalCost, unitCost, suggestedPrice };
  }, [
    itemsDraft,
    activeIngredients,
    activePreparations,
    wastePct,
    extraCost,
    packagingCost,
    yieldQty,
    salePrice,
    marginPct,
  ]);

  /* ============================================================================
   * Render
   * ========================================================================== */

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Productos
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Productos vendibles (hechos con ingredientes / preparaciones) + costo y precio.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={loadAll} loading={loading}>
                <RefreshCcw className="h-4 w-4" />
                Actualizar
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

        {/* Filters */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[260px_1fr_auto_auto_auto] lg:items-center">
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Select
                value={categoryIdFilter}
                onChange={(e) => setCategoryIdFilter(e.target.value)}
                className="pl-9"
              >
                <option value="">Todas las categorías</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, SKU, tags…"
                className="pl-9"
              />
            </div>

            <button
              type="button"
              onClick={() => setOnlyActive((v) => !v)}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                onlyActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
              )}
            >
              {onlyActive ? "Solo activos" : "Todos"}
            </button>

            <button
              type="button"
              onClick={() => setSellableOnly((v) => !v)}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                sellableOnly
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
              )}
            >
              Sellables
            </button>

            <button
              type="button"
              onClick={() => setProducedOnly((v) => !v)}
              className={cn(
                "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                producedOnly
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
              )}
            >
              Producidos
            </button>
          </div>
        </div>

        {/* Create */}
        <Card>
          <CardHeader title="Crear producto" subtitle="Receta, costos y precio" />
          <div className="flex items-start justify-between px-5 pt-2">
            <div className="text-sm text-zinc-500">
              Tip: podés mezclar <b>Ingredientes</b> y <b>Preparaciones</b>.
            </div>
            <button
              onClick={() => setCreateOpen((v) => !v)}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-zinc-50"
            >
              {createOpen ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {createOpen && (
            <CardBody>
              <div className="grid gap-4 md:grid-cols-6">
                <Field label="Nombre">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>

                <Field label="Categoría">
                  <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    <option value="">(Sin categoría)</option>
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="SKU">
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Opcional" />
                </Field>

                <Field label="Barcode">
                  <Input
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Opcional"
                  />
                </Field>

                <Field label="Tags">
                  <div className="relative">
                    <Tags className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={tagsRaw}
                      onChange={(e) => setTagsRaw(e.target.value)}
                      placeholder="sushi, promo"
                      className="pl-9"
                    />
                  </div>
                </Field>

                <Field label="Image URL">
                  <div className="relative">
                    <ImageIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://..."
                      className="pl-9"
                    />
                  </div>
                </Field>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-6">
                <Field label="Yield Qty">
                  <Input
                    value={yieldQty}
                    onChange={(e) => isValidNumberDraft(e.target.value) && setYieldQty(e.target.value)}
                  />
                </Field>

                <Field label="Yield Unit">
                  <Select value={yieldUnit} onChange={(e) => setYieldUnit(e.target.value as Unit)}>
                    <option value="UNIT">Unidad</option>
                    <option value="KG">Kg</option>
                    <option value="L">Litros</option>
                  </Select>
                </Field>

                <Field label="Waste % (0..1)">
                  <Input
                    value={wastePct}
                    onChange={(e) => isValidNumberDraft(e.target.value) && setWastePct(e.target.value)}
                  />
                </Field>

                <Field label="Extra cost">
                  <Input
                    value={extraCost}
                    onChange={(e) => isValidNumberDraft(e.target.value) && setExtraCost(e.target.value)}
                  />
                </Field>

                <Field label="Packaging">
                  <Input
                    value={packagingCost}
                    onChange={(e) =>
                      isValidNumberDraft(e.target.value) && setPackagingCost(e.target.value)
                    }
                  />
                </Field>

                <Field label="Moneda">
                  <Select value={currency} onChange={(e) => setCurrency(e.target.value as any)}>
                    <option value="ARS">ARS</option>
                    <option value="USD">USD</option>
                  </Select>
                </Field>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-6">
                <Field label="Sale price (opcional)">
                  <div className="relative">
                    <BadgeDollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={salePrice}
                      onChange={(e) => isValidNumberDraft(e.target.value) && setSalePrice(e.target.value)}
                      className="pl-9"
                      placeholder="Si lo ponés, ignora sugerido"
                    />
                  </div>
                </Field>

                <Field label="Margin % (0..1)">
                  <div className="relative">
                    <Calculator className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <Input
                      value={marginPct}
                      onChange={(e) => isValidNumberDraft(e.target.value) && setMarginPct(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </Field>

                <div className="md:col-span-2 flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSellable((v) => !v)}
                    className={cn(
                      "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                      isSellable
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                    )}
                  >
                    {isSellable ? "Sellable ✅" : "Sellable ❌"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsProduced((v) => !v)}
                    className={cn(
                      "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                      isProduced
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                    )}
                  >
                    {isProduced ? "Producido ✅" : "Producido ❌"}
                  </button>
                </div>

                <div className="md:col-span-2 flex items-end justify-end">
                  <Button onClick={create} disabled={busy || !name.trim() || itemsDraft.length === 0}>
                    <Plus className="h-4 w-4" />
                    Crear producto
                  </Button>
                </div>
              </div>

              <div className="mt-4">
                <Field label="Descripción">
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Opcional"
                  />
                </Field>
              </div>

              {/* Item adder */}
              <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  <Layers className="h-4 w-4" /> Composición (items)
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-6">
                  <Field label="Proveedor (filtro)">
                    <Select
                      value={supplierFilterForAdder}
                      onChange={(e) => setSupplierFilterForAdder(e.target.value)}
                    >
                      <option value="">Todos</option>
                      {activeSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Tipo">
                    <Select value={addType} onChange={(e) => setAddType(e.target.value as any)}>
                      <option value="INGREDIENT">Ingrediente</option>
                      <option value="PREPARATION">Preparación</option>
                    </Select>
                  </Field>

                  <Field label={addType === "INGREDIENT" ? "Ingrediente" : "Preparación"}>
                    <Select value={addRefId} onChange={(e) => setAddRefId(e.target.value)}>
                      <option value="">Seleccionar…</option>
                      {addOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Cantidad">
                    <Input
                      value={addQty}
                      onChange={(e) => isValidNumberDraft(e.target.value) && setAddQty(e.target.value)}
                    />
                  </Field>

                  <Field label="Nota">
                    <Input value={addNote} onChange={(e) => setAddNote(e.target.value)} placeholder="Opcional" />
                  </Field>

                  <div className="flex items-end">
                    <Button variant="secondary" onClick={addItem} disabled={!addRefId}>
                      <Plus className="h-4 w-4" />
                      Agregar
                    </Button>
                  </div>
                </div>

                {/* Draft list */}
                <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
                  <table className="min-w-full">
                    <thead className="bg-zinc-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Qty</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Nota</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {itemsDraft.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-sm text-zinc-500">
                            Agregá ingredientes o preparaciones.
                          </td>
                        </tr>
                      )}

                      {itemsDraft.map((it, idx) => {
                        const label =
                          it.type === "INGREDIENT"
                            ? activeIngredients.find((x) => x.id === it.ingredientId)?.name || "—"
                            : activePreparations.find((x) => x.id === it.preparationId)?.name || "—";

                        return (
                          <tr key={idx} className="hover:bg-zinc-50">
                            <td className="px-4 py-3 text-sm">{it.type}</td>
                            <td className="px-4 py-3 font-medium">{label}</td>
                            <td className="px-4 py-3">
                              <Input
                                value={it.qty}
                                onChange={(e) => setItemQty(idx, e.target.value)}
                                className="w-28"
                              />
                            </td>
                            <td className="px-4 py-3 text-sm text-zinc-600">
                              {it.note || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <Button variant="ghost" onClick={() => removeItem(idx)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Preview */}
                <div className="mt-4 grid gap-2 text-sm">
                  {preview ? (
                    <div className="grid gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                      <div className="font-semibold text-zinc-900">Preview costos (cliente)</div>
                      <div className="text-zinc-700">
                        Ingredients cost: <b>{money(preview.ingredientsCost, currency)}</b>
                      </div>
                      <div className="text-zinc-700">
                        Total cost: <b>{money(preview.totalCost, currency)}</b>
                      </div>
                      <div className="text-zinc-700">
                        Unit cost: <b>{money(preview.unitCost, currency)}</b> / {unitLabel(yieldUnit)}
                      </div>
                      <div className="text-zinc-700">
                        Precio sugerido:{" "}
                        <b>{preview.suggestedPrice == null ? "—" : money(preview.suggestedPrice, currency)}</b>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-zinc-500">
                      Agregá items para ver preview.
                    </div>
                  )}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Categoría</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Costo unit</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Precio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Estado</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100">
              {filteredProducts.map((p) => {
                const catLabel =
                  p.categoryName ||
                  (p.categoryId ? activeCategories.find((c) => c.id === p.categoryId)?.name : null) ||
                  "—";

                const ccy = p.currency || "ARS";
                const unitCost = Number(p.computed?.unitCost ?? 0) || 0;
                const totalCost = Number(p.computed?.totalCost ?? 0) || 0;

                const price =
                  p.salePrice != null
                    ? money(p.salePrice, ccy)
                    : p.computed?.suggestedPrice != null
                    ? money(p.computed.suggestedPrice, ccy)
                    : "—";

                const gm =
                  p.salePrice != null && p.computed?.grossMarginPct != null
                    ? pct(p.computed.grossMarginPct)
                    : "—";

                return (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-900">{p.name}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        Yield: <b>{p.yieldQty}</b> {unitLabel(p.yieldUnit)} · Items:{" "}
                        <b>{p.items?.length ?? 0}</b>
                      </div>
                      {(p.sku || p.barcode) && (
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {p.sku ? <span>SKU: <b>{p.sku}</b></span> : null}
                          {p.sku && p.barcode ? " · " : null}
                          {p.barcode ? <span>BAR: <b>{p.barcode}</b></span> : null}
                        </div>
                      )}
                      {p.tags?.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.tags.slice(0, 4).map((t) => (
                            <span
                              key={t}
                              className="inline-flex rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-xs text-zinc-700"
                            >
                              {t}
                            </span>
                          ))}
                          {p.tags.length > 4 && (
                            <span className="text-xs text-zinc-400">+{p.tags.length - 4}</span>
                          )}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3 text-sm">{catLabel}</td>

                    <td className="px-4 py-3 text-sm">
                      <div className="font-semibold">{money(unitCost, ccy)}</div>
                      <div className="text-xs text-zinc-500">Total: {money(totalCost, ccy)}</div>
                    </td>

                    <td className="px-4 py-3 text-sm">
                      <div className="font-semibold">{price}</div>
                      <div className="text-xs text-zinc-500">Margen: {gm}</div>
                    </td>

                    <td className="px-4 py-3">
                      <StatusPill active={p.isActive} />
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => recompute(p)}
                          disabled={busy}
                        >
                          <RotateCcw className="h-4 w-4" />
                          Recompute
                        </Button>

                        <Button
                          variant={p.isActive ? "danger" : "secondary"}
                          onClick={() => toggleActive(p)}
                          disabled={busy}
                        >
                          <Power className="h-4 w-4" />
                          {p.isActive ? "Desactivar" : "Reactivar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-sm text-zinc-500">
                    No hay productos para mostrar.
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-sm text-zinc-500">
                    Cargando…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="text-xs text-zinc-500">
          Mostrando <b>{filteredProducts.length}</b> de <b>{products.length}</b> productos.
        </div>
      </div>
    </AdminProtected>
  );
}
