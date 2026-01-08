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
 * Types (alineado a tu schema + branch requerido)
 * ========================================================================== */

type Unit = "UNIT" | "KG" | "L";
type Currency = "ARS" | "USD";

type Branch = { id: string; name: string; isActive: boolean };

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
  cost?: { lastCost?: number; currency?: Currency };
};

type Preparation = {
  id: string;
  name: string;
  yieldQty: number;
  yieldUnit: Unit;
  isActive: boolean;
  computed?: { unitCost?: number; totalCost?: number; currency?: Currency };
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

  branchId: string; // ✅ requerido

  supplierId?: string | null;

  categoryId: string | null;
  categoryName: string | null;

  sku: string | null;
  barcode: string | null;

  isSellable: boolean;
  isProduced: boolean;

  yieldQty: number;
  yieldUnit: Unit;

  portionSize?: number | null;
  portionLabel?: string | null;

  wastePct: number;
  extraCost: number;
  packagingCost: number;

  currency: Currency;

  salePrice: number | null;
  marginPct: number | null;

  tags: string[];
  allergens?: string[];
  imageUrl: string | null;
  galleryUrls?: string[];

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
    currency: Currency;
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

function money(n: number, currency: Currency = "ARS") {
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

  const [branches, setBranches] = useState<Branch[]>([]);
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
  const [branchIdFilter, setBranchIdFilter] = useState("");
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

  const [currency, setCurrency] = useState<Currency>("ARS");

  const [salePrice, setSalePrice] = useState(""); // if set, overrides suggested
  const [marginPct, setMarginPct] = useState("0.3"); // 0..1

  const [isSellable, setIsSellable] = useState(true);
  const [isProduced, setIsProduced] = useState(true);

  // item adder (GLOBAL search: ingredients + preparations)
  const [addPickId, setAddPickId] = useState<string>(""); // "I:<id>" | "P:<id>"
  const [addQty, setAddQty] = useState<string>("1");
  const [addNote, setAddNote] = useState<string>("");
  const [addSearch, setAddSearch] = useState<string>("");

  const [itemsDraft, setItemsDraft] = useState<ProductItemDraft[]>([]);

  // details / edit drawer
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  // edit drafts
  const [editBranchId, setEditBranchId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editSku, setEditSku] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editTagsRaw, setEditTagsRaw] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");

  const [editYieldQty, setEditYieldQty] = useState("1");
  const [editYieldUnit, setEditYieldUnit] = useState<Unit>("UNIT");

  const [editWastePct, setEditWastePct] = useState("0");
  const [editExtraCost, setEditExtraCost] = useState("0");
  const [editPackagingCost, setEditPackagingCost] = useState("0");

  const [editCurrency, setEditCurrency] = useState<Currency>("ARS");
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editMarginPct, setEditMarginPct] = useState("0.3");

  const [editIsSellable, setEditIsSellable] = useState(true);
  const [editIsProduced, setEditIsProduced] = useState(true);

  const [editItemsDraft, setEditItemsDraft] = useState<ProductItemDraft[]>([]);

  // item adder dentro del drawer
  const [editAddPickId, setEditAddPickId] = useState<string>("");
  const [editAddQty, setEditAddQty] = useState<string>("1");
  const [editAddNote, setEditAddNote] = useState<string>("");
  const [editAddSearch, setEditAddSearch] = useState<string>("");

  const activeBranches = useMemo(
    () => (branches || []).filter((b) => b.isActive !== false),
    [branches]
  );

  const activeCategories = useMemo(
    () =>
      (categories || [])
        .filter((c) => c.isActive !== false)
        .sort(
          (a, b) =>
            (a.sortOrder ?? 0) - (b.sortOrder ?? 0) ||
            a.name.localeCompare(b.name)
        ),
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

  // GLOBAL options (search across all, no supplier filter)
  const addOptions = useMemo(() => {
    const supplierNameById = new Map(activeSuppliers.map((s) => [s.id, s.name]));

    const ing = activeIngredients.map((i) => {
      const sup = i.supplierId ? supplierNameById.get(i.supplierId) : null;
      return {
        id: `I:${i.id}`,
        kind: "INGREDIENT" as const,
        refId: i.id,
        label: `${i.name} · ${unitLabel(i.unit)}${
          sup ? ` · ${sup}` : ""
        }`,
        search:
          `${i.name} ${i.id} ${i.supplierId ?? ""} ${sup ?? ""}`.toLowerCase(),
      };
    });

    const preps = activePreparations.map((p) => ({
      id: `P:${p.id}`,
      kind: "PREPARATION" as const,
      refId: p.id,
      label: `${p.name} · (${p.yieldQty} ${unitLabel(p.yieldUnit)})`,
      search: `${p.name} ${p.id}`.toLowerCase(),
    }));

    const all = [...ing, ...preps];

    const s = addSearch.trim().toLowerCase();
    if (!s) return all;

    return all.filter((o) => o.search.includes(s));
  }, [activeIngredients, activePreparations, activeSuppliers, addSearch]);

  // drawer options
  const editAddOptions = useMemo(() => {
    const supplierNameById = new Map(activeSuppliers.map((s) => [s.id, s.name]));

    const ing = activeIngredients.map((i) => {
      const sup = i.supplierId ? supplierNameById.get(i.supplierId) : null;
      return {
        id: `I:${i.id}`,
        kind: "INGREDIENT" as const,
        refId: i.id,
        label: `${i.name} · ${unitLabel(i.unit)}${
          sup ? ` · ${sup}` : ""
        }`,
        search:
          `${i.name} ${i.id} ${i.supplierId ?? ""} ${sup ?? ""}`.toLowerCase(),
      };
    });

    const preps = activePreparations.map((p) => ({
      id: `P:${p.id}`,
      kind: "PREPARATION" as const,
      refId: p.id,
      label: `${p.name} · (${p.yieldQty} ${unitLabel(p.yieldUnit)})`,
      search: `${p.name} ${p.id}`.toLowerCase(),
    }));

    const all = [...ing, ...preps];
    const s = editAddSearch.trim().toLowerCase();
    if (!s) return all;
    return all.filter((o) => o.search.includes(s));
  }, [activeIngredients, activePreparations, activeSuppliers, editAddSearch]);

  const filteredProducts = useMemo(() => {
    let base = products;

    if (onlyActive) base = base.filter((p) => p.isActive);
    if (sellableOnly) base = base.filter((p) => p.isSellable);
    if (producedOnly) base = base.filter((p) => p.isProduced);
    if (categoryIdFilter)
      base = base.filter((p) => (p.categoryId || "") === categoryIdFilter);

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
      // branches primero (para elegir default)
      const brs = await apiFetchAuthed<Branch[]>(getAccessToken, "/branches");
      setBranches(brs);

      let chosenBranchId = branchIdFilter;
      if (!chosenBranchId) {
        const first = brs.find((b) => b.isActive !== false) || brs[0];
        chosenBranchId = first?.id || "";
        if (chosenBranchId) setBranchIdFilter(chosenBranchId);
      }

      const branchQs = chosenBranchId
        ? `?branchId=${encodeURIComponent(chosenBranchId)}`
        : "";

      const [
        cats,
        sups,
        ings,
        preps,
        prods,
      ] = await Promise.all([
        // si tu backend no soporta branchId acá, lo va a ignorar
        apiFetchAuthed<Category[]>(
          getAccessToken,
          `/categories?onlyActive=false${
            chosenBranchId ? `&branchId=${encodeURIComponent(chosenBranchId)}` : ""
          }`
        ),
        apiFetchAuthed<Supplier[]>(getAccessToken, `/suppliers${branchQs}`),
        apiFetchAuthed<Ingredient[]>(getAccessToken, `/ingredients${branchQs}`),
        apiFetchAuthed<Preparation[]>(
          getAccessToken,
          `/preparations${branchQs}`
        ),
        apiFetchAuthed<Product[]>(getAccessToken, `/products${branchQs}`),
      ]);

      setCategories(cats);
      setSuppliers(sups);
      setIngredients(ings);
      setPreparations(preps);
      setProducts(prods);

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

  // recargar cuando cambie branch
  useEffect(() => {
    if (!branchIdFilter) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchIdFilter]);

  /* ============================================================================
   * Create actions
   * ========================================================================== */

  function addItem() {
    if (!addPickId) return;

    const qty = toNum(addQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErr("La cantidad debe ser > 0");
      return;
    }

    const [prefix, refId] = addPickId.split(":");
    const type: ProductItemType = prefix === "P" ? "PREPARATION" : "INGREDIENT";

    const key = `${prefix}:${refId}`;
    const exists = itemsDraft.some((it) => {
      const k =
        it.type === "INGREDIENT"
          ? `I:${it.ingredientId}`
          : `P:${it.preparationId}`;
      return k === key;
    });
    if (exists) {
      setErr("Ese item ya fue agregado.");
      return;
    }

    setItemsDraft((prev) => [
      ...prev,
      type === "INGREDIENT"
        ? {
            type: "INGREDIENT",
            ingredientId: refId,
            qty: String(qty),
            note: addNote || "",
          }
        : {
            type: "PREPARATION",
            preparationId: refId,
            qty: String(qty),
            note: addNote || "",
          },
    ]);

    setAddPickId("");
    setAddQty("1");
    setAddNote("");
  }

  function removeItem(idx: number) {
    setItemsDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  function setItemQty(idx: number, v: string) {
    if (!isValidNumberDraft(v)) return;
    setItemsDraft((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, qty: v } : it))
    );
  }

  async function create() {
    if (!name.trim()) return;

    if (!branchIdFilter) {
      setErr("Seleccioná una sucursal (branch) antes de crear el producto.");
      return;
    }

    if (!itemsDraft.length) {
      setErr("Agregá al menos 1 item (ingrediente o preparación).");
      return;
    }

    const payload = {
      branchId: branchIdFilter, // ✅ requerido
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
      marginPct:
        marginPct.trim() === ""
          ? null
          : Math.max(0, Math.min(1, toNum(marginPct))),

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

      setAddPickId("");
      setAddQty("1");
      setAddNote("");
      setAddSearch("");

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

      if (selected?.id === p.id) {
        setSelected((prev) => (prev ? { ...prev, isActive: next } : prev));
      }
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
   * Details / Edit actions (GET/:id y PATCH/:id)
   * ========================================================================== */

  async function openDetails(p: Product) {
    setErr(null);
    setOk(null);
    setBusy(true);

    try {
      const full = await apiFetchAuthed<Product>(
        getAccessToken,
        `/products/${p.id}`
      );

      setSelected(full);

      setEditBranchId(full.branchId ?? branchIdFilter ?? "");
      setEditName(full.name ?? "");
      setEditDescription(full.description ?? "");
      setEditCategoryId(full.categoryId ?? "");
      setEditSku(full.sku ?? "");
      setEditBarcode(full.barcode ?? "");
      setEditTagsRaw((full.tags ?? []).join(", "));
      setEditImageUrl(full.imageUrl ?? "");

      setEditYieldQty(String(full.yieldQty ?? 1));
      setEditYieldUnit((full.yieldUnit ?? "UNIT") as Unit);

      setEditWastePct(String(full.wastePct ?? 0));
      setEditExtraCost(String(full.extraCost ?? 0));
      setEditPackagingCost(String(full.packagingCost ?? 0));

      setEditCurrency((full.currency ?? "ARS") as any);
      setEditSalePrice(full.salePrice == null ? "" : String(full.salePrice));
      setEditMarginPct(full.marginPct == null ? "" : String(full.marginPct));

      setEditIsSellable(!!full.isSellable);
      setEditIsProduced(!!full.isProduced);

      setEditItemsDraft(
        (full.items ?? []).map((it) => ({
          type: it.type,
          ingredientId: it.ingredientId ?? undefined,
          preparationId: it.preparationId ?? undefined,
          qty: String(it.qty ?? 0),
          note: it.note ?? "",
        }))
      );

      setEditAddPickId("");
      setEditAddQty("1");
      setEditAddNote("");
      setEditAddSearch("");

      setDetailsOpen(true);
    } catch (e: any) {
      setErr(e?.message || "Error cargando detalle del producto");
    } finally {
      setBusy(false);
    }
  }

  function closeDetails() {
    setDetailsOpen(false);
    setSelected(null);
  }

  function editRemoveItem(idx: number) {
    setEditItemsDraft((prev) => prev.filter((_, i) => i !== idx));
  }

  function editSetItemQty(idx: number, v: string) {
    if (!isValidNumberDraft(v)) return;
    setEditItemsDraft((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, qty: v } : it))
    );
  }

  function editSetItemNote(idx: number, v: string) {
    setEditItemsDraft((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, note: v } : it))
    );
  }

  function editAddItem() {
    if (!editAddPickId) return;

    const qty = toNum(editAddQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErr("La cantidad debe ser > 0");
      return;
    }

    const [prefix, refId] = editAddPickId.split(":");
    const type: ProductItemType = prefix === "P" ? "PREPARATION" : "INGREDIENT";

    const key = `${prefix}:${refId}`;
    const exists = editItemsDraft.some((it) => {
      const k =
        it.type === "INGREDIENT"
          ? `I:${it.ingredientId}`
          : `P:${it.preparationId}`;
      return k === key;
    });
    if (exists) {
      setErr("Ese item ya fue agregado.");
      return;
    }

    setEditItemsDraft((prev) => [
      ...prev,
      type === "INGREDIENT"
        ? {
            type: "INGREDIENT",
            ingredientId: refId,
            qty: String(qty),
            note: editAddNote || "",
          }
        : {
            type: "PREPARATION",
            preparationId: refId,
            qty: String(qty),
            note: editAddNote || "",
          },
    ]);

    setEditAddPickId("");
    setEditAddQty("1");
    setEditAddNote("");
  }

  async function saveEdits() {
    if (!selected) return;

    if (!editName.trim()) {
      setErr("Nombre requerido");
      return;
    }

    if (!editBranchId) {
      setErr("Branch requerido");
      return;
    }

    if (!editItemsDraft.length) {
      setErr("Agregá al menos 1 item.");
      return;
    }

    const payload = {
      branchId: editBranchId, // ✅ requerido
      name: editName.trim(),
      description: editDescription.trim() || null,
      categoryId: editCategoryId || null,
      sku: editSku.trim() || null,
      barcode: editBarcode.trim() || null,

      tags: parseTags(editTagsRaw),
      imageUrl: editImageUrl.trim() || null,

      isSellable: editIsSellable,
      isProduced: editIsProduced,

      yieldQty: Math.max(0.000001, toNum(editYieldQty) || 1),
      yieldUnit: editYieldUnit,

      wastePct: Math.max(0, Math.min(1, toNum(editWastePct))),
      extraCost: Math.max(0, toNum(editExtraCost)),
      packagingCost: Math.max(0, toNum(editPackagingCost)),

      currency: editCurrency,

      salePrice:
        editSalePrice.trim() === "" ? null : Math.max(0, toNum(editSalePrice)),
      marginPct:
        editMarginPct.trim() === ""
          ? null
          : Math.max(0, Math.min(1, toNum(editMarginPct))),

      items: editItemsDraft.map((it) => ({
        type: it.type,
        ingredientId: it.type === "INGREDIENT" ? it.ingredientId : null,
        preparationId: it.type === "PREPARATION" ? it.preparationId : null,
        qty: Math.max(0, toNum(it.qty)),
        note: (it.note || "").trim() || null,
      })),
    };

    setBusy(true);
    setErr(null);
    setOk(null);

    try {
      await apiFetchAuthed(getAccessToken, `/products/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setOk("Producto actualizado ✔");
      setTimeout(() => setOk(null), 1200);

      await loadAll();

      try {
        const refreshed = await apiFetchAuthed<Product>(
          getAccessToken,
          `/products/${selected.id}`
        );
        setSelected(refreshed);
      } catch {}

      setDetailsOpen(false);
      setSelected(null);
    } catch (e: any) {
      setErr(e?.message || "Error actualizando producto");
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
    const m =
      marginPct.trim() === ""
        ? null
        : Math.max(0, Math.min(1, toNum(marginPct)));

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
      <div className="space-y-6 text-zinc-500">
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
          <div className="grid gap-3 lg:grid-cols-[260px_260px_1fr_auto_auto_auto] lg:items-center">
            {/* Branch */}
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Select
                value={branchIdFilter}
                onChange={(e) => setBranchIdFilter(e.target.value)}
                className="pl-9"
              >
                {activeBranches.length === 0 && (
                  <option value="">Sin sucursales</option>
                )}
                {activeBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Category */}
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

            {/* Search */}
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
              {branchIdFilter ? (
                <>
                  {" "}
                  · Sucursal actual:{" "}
                  <b>
                    {activeBranches.find((b) => b.id === branchIdFilter)?.name ??
                      "—"}
                  </b>
                </>
              ) : null}
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
                  <Select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">(Sin categoría)</option>
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field label="SKU">
                  <Input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Opcional"
                  />
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
                    onChange={(e) =>
                      isValidNumberDraft(e.target.value) && setYieldQty(e.target.value)
                    }
                  />
                </Field>

                <Field label="Yield Unit">
                  <Select
                    value={yieldUnit}
                    onChange={(e) => setYieldUnit(e.target.value as Unit)}
                  >
                    <option value="UNIT">Unidad</option>
                    <option value="KG">Kg</option>
                    <option value="L">Litros</option>
                  </Select>
                </Field>

                <Field label="Waste % (0..1)">
                  <Input
                    value={wastePct}
                    onChange={(e) =>
                      isValidNumberDraft(e.target.value) && setWastePct(e.target.value)
                    }
                  />
                </Field>

                <Field label="Extra cost">
                  <Input
                    value={extraCost}
                    onChange={(e) =>
                      isValidNumberDraft(e.target.value) && setExtraCost(e.target.value)
                    }
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
                  <Select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                  >
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
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) && setSalePrice(e.target.value)
                      }
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
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) && setMarginPct(e.target.value)
                      }
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
                  <Button
                    onClick={create}
                    disabled={
                      busy ||
                      !name.trim() ||
                      itemsDraft.length === 0 ||
                      !branchIdFilter
                    }
                  >
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

              {/* Item adder (GLOBAL SEARCH) */}
              <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                  <Layers className="h-4 w-4" /> Composición (items)
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-6">
                  <Field label="Buscar (global)">
                    <Input
                      value={addSearch}
                      onChange={(e) => setAddSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !addPickId && addOptions.length) {
                          setAddPickId(addOptions[0].id);
                        }
                      }}
                      placeholder="Buscá ingrediente o preparación…"
                    />
                  </Field>

                  <Field label="Item">
                    <Select
                      value={addPickId}
                      onChange={(e) => setAddPickId(e.target.value)}
                    >
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
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) && setAddQty(e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Nota">
                    <Input
                      value={addNote}
                      onChange={(e) => setAddNote(e.target.value)}
                      placeholder="Opcional"
                    />
                  </Field>

                  <div className="flex items-end">
                    <Button
                      variant="secondary"
                      onClick={addItem}
                      disabled={!addPickId}
                    >
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
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                          Tipo
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                          Item
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                          Qty
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                          Nota
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                          Acción
                        </th>
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
                            ? activeIngredients.find((x) => x.id === it.ingredientId)?.name ||
                              "—"
                            : activePreparations.find((x) => x.id === it.preparationId)?.name ||
                              "—";

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
                      <div className="font-semibold text-zinc-900">
                        Preview costos (cliente)
                      </div>
                      <div className="text-zinc-700">
                        Ingredients cost: <b>{money(preview.ingredientsCost, currency)}</b>
                      </div>
                      <div className="text-zinc-700">
                        Total cost: <b>{money(preview.totalCost, currency)}</b>
                      </div>
                      <div className="text-zinc-700">
                        Unit cost: <b>{money(preview.unitCost, currency)}</b> /{" "}
                        {unitLabel(yieldUnit)}
                      </div>
                      <div className="text-zinc-700">
                        Precio sugerido:{" "}
                        <b>
                          {preview.suggestedPrice == null
                            ? "—"
                            : money(preview.suggestedPrice, currency)}
                        </b>
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Producto
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Categoría
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Costo unit
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                  Precio
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
              {filteredProducts.map((p) => {
                const catLabel =
                  p.categoryName ||
                  (p.categoryId
                    ? activeCategories.find((c) => c.id === p.categoryId)?.name
                    : null) ||
                  "—";

                const ccy = (p.currency || "ARS") as Currency;
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
                          {p.sku ? (
                            <span>
                              SKU: <b>{p.sku}</b>
                            </span>
                          ) : null}
                          {p.sku && p.barcode ? " · " : null}
                          {p.barcode ? (
                            <span>
                              BAR: <b>{p.barcode}</b>
                            </span>
                          ) : null}
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
                            <span className="text-xs text-zinc-400">
                              +{p.tags.length - 4}
                            </span>
                          )}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-3 text-sm">{catLabel}</td>

                    <td className="px-4 py-3 text-sm">
                      <div className="font-semibold">{money(unitCost, ccy)}</div>
                      <div className="text-xs text-zinc-500">
                        Total: {money(totalCost, ccy)}
                      </div>
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
                          onClick={() => openDetails(p)}
                          disabled={busy}
                        >
                          <Layers className="h-4 w-4" />
                          Detalles
                        </Button>

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
          Mostrando <b>{filteredProducts.length}</b> de <b>{products.length}</b>{" "}
          productos.
        </div>

        {/* Details Drawer */}
        {detailsOpen && selected && (
          <div className="fixed inset-0 z-50">
            {/* backdrop */}
            <button
              className="absolute inset-0 bg-black/30"
              onClick={closeDetails}
              aria-label="Cerrar"
            />

            {/* panel */}
            <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl border-l border-zinc-200">
              <div className="flex items-start justify-between gap-3 p-5 border-b">
                <div>
                  <div className="text-xs text-zinc-500">Detalles de producto</div>
                  <div className="text-lg font-semibold text-zinc-900">
                    {selected.name}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    ID: <span className="font-mono">{selected.id}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => recompute(selected)}
                    disabled={busy}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Recompute
                  </Button>

                  <Button
                    variant={selected.isActive ? "danger" : "secondary"}
                    onClick={() => toggleActive(selected)}
                    disabled={busy}
                  >
                    <Power className="h-4 w-4" />
                    {selected.isActive ? "Desactivar" : "Reactivar"}
                  </Button>

                  <Button variant="ghost" onClick={closeDetails}>
                    ✕
                  </Button>
                </div>
              </div>

              <div className="h-[calc(100%-72px)] overflow-auto p-5 space-y-6">
                {/* basic */}
                <div className="grid gap-4 md:grid-cols-6">
                  <Field label="Sucursal (Branch)">
                    <Select
                      value={editBranchId}
                      onChange={(e) => setEditBranchId(e.target.value)}
                    >
                      {activeBranches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Nombre">
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </Field>

                  <Field label="Categoría">
                    <Select
                      value={editCategoryId}
                      onChange={(e) => setEditCategoryId(e.target.value)}
                    >
                      <option value="">(Sin categoría)</option>
                      {activeCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="SKU">
                    <Input value={editSku} onChange={(e) => setEditSku(e.target.value)} />
                  </Field>

                  <Field label="Barcode">
                    <Input
                      value={editBarcode}
                      onChange={(e) => setEditBarcode(e.target.value)}
                    />
                  </Field>

                  <Field label="Tags">
                    <Input
                      value={editTagsRaw}
                      onChange={(e) => setEditTagsRaw(e.target.value)}
                      placeholder="coma separadas"
                    />
                  </Field>

                  <Field label="Image URL">
                    <Input
                      value={editImageUrl}
                      onChange={(e) => setEditImageUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </Field>
                </div>

                <Field label="Descripción">
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </Field>

                {/* recipe & cost */}
                <div className="grid gap-4 md:grid-cols-6">
                  <Field label="Yield Qty">
                    <Input
                      value={editYieldQty}
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) && setEditYieldQty(e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Yield Unit">
                    <Select
                      value={editYieldUnit}
                      onChange={(e) => setEditYieldUnit(e.target.value as Unit)}
                    >
                      <option value="UNIT">Unidad</option>
                      <option value="KG">Kg</option>
                      <option value="L">Litros</option>
                    </Select>
                  </Field>

                  <Field label="Waste % (0..1)">
                    <Input
                      value={editWastePct}
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) && setEditWastePct(e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Extra cost">
                    <Input
                      value={editExtraCost}
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) && setEditExtraCost(e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Packaging">
                    <Input
                      value={editPackagingCost}
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) &&
                        setEditPackagingCost(e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Moneda">
                    <Select
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value as any)}
                    >
                      <option value="ARS">ARS</option>
                      <option value="USD">USD</option>
                    </Select>
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-6">
                  <Field label="Sale price (opcional)">
                    <Input
                      value={editSalePrice}
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) && setEditSalePrice(e.target.value)
                      }
                    />
                  </Field>

                  <Field label="Margin % (0..1)">
                    <Input
                      value={editMarginPct}
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) && setEditMarginPct(e.target.value)
                      }
                    />
                  </Field>

                  <div className="md:col-span-4 flex items-end gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setEditIsSellable((v) => !v)}
                      className={cn(
                        "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                        editIsSellable
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                      )}
                    >
                      {editIsSellable ? "Sellable ✅" : "Sellable ❌"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditIsProduced((v) => !v)}
                      className={cn(
                        "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                        editIsProduced
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                      )}
                    >
                      {editIsProduced ? "Producido ✅" : "Producido ❌"}
                    </button>
                  </div>
                </div>

                {/* items */}
                <div className="rounded-2xl border border-zinc-200 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                    <Layers className="h-4 w-4" /> Composición (items)
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-6">
                    <Field label="Buscar (global)">
                      <Input
                        value={editAddSearch}
                        onChange={(e) => setEditAddSearch(e.target.value)}
                        placeholder="Buscá ingrediente o preparación…"
                      />
                    </Field>

                    <Field label="Item">
                      <Select
                        value={editAddPickId}
                        onChange={(e) => setEditAddPickId(e.target.value)}
                      >
                        <option value="">Seleccionar…</option>
                        {editAddOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Cantidad">
                      <Input
                        value={editAddQty}
                        onChange={(e) =>
                          isValidNumberDraft(e.target.value) && setEditAddQty(e.target.value)
                        }
                      />
                    </Field>

                    <Field label="Nota">
                      <Input
                        value={editAddNote}
                        onChange={(e) => setEditAddNote(e.target.value)}
                        placeholder="Opcional"
                      />
                    </Field>

                    <div className="flex items-end">
                      <Button
                        variant="secondary"
                        onClick={editAddItem}
                        disabled={!editAddPickId}
                      >
                        <Plus className="h-4 w-4" />
                        Agregar
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
                    <table className="min-w-full">
                      <thead className="bg-zinc-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                            Tipo
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                            Item
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                            Qty
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                            Nota
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                            Acción
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-zinc-100">
                        {editItemsDraft.map((it, idx) => {
                          const label =
                            it.type === "INGREDIENT"
                              ? activeIngredients.find((x) => x.id === it.ingredientId)?.name ||
                                "—"
                              : activePreparations.find((x) => x.id === it.preparationId)?.name ||
                                "—";

                          return (
                            <tr key={idx} className="hover:bg-zinc-50">
                              <td className="px-4 py-3 text-sm">{it.type}</td>
                              <td className="px-4 py-3 font-medium">{label}</td>
                              <td className="px-4 py-3">
                                <Input
                                  value={it.qty}
                                  onChange={(e) => editSetItemQty(idx, e.target.value)}
                                  className="w-28"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Input
                                  value={it.note ?? ""}
                                  onChange={(e) => editSetItemNote(idx, e.target.value)}
                                  placeholder="—"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <Button variant="ghost" onClick={() => editRemoveItem(idx)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}

                        {editItemsDraft.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-6 text-sm text-zinc-500">
                              Agregá ingredientes o preparaciones.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* computed read-only */}
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
                  <div className="font-semibold text-zinc-900">Costos calculados (backend)</div>
                  <div className="mt-2 grid gap-1 text-zinc-700">
                    <div>
                      Ingredients cost:{" "}
                      <b>
                        {money(
                          Number(selected.computed?.ingredientsCost ?? 0) || 0,
                          selected.currency || "ARS"
                        )}
                      </b>
                    </div>
                    <div>
                      Total cost:{" "}
                      <b>
                        {money(
                          Number(selected.computed?.totalCost ?? 0) || 0,
                          selected.currency || "ARS"
                        )}
                      </b>
                    </div>
                    <div>
                      Unit cost:{" "}
                      <b>
                        {money(
                          Number(selected.computed?.unitCost ?? 0) || 0,
                          selected.currency || "ARS"
                        )}
                      </b>{" "}
                      / {unitLabel(selected.yieldUnit)}
                    </div>
                    <div>
                      Suggested:{" "}
                      <b>
                        {selected.computed?.suggestedPrice == null
                          ? "—"
                          : money(selected.computed.suggestedPrice, selected.currency || "ARS")}
                      </b>
                    </div>
                    <div>
                      Margin used:{" "}
                      <b>
                        {selected.computed?.marginPctUsed == null
                          ? "—"
                          : pct(selected.computed.marginPctUsed)}
                      </b>
                    </div>
                    <div>
                      Gross margin:{" "}
                      <b>
                        {selected.computed?.grossMarginPct == null
                          ? "—"
                          : pct(selected.computed.grossMarginPct)}
                      </b>
                    </div>
                  </div>
                </div>
              </div>

              {/* footer */}
              <div className="absolute bottom-0 left-0 right-0 border-t bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-zinc-500">
                    Guardar = PATCH /products/:id (incluye items).
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={closeDetails} disabled={busy}>
                      Cancelar
                    </Button>
                    <Button onClick={saveEdits} disabled={busy || !editName.trim() || !editBranchId}>
                      Guardar cambios
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminProtected>
  );
}
