"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";
import { Button } from "@/components/ui/Button";
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
  X,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";

/* ============================================================================ */
type Unit = "UNIT" | "KG" | "L";
type Currency = "ARS" | "USD";

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

  branchId?: string;
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

/* ============================================================================ */
/* Helpers */
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

function toQS(params: Record<string, any>) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v);
    if (!s.trim()) return;
    sp.set(k, s);
  });
  const q = sp.toString();
  return q ? `?${q}` : "";
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

/** Drawer shell (igual al tuyo) */
function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  widthClass = "max-w-3xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div
        className={cn(
          "absolute right-0 top-0 h-full w-full bg-white shadow-2xl border-l border-zinc-200",
          widthClass
        )}
      >
        <div className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
          <div className="flex items-start justify-between gap-3 p-5">
            <div className="min-w-0">
              <div className="text-xs text-zinc-500">{subtitle || "Panel"}</div>
              <div className="mt-0.5 truncate text-lg font-semibold text-zinc-900">
                {title}
              </div>
            </div>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div
          className={cn(
            "h-[calc(100%-64px)] overflow-auto",
            footer ? "pb-28" : "pb-6"
          )}
        >
          <div className="p-5">{children}</div>
        </div>

        {footer ? (
          <div className="absolute bottom-0 left-0 right-0 border-t bg-white">
            <div className="p-4">{footer}</div>
          </div>
        ) : null}
      </div>

      <style jsx>{`
        @media (min-width: 768px) {
          div.${widthClass.replace(" ", ".")} {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

/* ============================================================================ */
/* Page */
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
  const [qDebounced, setQDebounced] = useState("");
  const [onlyActive, setOnlyActive] = useState(false);
  const [sellableOnly, setSellableOnly] = useState(false);
  const [producedOnly, setProducedOnly] = useState(false);
  const [categoryIdFilter, setCategoryIdFilter] = useState("");
  const [filtersOpenMobile, setFiltersOpenMobile] = useState(false);

  // create drawer
  const [createOpen, setCreateOpen] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const [categoryId, setCategoryId] = useState<string>("");

  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");

  const [tagsRaw, setTagsRaw] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [yieldQty, setYieldQty] = useState("1");
  const [yieldUnit, setYieldUnit] = useState<Unit>("UNIT");

  const [wastePct, setWastePct] = useState("0");
  const [extraCost, setExtraCost] = useState("0");
  const [packagingCost, setPackagingCost] = useState("0");

  const [currency, setCurrency] = useState<Currency>("ARS");

  const [salePrice, setSalePrice] = useState("");
  const [marginPct, setMarginPct] = useState("0.3");

  const [isSellable, setIsSellable] = useState(true);
  const [isProduced, setIsProduced] = useState(true);

  // item adder (GLOBAL search: ingredients + preparations)
  const [addPickId, setAddPickId] = useState<string>("");
  const [addQty, setAddQty] = useState<string>("1");
  const [addNote, setAddNote] = useState<string>("");
  const [addSearch, setAddSearch] = useState<string>("");
  const [itemsDraft, setItemsDraft] = useState<ProductItemDraft[]>([]);

  // details / edit drawer
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  // edit drafts
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

  // debounce q
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

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
    const supplierNameById = new Map(
      activeSuppliers.map((s) => [s.id, s.name])
    );

    const ing = activeIngredients.map((i) => {
      const sup = i.supplierId ? supplierNameById.get(i.supplierId) : null;
      return {
        id: `I:${i.id}`,
        kind: "INGREDIENT" as const,
        refId: i.id,
        label: `${i.name} · ${unitLabel(i.unit)}${sup ? ` · ${sup}` : ""}`,
        search: `${i.name} ${i.id} ${i.supplierId ?? ""} ${
          sup ?? ""
        }`.toLowerCase(),
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

  const editAddOptions = useMemo(() => {
    const supplierNameById = new Map(
      activeSuppliers.map((s) => [s.id, s.name])
    );

    const ing = activeIngredients.map((i) => {
      const sup = i.supplierId ? supplierNameById.get(i.supplierId) : null;
      return {
        id: `I:${i.id}`,
        kind: "INGREDIENT" as const,
        refId: i.id,
        label: `${i.name} · ${unitLabel(i.unit)}${sup ? ` · ${sup}` : ""}`,
        search: `${i.name} ${i.id} ${i.supplierId ?? ""} ${
          sup ?? ""
        }`.toLowerCase(),
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

  /* ============================================================================ */
  /* Loaders */

  const loadLookups = useCallback(async () => {
    const [cats, sups, ings, preps] = await Promise.all([
      apiFetchAuthed<Category[]>(
        getAccessToken,
        `/categories?onlyActive=false`
      ),
      apiFetchAuthed<Supplier[]>(getAccessToken, `/suppliers`),
      apiFetchAuthed<Ingredient[]>(getAccessToken, `/ingredients`),
      apiFetchAuthed<Preparation[]>(getAccessToken, `/preparations`),
    ]);

    setCategories(cats);
    setSuppliers(sups);
    setIngredients(ings);
    setPreparations(preps);

    // default category for create
    if (!categoryId && cats?.length) {
      const first = cats.find((c) => c.isActive !== false) || cats[0];
      if (first) setCategoryId(first.id);
    }
  }, [getAccessToken, categoryId]);

  const loadProducts = useCallback(async () => {
    // Si agregás produced al backend: descomentá produced
    const qs = toQS({
      onlyActive: onlyActive ? "true" : undefined,
      sellable: sellableOnly ? "true" : undefined,
      // produced: producedOnly ? "true" : undefined,
      categoryId: categoryIdFilter || undefined,
      q: qDebounced.trim() || undefined,
    });

    const list = await apiFetchAuthed<Product[]>(
      getAccessToken,
      `/products${qs}`
    );

    // Si NO agregaste produced al backend, filtralo acá (solo este):
    const final = producedOnly ? list.filter((p) => p.isProduced) : list;

    setProducts(final);
  }, [
    getAccessToken,
    onlyActive,
    sellableOnly,
    producedOnly,
    categoryIdFilter,
    qDebounced,
  ]);

  async function refreshAll() {
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      await loadLookups();
      await loadProducts();
      setOk("Datos actualizados ✔");
      setTimeout(() => setOk(null), 1500);
    } catch (e: any) {
      setErr(e?.message || "Error cargando datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // primera carga
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recargar productos cuando cambian filtros (server-side)
  useEffect(() => {
    // evitamos disparar antes de la primera carga completa
    // si querés, podés usar un flag "lookupsLoaded"
    loadProducts().catch((e: any) =>
      setErr(e?.message || "Error cargando productos")
    );
  }, [loadProducts]);

  /* ============================================================================ */
  /* Create actions */
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

      // reset
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
      setTimeout(() => setOk(null), 1200);

      await loadProducts(); // ✅ solo productos
      setCreateOpen(false);
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
          : `¿Desactivar "${p.name}"?\n\nNo aparecerá si filtrás solo activos.`
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

      await loadProducts(); // ✅ solo productos

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

      await loadProducts(); // ✅ solo productos
      setOk("Recalculado ✔");
      setTimeout(() => setOk(null), 1000);
    } catch (e: any) {
      setErr(e?.message || "Error recalculando");
    } finally {
      setBusy(false);
    }
  }

  /* ============================================================================ */
  /* Details / Edit (solo cambié el post-save a loadProducts) */
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

    if (!editItemsDraft.length) {
      setErr("Agregá al menos 1 item.");
      return;
    }

    const payload = {
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
      setTimeout(() => setOk(null), 1000);

      await loadProducts(); // ✅ solo productos

      // refrescar selected
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

  /* ============================================================================ */
  /* Preview cost for create (client-side approx) - ALINEADO AL BACKEND */
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

    // ✅ Igual que backend: unitCost / (1 - margin)
    const suggestedPrice =
      sp != null ? null : m != null && m < 1 ? unitCost / (1 - m) : null;

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

  /* ============================================================================ */
  /* UI: acá podés dejar tu UI tal cual; solo cambiá:
     - botón Actualizar => refreshAll()
     - en list no uses filteredProducts (server-side ya filtra)
  */

  const listToRender = products; // ✅ ya viene filtrado por backend (+ producedOnly si no lo agregaste)

  /* ============================
   * TODO: pegá acá tu UI original
   * Reemplazos puntuales:
   * - loadAll() -> refreshAll()
   * - filteredProducts -> listToRender
   * - botón "Actualizar" -> refreshAll
   * ============================ */

  return (
    <AdminProtected>
      <div className="space-y-6 text-zinc-500">
        {/* Top bar */}
        <div className="sticky top-0 z-30 -mx-4 border-b bg-white/80 px-4 py-3 backdrop-blur md:mx-0 md:rounded-2xl md:border md:border-zinc-200 md:shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-zinc-500">Admin</div>
              <div className="truncate text-lg font-semibold text-zinc-900">
                Productos
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">
                Filtros server-side · Preview alineado · Conexión authed
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setFiltersOpenMobile((v) => !v)}
                className="md:hidden"
              >
                {filtersOpenMobile ? (
                  <PanelRightClose className="h-4 w-4" />
                ) : (
                  <PanelRightOpen className="h-4 w-4" />
                )}
                Filtros
              </Button>

              <Button
                variant="secondary"
                onClick={refreshAll}
                loading={loading}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </span>
              </Button>

              <Button onClick={() => setCreateOpen(true)} disabled={busy}>
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Nuevo
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

        {/* Filters (tu bloque igual) */}
        <div
          className={cn(
            "rounded-2xl border border-zinc-200 bg-white p-4",
            "md:block",
            filtersOpenMobile ? "block" : "hidden md:block"
          )}
        >
          <div className="grid gap-3 lg:grid-cols-[260px_260px_1fr_auto_auto_auto] lg:items-center">
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

        {/* List: acá reemplazás filteredProducts por listToRender */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="hidden md:block">
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
                {listToRender.map((p) => {
                  const catLabel =
                    p.categoryName ||
                    (p.categoryId
                      ? activeCategories.find((c) => c.id === p.categoryId)
                          ?.name
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
                        <div className="font-semibold text-zinc-900">
                          {p.name}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          Yield: <b>{p.yieldQty}</b> {unitLabel(p.yieldUnit)} ·
                          Items: <b>{p.items?.length ?? 0}</b>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-sm">{catLabel}</td>

                      <td className="px-4 py-3 text-sm">
                        <div className="font-semibold text-zinc-900">
                          {money(unitCost, ccy)}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Total: {money(totalCost, ccy)}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-sm">
                        <div className="font-semibold text-zinc-900">
                          {price}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Margen: {gm}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <StatusPill active={p.isActive} />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            variant="secondary"
                            onClick={() => openDetails(p)}
                            disabled={busy}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Layers className="h-4 w-4" />
                              Editar{" "}
                            </span>
                          </Button>

                          <Button
                            variant="secondary"
                            onClick={() => recompute(p)}
                            disabled={busy}
                          >
                            <span className="inline-flex items-center gap-2">
                              <RotateCcw className="h-4 w-4" />
                              Recalcular{" "}
                            </span>
                          </Button>

                          <Button
                            variant={p.isActive ? "danger" : "secondary"}
                            onClick={() => toggleActive(p)}
                            disabled={busy}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Power className="h-4 w-4" />
                              {p.isActive ? "Desactivar" : "Reactivar"}{" "}
                            </span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!loading && listToRender.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-sm text-zinc-500"
                    >
                      No hay productos para mostrar.
                    </td>
                  </tr>
                )}

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
              </tbody>
            </table>
          </div>

          {/* Mobile lo podés adaptar igual: usar listToRender */}
        </div>

        <div className="text-xs text-zinc-500">
          Mostrando <b>{listToRender.length}</b> productos.
        </div>

        {/* Create Drawer: reutilizá tu CreateContent/CreateFooter original,
            no lo re-pego para no hacerte infinito el snippet. */}
        <Drawer
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Crear producto"
          subtitle="Nuevo"
          widthClass="max-w-4xl"
          footer={
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setCreateOpen(false)}
                  disabled={busy}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={create}
                  disabled={busy || !name.trim() || itemsDraft.length === 0}
                >
                  <Plus className="h-4 w-4" />
                  Crear producto
                </Button>
              </div>
            </div>
          }
        >
          {/* Pegá acá tu CreateContent original (ya lo tenés) */}
          {/* Importante: preview.suggestedPrice ya está alineado */}
          <div className="text-sm text-zinc-500">
            Pegá acá tu CreateContent (no lo duplico para no hacerte 1000
            líneas).
          </div>
        </Drawer>

        {/* Edit Drawer: dejalo igual, solo ya cambiamos saveEdits/loadProducts */}
      </div>
    </AdminProtected>
  );
}
