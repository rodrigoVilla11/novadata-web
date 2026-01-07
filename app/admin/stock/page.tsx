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
  AlertTriangle,
  CheckCircle2,
  Boxes,
  ListOrdered,
  PlusCircle,
  Filter,
  ShoppingCart,
  Truck,
  X,
  ClipboardList,
  Eye,
} from "lucide-react";

/* =============================================================================
 * Helpers
 * ========================================================================== */

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function num(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function isValidNumberDraft(v: string) {
  return v === "" || /^[0-9]*([.][0-9]*)?$/.test(v);
}

function looksForbidden(msg: string) {
  const m = (msg || "").toLowerCase();
  return (
    m.includes("forbidden") ||
    m.includes("sin permisos") ||
    m.includes("prohibido")
  );
}

function fmtDateTimeAR(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR");
  } catch {
    return String(iso);
  }
}

function Pill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "neutral";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone === "ok" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-800",
        tone === "bad" && "border-rose-200 bg-rose-50 text-rose-700",
        tone === "neutral" && "border-zinc-200 bg-white text-zinc-700"
      )}
    >
      {children}
    </span>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "ok" | "warn";
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-2 text-sm",
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700"
          : tone === "warn"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      )}
    >
      <span className="inline-flex items-center gap-2">
        {tone === "error" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : tone === "warn" ? (
          <AlertTriangle className="h-4 w-4" />
        ) : (
          <CheckCircle2 className="h-4 w-4" />
        )}
        {children}
      </span>
    </div>
  );
}

function money(n: number, currency: "ARS" | "USD" = "ARS") {
  const v = Number(n ?? 0) || 0;
  try {
    return v.toLocaleString("es-AR", { style: "currency", currency });
  } catch {
    return v.toLocaleString("es-AR");
  }
}

/* =============================================================================
 * Types (API)
 * ========================================================================== */

type Unit = string;

type StockMovementType = "IN" | "OUT" | "ADJUST" | "REVERSAL";
type StockMovementReason =
  | "SALE"
  | "PURCHASE"
  | "WASTE"
  | "MANUAL"
  | "INITIAL"
  | "RETURN"
  | "TRANSFER";

type StockMovementRow = {
  id: string;
  dateKey: string;
  type: StockMovementType;
  reason: StockMovementReason;
  refType: string | null;
  refId: string | null;
  ingredientId: string | null;
  unit: Unit | null;
  qty: number;
  note: string | null;
  userId: string | null;
  createdAt: string;
};

type StockBalanceRow = {
  ingredientId: string;
  unit: Unit;
  qty: number;
  lastAt: string | null;
};

type SupplierLite = { id: string; name: string; isActive: boolean };

type IngredientLite = {
  id: string;
  name: string;
  displayName?: string | null;
  baseUnit?: Unit | null;
  isActive?: boolean;

  // stock.*
  trackStock?: boolean;
  minQty?: number;
  idealQty?: number | null;
  storageLocation?: string | null;

  // ✅ needed for ordering from stock
  supplierId?: string | null;
  supplierName?: string | null;
  name_for_supplier?: string | null;

  // optional costs (to show approx)
  lastCost?: number;
  currency?: "ARS" | "USD";
};

type StockSnapshot = {
  id: string;
  dateKey: string;
  supplierId: string;
  items: { productId: string; qty: number }[];
  createdAt?: string;
  updatedAt?: string;
};

/* =============================================================================
 * Page
 * ========================================================================== */

export default function AdminStockPage() {
  const { getAccessToken, user } = useAuth();

  const roles = (user?.roles ?? []).map((r: any) => String(r).toUpperCase());
  const isAdmin = roles.includes("ADMIN");
  const isManager = roles.includes("MANAGER");
  const canWrite = isAdmin || isManager;

  const [tab, setTab] = useState<"balance" | "movements" | "snapshots">(
    "balance"
  );
  const [dateKey, setDateKey] = useState(todayKeyArgentina());

  const [ingredients, setIngredients] = useState<IngredientLite[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);
  const [balances, setBalances] = useState<StockBalanceRow[]>([]);
  const [movements, setMovements] = useState<StockMovementRow[]>([]);

  // snapshots
  const [snapshots, setSnapshots] = useState<StockSnapshot[]>([]);
  const [snapSupplierId, setSnapSupplierId] = useState<string>(""); // filtro opcional
  const [snapQ, setSnapQ] = useState<string>(""); // busca ingrediente dentro de snapshot (por nombre)
  const [snapOpenId, setSnapOpenId] = useState<string>(""); // row expand

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // balance filters
  const [balanceQ, setBalanceQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  // movements filters
  const [movIngredientId, setMovIngredientId] = useState<string>("");
  const [movRefType, setMovRefType] = useState<string>("");
  const [movRefId, setMovRefId] = useState<string>("");
  const [movLimit, setMovLimit] = useState("200");

  // manual movement form
  const [manualType, setManualType] = useState<StockMovementType>("IN");
  const [manualReason, setManualReason] =
    useState<StockMovementReason>("MANUAL");
  const [manualIngredientId, setManualIngredientId] = useState<string>("");
  const [manualQty, setManualQty] = useState("1");
  const [manualUnit, setManualUnit] = useState<Unit>("UNIT");
  const [manualNote, setManualNote] = useState("");

  // --------------------------
  // 🛒 Cart (orders by supplier)
  // --------------------------
  type CartItem = {
    ingredientId: string;
    ingredientName: string;
    supplierId: string;
    supplierName: string;
    unit: Unit;
    qty: string; // draft
    suggested: number;
    note?: string | null;
    name_for_supplier?: string | null;
    approxUnitCost?: number;
    currency?: "ARS" | "USD";
  };

  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<Record<string, CartItem>>({}); // key ingredientId::supplierId

  const cartList = useMemo(() => Object.values(cart), [cart]);

  const cartBySupplier = useMemo(() => {
    const m = new Map<
      string,
      { supplierId: string; supplierName: string; items: CartItem[] }
    >();
    for (const it of cartList) {
      const key = it.supplierId;
      const prev = m.get(key);
      if (!prev)
        m.set(key, {
          supplierId: it.supplierId,
          supplierName: it.supplierName,
          items: [it],
        });
      else prev.items.push(it);
    }
    // proveedor alfabetico
    return Array.from(m.values()).sort((a, b) =>
      a.supplierName.localeCompare(b.supplierName)
    );
  }, [cartList]);

  const cartTotals = useMemo(() => {
    let lines = 0;
    let approxARS = 0;
    let approxUSD = 0;

    for (const it of cartList) {
      const q = num(it.qty);
      if (q > 0 && Number.isFinite(q)) {
        lines += 1;
        const u = num(it.approxUnitCost);
        const c = it.currency ?? "ARS";
        const line = u > 0 ? u * q : 0;
        if (c === "USD") approxUSD += line;
        else approxARS += line;
      }
    }
    return { suppliers: cartBySupplier.length, lines, approxARS, approxUSD };
  }, [cartList, cartBySupplier.length]);

  function cartKey(ingredientId: string, supplierId: string) {
    return `${ingredientId}::${supplierId}`;
  }

  function upsertCartItem(it: CartItem) {
    setCart((prev) => ({
      ...prev,
      [cartKey(it.ingredientId, it.supplierId)]: it,
    }));
  }

  function removeCartItem(ingredientId: string, supplierId: string) {
    const key = cartKey(ingredientId, supplierId);
    setCart((prev) => {
      const cp = { ...prev };
      delete cp[key];
      return cp;
    });
  }

  function clearCart() {
    setCart({});
  }

  // ---------------- derived ----------------

  const supplierById = useMemo(() => {
    const m = new Map<string, SupplierLite>();
    for (const s of suppliers) m.set(s.id, s);
    return m;
  }, [suppliers]);

  const ingById = useMemo(() => {
    const m = new Map<string, IngredientLite>();
    for (const it of ingredients) m.set(it.id, it);
    return m;
  }, [ingredients]);

  const activeIngredients = useMemo(
    () =>
      ingredients.filter((i) => i.isActive !== false && i.trackStock !== false),
    [ingredients]
  );

  const filteredBalances = useMemo(() => {
    const q = balanceQ.trim().toLowerCase();
    let rows = balances.slice();

    if (q) {
      rows = rows.filter((r) => {
        const ing = ingById.get(r.ingredientId);
        const name = ((ing?.displayName || ing?.name) ?? "").toLowerCase();
        const supplier = ((ing?.supplierName || "") ?? "").toLowerCase();
        return (
          r.ingredientId.toLowerCase().includes(q) ||
          name.includes(q) ||
          supplier.includes(q) ||
          String(r.unit || "").toLowerCase().includes(q)
        );
      });
    }

    if (onlyLow) {
      rows = rows.filter((r) => {
        const ing = ingById.get(r.ingredientId);
        const minQty = Number(ing?.minQty ?? 0) || 0;
        return minQty > 0 && num(r.qty) < minQty;
      });
    }

    // ✅ pedido: SIEMPRE orden alfabético por ingrediente (sin “bajos primero”)
    rows.sort((a, b) => {
      const ia = ingById.get(a.ingredientId);
      const ib = ingById.get(b.ingredientId);
      const na = (ia?.displayName || ia?.name || a.ingredientId).toLowerCase();
      const nb = (ib?.displayName || ib?.name || b.ingredientId).toLowerCase();
      if (na !== nb) return na.localeCompare(nb);
      return String(a.unit || "").localeCompare(String(b.unit || ""));
    });

    return rows;
  }, [balances, balanceQ, onlyLow, ingById]);

  const activeSuppliers = useMemo(
    () => suppliers.filter((s) => s.isActive !== false),
    [suppliers]
  );

  const filteredSnapshots = useMemo(() => {
    let rows = snapshots.slice();

    if (snapSupplierId.trim()) {
      rows = rows.filter((s) => String(s.supplierId) === snapSupplierId.trim());
    }

    // ordenar por proveedor y luego por updatedAt desc
    rows.sort((a, b) => {
      const sa =
        (supplierById.get(a.supplierId)?.name || a.supplierId || "").toLowerCase();
      const sb =
        (supplierById.get(b.supplierId)?.name || b.supplierId || "").toLowerCase();
      if (sa !== sb) return sa.localeCompare(sb);

      const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return ub - ua;
    });

    return rows;
  }, [snapshots, snapSupplierId, supplierById]);

  function getSupplierLabelById(supplierId?: string | null) {
    if (!supplierId) return "—";
    return supplierById.get(String(supplierId))?.name || String(supplierId);
  }

  function getSupplierLabel(ing: IngredientLite) {
    const sid = ing.supplierId;
    if (!sid) return "— Sin proveedor —";
    const fromIng = (ing.supplierName || "").trim();
    if (fromIng) return fromIng;
    const s = supplierById.get(sid);
    return s?.name || sid;
  }

  function computeSuggestedQty(balanceRow: StockBalanceRow) {
    const ing = ingById.get(balanceRow.ingredientId);
    const onHand = num(balanceRow.qty);
    const minQty = Number(ing?.minQty ?? 0) || 0;
    const idealQty = Number(ing?.idealQty ?? 0) || 0;

    const target = minQty > 0 ? minQty : idealQty > 0 ? idealQty : 0;
    if (target <= 0) return 0;

    const need = Math.max(0, target - onHand);
    return Number.isFinite(need) ? need : 0;
  }

  function addToCartFromRow(r: StockBalanceRow) {
    const ing = ingById.get(r.ingredientId);
    if (!ing) return;

    const supplierId = String(ing.supplierId ?? "").trim();
    if (!supplierId) {
      setErr(
        "Este ingrediente no tiene supplierId asignado. Asignalo para poder pedir."
      );
      return;
    }

    const supplierName = getSupplierLabel(ing);
    const suggested = computeSuggestedQty(r);
    const unit = (ing.baseUnit ?? r.unit ?? "UNIT") as Unit;

    const item: CartItem = {
      ingredientId: ing.id,
      ingredientName: ing.displayName || ing.name || ing.id,
      supplierId,
      supplierName,
      unit,
      qty: suggested > 0 ? String(suggested) : "1",
      suggested,
      note: null,
      name_for_supplier: ing.name_for_supplier ?? null,
      approxUnitCost: num(ing.lastCost),
      currency: ing.currency ?? "ARS",
    };

    upsertCartItem(item);
    setCartOpen(true);
    setOk("Agregado al pedido ✔");
    setTimeout(() => setOk(null), 900);
  }

  /* ---------------- loaders ---------------- */

  async function loadSuppliersMaybe() {
    try {
      const rows = await apiFetchAuthed<any[]>(getAccessToken, "/suppliers");
      const norm = (rows ?? []).map((r: any) => ({
        id: String(r.id ?? r._id ?? ""),
        name: String(r.name ?? "").trim(),
        isActive: r.isActive ?? true,
      }));
      setSuppliers(norm);
    } catch {
      setSuppliers([]);
    }
  }

  async function loadIngredientsMaybe() {
    try {
      const rows = await apiFetchAuthed<any[]>(getAccessToken, "/ingredients");

      const norm = (rows ?? []).map((r: any) => {
        const id = String(r.id ?? r._id ?? "");
        const name = String(r.displayName ?? r.name ?? "").trim();
        const baseUnit = (r.baseUnit ?? r.unit ?? "UNIT") as Unit;

        const stock = r.stock ?? {};
        const minQty = Number(stock.minQty ?? r.minQty ?? 0) || 0;

        const supplierId =
          String(r.supplierId ?? r.supplier?.id ?? r.supplier?._id ?? "").trim() ||
          null;

        const supplierName =
          String(r.supplierName ?? r.supplier?.name ?? "").trim() || null;

        const cost = r.cost ?? {};
        const lastCost = Number(cost.lastCost ?? r.lastCost ?? 0) || 0;
        const currency = (cost.currency ?? r.currency ?? "ARS") as "ARS" | "USD";

        return {
          id,
          name: name || id,
          displayName: r.displayName ?? null,
          baseUnit,
          isActive: r.isActive ?? true,

          trackStock: stock.trackStock ?? r.trackStock ?? true,
          minQty,
          idealQty: stock.idealQty ?? r.idealQty ?? null,
          storageLocation: stock.storageLocation ?? r.storageLocation ?? null,

          supplierId,
          supplierName,
          name_for_supplier: r.name_for_supplier ?? null,

          lastCost,
          currency,
        } satisfies IngredientLite;
      });

      setIngredients(norm);
    } catch {
      setIngredients([]);
    }
  }

  async function loadBalances() {
    const rows = await apiFetchAuthed<StockBalanceRow[]>(
      getAccessToken,
      "/stock/balances"
    );
    setBalances(rows ?? []);
  }

  async function loadMovements() {
    const qs = new URLSearchParams();
    qs.set("dateKey", dateKey);
    if (movIngredientId.trim()) qs.set("ingredientId", movIngredientId.trim());
    if (movRefType.trim()) qs.set("refType", movRefType.trim());
    if (movRefId.trim()) qs.set("refId", movRefId.trim());
    if (movLimit.trim()) qs.set("limit", movLimit.trim());

    const rows = await apiFetchAuthed<StockMovementRow[]>(
      getAccessToken,
      `/stock/movements?${qs.toString()}`
    );
    setMovements(rows ?? []);
  }

  // ✅ snapshots: acepta array (getMany) o single (getOne) según tu controller
  async function loadSnapshots() {
    const qs = new URLSearchParams();
    qs.set("dateKey", dateKey);
    if (snapSupplierId.trim()) qs.set("supplierId", snapSupplierId.trim());

    const res = await apiFetchAuthed<any>(
      getAccessToken,
      `/stock-snapshots?${qs.toString()}`
    );

    const list: StockSnapshot[] = Array.isArray(res)
      ? res
      : res
      ? [res]
      : [];

    setSnapshots(
      list.map((s: any) => ({
        id: String(s.id ?? s._id ?? ""),
        dateKey: String(s.dateKey ?? ""),
        supplierId: String(s.supplierId ?? ""),
        items: (s.items ?? []).map((it: any) => ({
          productId: String(it.productId ?? it.ingredientId ?? ""),
          qty: num(it.qty),
        })),
        createdAt: s.createdAt ?? null,
        updatedAt: s.updatedAt ?? null,
      }))
    );
  }

  async function loadAll() {
    setErr(null);
    setOk(null);
    setLoading(true);

    try {
      await Promise.all([loadSuppliersMaybe(), loadIngredientsMaybe()]);
      await Promise.all([loadBalances(), loadMovements(), loadSnapshots()]);
      setOk("Datos actualizados ✔");
      setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      const msg = String(e?.message || "Error cargando stock");
      setErr(looksForbidden(msg) ? "Sin permisos para Stock." : msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  /* ---------------- actions ---------------- */

  async function refresh() {
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      await Promise.all([loadSuppliersMaybe(), loadIngredientsMaybe()]);
      await Promise.all([loadBalances(), loadMovements(), loadSnapshots()]);
      setOk("Actualizado ✔");
      setTimeout(() => setOk(null), 1000);
    } catch (e: any) {
      setErr(String(e?.message || "Error actualizando"));
    } finally {
      setBusy(false);
    }
  }

  async function applyManual() {
    if (!canWrite) {
      setErr("Solo ADMIN / MANAGER puede aplicar movimientos manuales.");
      return;
    }

    const ingredientId = manualIngredientId.trim();
    if (!ingredientId) {
      setErr("Elegí un ingrediente.");
      return;
    }

    const qty = num(manualQty);
    if (!Number.isFinite(qty) || qty === 0) {
      setErr("Qty debe ser un número distinto de 0.");
      return;
    }

    if (manualType !== "ADJUST" && qty <= 0) {
      setErr("Para IN/OUT la qty debe ser > 0.");
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      await apiFetchAuthed(getAccessToken, "/stock/manual", {
        method: "POST",
        body: JSON.stringify({
          dateKey,
          type: manualType,
          reason: manualReason,
          refType: "MANUAL",
          refId: null,
          items: [
            {
              ingredientId,
              qty: manualType === "ADJUST" ? qty : Math.abs(qty),
              unit: manualUnit,
              note: manualNote || null,
            },
          ],
          note: manualNote || null,
          userId: user?.id ?? null,
        }),
      });

      setOk("Movimiento aplicado ✔");
      setTimeout(() => setOk(null), 1200);

      setManualQty("1");
      setManualNote("");

      await Promise.all([loadBalances(), loadMovements(), loadSnapshots()]);
    } catch (e: any) {
      setErr(String(e?.message || "Error aplicando movimiento"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmOrders() {
    if (!canWrite) {
      setErr("Solo ADMIN / MANAGER puede confirmar pedidos.");
      return;
    }

    if (cartBySupplier.length === 0) return;

    for (const g of cartBySupplier) {
      const valid = g.items.some((it) => num(it.qty) > 0);
      if (!valid) {
        setErr(`El proveedor "${g.supplierName}" no tiene cantidades válidas.`);
        return;
      }
    }

    setBusy(true);
    setErr(null);
    try {
      for (const g of cartBySupplier) {
        const itemsPayload = g.items
          .map((it) => ({
            ingredientId: it.ingredientId,
            qty: num(it.qty),
          }))
          .filter((x) => x.ingredientId && Number.isFinite(x.qty) && x.qty > 0);

        if (!itemsPayload.length) continue;

        await apiFetchAuthed(getAccessToken, "/purchase-orders", {
          method: "POST",
          body: JSON.stringify({
            supplierId: g.supplierId,
            notes: `Creado desde Stock (${dateKey})`,
            items: itemsPayload,
          }),
        });
      }

      setOk("Pedidos creados ✔");
      setTimeout(() => setOk(null), 1200);

      clearCart();
      setCartOpen(false);
    } catch (e: any) {
      setErr(String(e?.message || "Error confirmando pedidos"));
    } finally {
      setBusy(false);
    }
  }

  /* =============================================================================
   * UI
   * ========================================================================== */

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                  Stock
                </h1>

                <Button
                  variant="secondary"
                  onClick={() => setCartOpen(true)}
                  disabled={loading}
                >
                  <span className="inline-flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" />
                    Pedido ({cartTotals.lines})
                  </span>
                </Button>
              </div>

              <p className="mt-1 text-sm text-zinc-500">
                Balance por ingrediente + auditoría de movimientos + snapshots del
                conteo diario.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                    tab === "balance"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  )}
                  onClick={() => setTab("balance")}
                >
                  <Boxes className="h-4 w-4" />
                  Balance
                </button>

                <button
                  type="button"
                  className={cn(
                    "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                    tab === "movements"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  )}
                  onClick={() => setTab("movements")}
                >
                  <ListOrdered className="h-4 w-4" />
                  Movimientos
                </button>

                <button
                  type="button"
                  className={cn(
                    "h-10 rounded-xl border px-3 text-sm font-semibold inline-flex items-center gap-2",
                    tab === "snapshots"
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                  )}
                  onClick={() => setTab("snapshots")}
                >
                  <ClipboardList className="h-4 w-4" />
                  Snapshots
                </button>

                {onlyLow && tab === "balance" && (
                  <Pill tone="warn">Mostrando solo bajos</Pill>
                )}
              </div>
            </div>

            <div className="min-w-[280px]">
              <Field label="Fecha">
                <Input
                  type="date"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                  disabled={busy || loading}
                />
              </Field>

              <div className="mt-3 flex gap-2">
                <Button
                  variant="secondary"
                  onClick={refresh}
                  loading={busy || loading}
                >
                  <RefreshCcw className="h-4 w-4" />
                  Actualizar
                </Button>
              </div>
            </div>
          </div>

          {(err || ok) && (
            <div className="mt-4 grid gap-2">
              {err && <Notice tone="error">{err}</Notice>}
              {!err && ok && <Notice tone="ok">{ok}</Notice>}
            </div>
          )}
        </div>

        {/* 🛒 Cart Drawer */}
        {cartOpen && (
          <div className="fixed inset-0 z-50">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setCartOpen(false)}
            />

            <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <div className="text-xs text-zinc-500">Pedido desde Stock</div>
                  <div className="text-lg font-semibold text-zinc-900">
                    Carrito ({cartTotals.lines} ítem/s · {cartTotals.suppliers}{" "}
                    proveedor/es)
                  </div>
                  <div className="text-sm text-zinc-600">
                    Aproximado: <b>{money(cartTotals.approxARS, "ARS")}</b>
                    {cartTotals.approxUSD > 0 && (
                      <>
                        {" "}
                        · <b>{money(cartTotals.approxUSD, "USD")}</b>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={clearCart}
                    disabled={busy || cartList.length === 0}
                  >
                    Vaciar
                  </Button>
                  <Button variant="secondary" onClick={() => setCartOpen(false)}>
                    <X className="h-4 w-4" />
                    Cerrar
                  </Button>
                </div>
              </div>

              <div className="h-[calc(100%-64px)] overflow-y-auto p-5 space-y-6">
                {cartBySupplier.length === 0 ? (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
                    No hay ítems. En la tabla de Balance tocá{" "}
                    <b>“Agregar a pedido”</b>.
                  </div>
                ) : (
                  cartBySupplier.map((g) => (
                    <div
                      key={g.supplierId}
                      className="rounded-2xl border border-zinc-200 overflow-hidden"
                    >
                      <div className="flex items-center justify-between bg-zinc-50 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-zinc-500" />
                          <div className="font-semibold text-zinc-900">
                            {g.supplierName}
                          </div>
                          <div className="text-xs text-zinc-500">
                            ({g.items.length} ítem/s)
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead className="bg-white">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                                Ingrediente
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                                Cantidad
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                                Sugerido
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                                Aprox.
                              </th>
                              <th className="px-4 py-2" />
                            </tr>
                          </thead>

                          <tbody className="divide-y divide-zinc-100">
                            {g.items.map((it) => {
                              const q = num(it.qty);
                              const u = num(it.approxUnitCost);
                              const line = q > 0 && u > 0 ? q * u : 0;
                              const curr = it.currency ?? "ARS";

                              return (
                                <tr
                                  key={cartKey(it.ingredientId, it.supplierId)}
                                  className="hover:bg-zinc-50"
                                >
                                  <td className="px-4 py-3 text-sm">
                                    <div className="font-semibold text-zinc-900">
                                      {it.ingredientName}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                      {it.name_for_supplier
                                        ? `Prov: ${it.name_for_supplier} · `
                                        : ""}
                                      {it.ingredientId}
                                    </div>
                                  </td>

                                  <td className="px-4 py-3">
                                    <Input
                                      value={it.qty}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (!isValidNumberDraft(v)) return;
                                        upsertCartItem({ ...it, qty: v });
                                      }}
                                      placeholder="Ej: 30"
                                      inputMode="decimal"
                                    />
                                    <div className="mt-1 text-xs text-zinc-500">
                                      Unidad: <b>{it.unit}</b>
                                    </div>
                                  </td>

                                  <td className="px-4 py-3 text-sm text-zinc-700">
                                    {it.suggested > 0 ? it.suggested : "—"}
                                  </td>

                                  <td className="px-4 py-3 text-sm text-zinc-700">
                                    {line > 0 ? (
                                      <div>
                                        <div className="font-semibold text-zinc-900">
                                          {money(line, curr)}
                                        </div>
                                        <div className="text-xs text-zinc-500">
                                          {money(u, curr)} / {it.unit}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-zinc-500">—</span>
                                    )}
                                  </td>

                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      variant="secondary"
                                      onClick={() =>
                                        removeCartItem(
                                          it.ingredientId,
                                          it.supplierId
                                        )
                                      }
                                      disabled={busy}
                                    >
                                      Quitar
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-zinc-500">
                    Confirmar crea <b>1 pedido por proveedor</b> (estado DRAFT) en{" "}
                    <code>/purchase-orders</code>.
                  </div>

                  <Button
                    onClick={confirmOrders}
                    disabled={busy || cartBySupplier.length === 0 || !canWrite}
                  >
                    Confirmar pedidos
                  </Button>
                </div>

                {!canWrite && (
                  <div className="text-sm text-zinc-500">
                    Solo <b>ADMIN</b> / <b>MANAGER</b> puede confirmar pedidos.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BALANCE */}
        {tab === "balance" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader title="Filtros" subtitle="Buscar y alertas" />
                <CardBody>
                  <div className="grid gap-3">
                    <Field label="Buscar (ingrediente / id / unidad / proveedor)">
                      <Input
                        value={balanceQ}
                        onChange={(e) => setBalanceQ(e.target.value)}
                        placeholder="Ej: arroz, salmón, KG, fumeiga…"
                        disabled={busy || loading}
                      />
                    </Field>

                    <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-2">
                      <div className="text-sm">
                        <div className="font-semibold text-zinc-900 flex items-center gap-2">
                          <Filter className="h-4 w-4" />
                          Solo bajos
                        </div>
                        <div className="text-xs text-zinc-500">
                          Muestra ingredientes con qty &lt; minQty
                        </div>
                      </div>

                      <button
                        type="button"
                        className={cn(
                          "h-9 rounded-xl border px-3 text-sm font-semibold",
                          onlyLow
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50"
                        )}
                        onClick={() => setOnlyLow((v) => !v)}
                        disabled={busy || loading}
                      >
                        {onlyLow ? "ON" : "OFF"}
                      </button>
                    </div>

                    <div className="text-xs text-zinc-500">
                      Tip: usá el botón <b>Agregar</b> para armar el pedido.
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Resumen" subtitle="Conteos rápidos" />
                <CardBody>
                  {loading ? (
                    <div className="text-sm text-zinc-500">Cargando…</div>
                  ) : (
                    <div className="space-y-2 text-sm text-zinc-700">
                      <div className="flex items-center justify-between">
                        <span>Ingredientes balanceados</span>
                        <b>{balances.length}</b>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>En carrito</span>
                        <b>{cartTotals.lines}</b>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Proveedores en carrito</span>
                        <b>{cartTotals.suppliers}</b>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Snapshots (fecha)</span>
                        <b>{snapshots.length}</b>
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Carrito" subtitle="Confirmá pedidos" />
                <CardBody>
                  <div className="space-y-3">
                    <Button
                      variant="secondary"
                      onClick={() => setCartOpen(true)}
                      disabled={loading}
                      className="w-full"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Ver carrito ({cartTotals.lines})
                    </Button>

                    <div className="text-xs text-zinc-500">
                      Confirmar crea pedidos por proveedor. Después podés entrar a
                      Proveedores &gt; Pedidos para “ENVIADO / CONFIRMADO /
                      RECEPCIÓN”.
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">Balance</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Orden alfabético por ingrediente.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Ingrediente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Proveedor
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Unidad
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Mínimo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Sugerido
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Último mov.
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Pedido
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-100">
                    {loading && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-8 text-sm text-zinc-500"
                        >
                          Cargando…
                        </td>
                      </tr>
                    )}

                    {!loading && filteredBalances.length === 0 && (
                      <tr>
                        <td
                          colSpan={9}
                          className="px-4 py-10 text-sm text-zinc-500"
                        >
                          No hay resultados.
                        </td>
                      </tr>
                    )}

                    {!loading &&
                      filteredBalances.map((r) => {
                        const ing = ingById.get(r.ingredientId);
                        const name =
                          ing?.displayName || ing?.name || r.ingredientId;

                        const minQty = Number(ing?.minQty ?? 0) || 0;
                        const isLow = minQty > 0 && num(r.qty) < minQty;

                        const suggested = computeSuggestedQty(r);

                        const supplierName = ing ? getSupplierLabel(ing) : "—";
                        const supplierId = String(ing?.supplierId ?? "").trim();

                        const hasSupplier = Boolean(supplierId);

                        return (
                          <tr
                            key={`${r.ingredientId}::${r.unit}`}
                            className={cn(
                              "hover:bg-zinc-50",
                              isLow && "bg-rose-50 hover:bg-rose-50",
                              !hasSupplier && "opacity-60"
                            )}
                          >
                            <td className="px-4 py-3 text-sm">
                              <div className="font-semibold text-zinc-900">
                                {name}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {r.ingredientId}
                              </div>
                              {ing?.name_for_supplier && (
                                <div className="text-xs text-zinc-500">
                                  Prov: {ing.name_for_supplier}
                                </div>
                              )}
                            </td>

                            <td className="px-4 py-3 text-sm text-zinc-700">
                              <div className="font-semibold">{supplierName}</div>
                              <div className="text-xs text-zinc-500">
                                {supplierId || "—"}
                              </div>
                            </td>

                            <td className="px-4 py-3 text-sm text-zinc-700">
                              {r.unit}
                            </td>

                            <td className="px-4 py-3 text-sm">
                              <span
                                className={cn(
                                  "font-semibold",
                                  isLow ? "text-rose-700" : "text-zinc-900"
                                )}
                              >
                                {num(r.qty)}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-sm text-zinc-700">
                              {minQty > 0 ? minQty : "—"}
                            </td>

                            <td className="px-4 py-3 text-sm text-zinc-900">
                              {suggested > 0 ? (
                                <span className="font-semibold">{suggested}</span>
                              ) : (
                                <span className="text-zinc-500">—</span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-sm">
                              {minQty <= 0 ? (
                                <Pill tone="neutral">SIN MÍNIMO</Pill>
                              ) : isLow ? (
                                <Pill tone="bad">BAJO</Pill>
                              ) : (
                                <Pill tone="ok">OK</Pill>
                              )}
                            </td>

                            <td className="px-4 py-3 text-sm text-zinc-600">
                              {fmtDateTimeAR(r.lastAt)}
                            </td>

                            <td className="px-4 py-3">
                              <Button
                                variant="secondary"
                                disabled={busy || loading || !hasSupplier}
                                onClick={() => addToCartFromRow(r)}
                              >
                                <span className="inline-flex items-center gap-2">
                                  <ShoppingCart className="h-4 w-4" />
                                  Agregar
                                </span>
                              </Button>

                              {!hasSupplier && (
                                <div className="mt-1 text-xs text-amber-700">
                                  Sin proveedor asignado
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-zinc-100 px-5 py-4 text-xs text-zinc-500">
                Resultados: <b>{filteredBalances.length}</b> (de {balances.length})
              </div>
            </div>
          </div>
        )}

        {/* SNAPSHOTS */}
        {tab === "snapshots" && (
          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Stock Snapshots"
                subtitle="Conteos diarios guardados (por proveedor)"
              />
              <CardBody>
                <div className="grid gap-4 md:grid-cols-4">
                  <Field label="Proveedor">
                    <Select
                      value={snapSupplierId}
                      onChange={(e) => {
                        setSnapSupplierId(e.target.value);
                        setSnapOpenId("");
                      }}
                      disabled={busy || loading}
                    >
                      <option value="">— Todos —</option>
                      {activeSuppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Buscar ingrediente dentro del snapshot">
                    <Input
                      value={snapQ}
                      onChange={(e) => setSnapQ(e.target.value)}
                      placeholder="Ej: arroz, salmón…"
                      disabled={busy || loading}
                    />
                  </Field>

                  <div className="flex items-end">
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await loadSnapshots();
                          setOk("Snapshots actualizados ✔");
                          setTimeout(() => setOk(null), 900);
                        } catch (e: any) {
                          setErr(String(e?.message || "Error cargando snapshots"));
                        } finally {
                          setBusy(false);
                        }
                      }}
                      loading={busy || loading}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Recargar
                    </Button>
                  </div>

                  <div className="flex items-end justify-end text-xs text-zinc-500">
                    Total: <b className="ml-1">{filteredSnapshots.length}</b>
                  </div>
                </div>
              </CardBody>
            </Card>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Snapshots ({filteredSnapshots.length})
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Click en “Ver” para expandir items.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Proveedor
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        DateKey
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Items
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Actualizado
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-100">
                    {loading && (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-sm text-zinc-500">
                          Cargando…
                        </td>
                      </tr>
                    )}

                    {!loading && filteredSnapshots.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-sm text-zinc-500">
                          No hay snapshots para esta fecha/filtro.
                        </td>
                      </tr>
                    )}

                    {!loading &&
                      filteredSnapshots.map((s) => {
                        const open = snapOpenId === s.id;
                        const supplierName = getSupplierLabelById(s.supplierId);

                        // items filtrados por búsqueda
                        const q = snapQ.trim().toLowerCase();
                        const items = (s.items ?? []).filter((it) => {
                          if (!q) return true;
                          const ing = ingById.get(it.productId);
                          const name =
                            (ing?.displayName || ing?.name || it.productId) ?? "";
                          return (
                            it.productId.toLowerCase().includes(q) ||
                            name.toLowerCase().includes(q)
                          );
                        });

                        // orden alfabético por ingrediente (por nombre)
                        items.sort((a, b) => {
                          const ia = ingById.get(a.productId);
                          const ib = ingById.get(b.productId);
                          const na = (ia?.displayName || ia?.name || a.productId).toLowerCase();
                          const nb = (ib?.displayName || ib?.name || b.productId).toLowerCase();
                          return na.localeCompare(nb);
                        });

                        return (
                          <React.Fragment key={s.id}>
                            <tr className="hover:bg-zinc-50">
                              <td className="px-4 py-3 text-sm text-zinc-700">
                                <div className="font-semibold text-zinc-900">
                                  {supplierName}
                                </div>
                                <div className="text-xs text-zinc-500">
                                  {s.supplierId}
                                </div>
                              </td>

                              <td className="px-4 py-3 text-sm text-zinc-700">
                                <div className="font-semibold text-zinc-900">
                                  {s.dateKey}
                                </div>
                              </td>

                              <td className="px-4 py-3 text-sm text-zinc-700">
                                <b className="text-zinc-900">{s.items?.length ?? 0}</b>{" "}
                                <span className="text-xs text-zinc-500">ítem/s</span>
                              </td>

                              <td className="px-4 py-3 text-sm text-zinc-600">
                                {fmtDateTimeAR(s.updatedAt || s.createdAt || null)}
                              </td>

                              <td className="px-4 py-3 text-right">
                                <Button
                                  variant="secondary"
                                  onClick={() => setSnapOpenId(open ? "" : s.id)}
                                  disabled={busy}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <Eye className="h-4 w-4" />
                                    {open ? "Ocultar" : "Ver"}
                                  </span>
                                </Button>
                              </td>
                            </tr>

                            {open && (
                              <tr className="bg-white">
                                <td colSpan={5} className="px-4 py-4">
                                  <div className="rounded-2xl border border-zinc-200 overflow-hidden">
                                    <div className="bg-zinc-50 px-4 py-3 flex items-center justify-between">
                                      <div className="text-sm font-semibold text-zinc-900">
                                        Items ({items.length})
                                      </div>
                                      <div className="text-xs text-zinc-500">
                                        {q ? "Filtrado por búsqueda" : "Orden alfabético"}
                                      </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                      <table className="min-w-full">
                                        <thead className="bg-white">
                                          <tr>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                                              Ingrediente
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                                              Qty
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                                              Unidad
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                                              Mínimo
                                            </th>
                                          </tr>
                                        </thead>

                                        <tbody className="divide-y divide-zinc-100">
                                          {items.length === 0 && (
                                            <tr>
                                              <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                                                Sin items (o no matchea la búsqueda).
                                              </td>
                                            </tr>
                                          )}

                                          {items.map((it) => {
                                            const ing = ingById.get(it.productId);
                                            const name =
                                              ing?.displayName ||
                                              ing?.name ||
                                              it.productId;

                                            const unit =
                                              (ing?.baseUnit ?? "") || "—";
                                            const minQty = Number(ing?.minQty ?? 0) || 0;
                                            const low = minQty > 0 && num(it.qty) < minQty;

                                            return (
                                              <tr key={`${s.id}::${it.productId}`} className={cn(low && "bg-amber-50")}>
                                                <td className="px-4 py-2 text-sm">
                                                  <div className="font-semibold text-zinc-900">{name}</div>
                                                  <div className="text-xs text-zinc-500">{it.productId}</div>
                                                </td>
                                                <td className="px-4 py-2 text-sm">
                                                  <span className={cn("font-semibold", low ? "text-amber-700" : "text-zinc-900")}>
                                                    {num(it.qty)}
                                                  </span>
                                                </td>
                                                <td className="px-4 py-2 text-sm text-zinc-700">{unit}</td>
                                                <td className="px-4 py-2 text-sm text-zinc-700">
                                                  {minQty > 0 ? minQty : "—"}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-zinc-100 px-5 py-4 text-xs text-zinc-500">
                Tip: si no aparecen, revisá que tu backend tenga el GET que devuelve
                array cuando no pasás supplierId.
              </div>
            </div>
          </div>
        )}

        {/* MOVEMENTS */}
        {tab === "movements" && (
          <div className="space-y-4">
            {/* Filters */}
            <Card>
              <CardHeader
                title="Movimientos"
                subtitle="Auditoría por fecha + filtros"
              />
              <CardBody>
                <div className="grid gap-4 md:grid-cols-5">
                  <Field label="Ingrediente">
                    <Select
                      value={movIngredientId}
                      onChange={(e) => setMovIngredientId(e.target.value)}
                      disabled={busy || loading}
                    >
                      <option value="">— Todos —</option>
                      {activeIngredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.displayName || i.name} ({i.id})
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="refType">
                    <Input
                      value={movRefType}
                      onChange={(e) => setMovRefType(e.target.value)}
                      placeholder="SALE / PURCHASE / ..."
                      disabled={busy || loading}
                    />
                  </Field>

                  <Field label="refId">
                    <Input
                      value={movRefId}
                      onChange={(e) => setMovRefId(e.target.value)}
                      placeholder="id"
                      disabled={busy || loading}
                    />
                  </Field>

                  <Field label="Límite">
                    <Input
                      value={movLimit}
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) &&
                        setMovLimit(e.target.value)
                      }
                      disabled={busy || loading}
                    />
                  </Field>

                  <div className="flex items-end">
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await loadMovements();
                        } catch (e: any) {
                          setErr(
                            String(e?.message || "Error cargando movimientos")
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                      loading={busy || loading}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Aplicar filtros
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Manual */}
            <Card>
              <CardHeader
                title="Movimiento manual"
                subtitle="IN / OUT / ADJUST (ADMIN / MANAGER)"
              />
              <CardBody>
                <div className="grid gap-4 md:grid-cols-6">
                  <Field label="Tipo">
                    <Select
                      value={manualType}
                      onChange={(e) => setManualType(e.target.value as any)}
                      disabled={!canWrite || busy}
                    >
                      <option value="IN">IN (Ingreso)</option>
                      <option value="OUT">OUT (Egreso)</option>
                      <option value="ADJUST">ADJUST (Ajuste)</option>
                    </Select>
                  </Field>

                  <Field label="Razón">
                    <Select
                      value={manualReason}
                      onChange={(e) => setManualReason(e.target.value as any)}
                      disabled={!canWrite || busy}
                    >
                      <option value="MANUAL">MANUAL</option>
                      <option value="PURCHASE">PURCHASE</option>
                      <option value="WASTE">WASTE</option>
                      <option value="INITIAL">INITIAL</option>
                      <option value="RETURN">RETURN</option>
                      <option value="TRANSFER">TRANSFER</option>
                    </Select>
                  </Field>

                  <Field label="Ingrediente">
                    <Select
                      value={manualIngredientId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setManualIngredientId(id);
                        const ing = ingById.get(id);
                        const u = (ing?.baseUnit ?? "UNIT") as Unit;
                        setManualUnit(u);
                      }}
                      disabled={!canWrite || busy}
                    >
                      <option value="">— Elegir —</option>
                      {activeIngredients.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.displayName || i.name} ({i.id})
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label={manualType === "ADJUST" ? "Qty (signed)" : "Qty"}>
                    <Input
                      value={manualQty}
                      onChange={(e) =>
                        isValidNumberDraft(e.target.value) &&
                        setManualQty(e.target.value)
                      }
                      disabled={!canWrite || busy}
                      placeholder={
                        manualType === "ADJUST" ? "Ej: -2.5 / 3" : "Ej: 2.5"
                      }
                    />
                  </Field>

                  <Field label="Unidad">
                    <Input value={manualUnit} onChange={() => {}} disabled />
                  </Field>

                  <Field label="Nota">
                    <Input
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      placeholder="Opcional"
                      disabled={!canWrite || busy}
                    />
                  </Field>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <Button onClick={applyManual} disabled={!canWrite || busy}>
                    <PlusCircle className="h-4 w-4" />
                    Aplicar
                  </Button>

                  {!canWrite && (
                    <div className="text-sm text-zinc-500">
                      Solo <b>ADMIN</b> / <b>MANAGER</b>.
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-5 py-4">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Movimientos ({movements.length})
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Mostrando por dateKey (y filtros opcionales).
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Tipo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Razón
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Ingrediente
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Ref
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                        Nota
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-zinc-100">
                    {loading && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-sm text-zinc-500">
                          Cargando…
                        </td>
                      </tr>
                    )}

                    {!loading && movements.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-sm text-zinc-500">
                          No hay movimientos para esta fecha/filtros.
                        </td>
                      </tr>
                    )}

                    {!loading &&
                      movements.map((m) => {
                        const ing = m.ingredientId
                          ? ingById.get(m.ingredientId)
                          : null;
                        const name =
                          ing?.displayName ||
                          ing?.name ||
                          m.ingredientId ||
                          "—";

                        const tone =
                          m.type === "IN"
                            ? "ok"
                            : m.type === "OUT"
                            ? "bad"
                            : m.type === "ADJUST"
                            ? "warn"
                            : "neutral";

                        return (
                          <tr key={m.id} className="hover:bg-zinc-50">
                            <td className="px-4 py-3 text-sm text-zinc-600">
                              {fmtDateTimeAR(m.createdAt)}
                              <div className="text-xs text-zinc-400">
                                {m.dateKey}
                              </div>
                            </td>

                            <td className="px-4 py-3 text-sm">
                              <Pill tone={tone}>{m.type}</Pill>
                            </td>

                            <td className="px-4 py-3 text-sm text-zinc-700">
                              {m.reason}
                            </td>

                            <td className="px-4 py-3 text-sm">
                              <div className="font-semibold text-zinc-900">
                                {name}
                              </div>
                              {m.ingredientId ? (
                                <div className="text-xs text-zinc-500">
                                  {m.ingredientId}
                                </div>
                              ) : null}
                            </td>

                            <td className="px-4 py-3 text-sm text-zinc-900">
                              <span className="font-semibold">{num(m.qty)}</span>{" "}
                              <span className="text-xs text-zinc-500">
                                {m.unit ?? "—"}
                              </span>
                            </td>

                            <td className="px-4 py-3 text-sm text-zinc-700">
                              {m.refType || m.refId ? (
                                <div className="text-xs">
                                  <div>
                                    <b>{m.refType ?? "—"}</b>
                                  </div>
                                  <div className="text-zinc-500">
                                    {m.refId ?? "—"}
                                  </div>
                                </div>
                              ) : (
                                "—"
                              )}
                            </td>

                            <td className="px-4 py-3 text-sm text-zinc-700">
                              {m.note || "—"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-zinc-100 px-5 py-4 text-xs text-zinc-500">
                Tip: para reversas por venta, usá refType/refId en los movimientos y auditás fácil.
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminProtected>
  );
}
