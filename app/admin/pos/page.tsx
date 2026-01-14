"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";

import type {
  CustomerSnapshot,
  FinanceCategory,
  Fulfillment,
  PosCartItem,
  PosPaymentDraft,
  Product,
  SaleRow,
} from "@/lib/adminPos/types";

import {
  cn,
  isValidNumberDraft,
  looksForbidden,
  num,
  todayKeyArgentina,
} from "@/lib/adminPos/helpers";

import {
  fetchFinanceCategories,
  fetchProducts,
  fetchSalesByDateKey,
  patchVoidSale,
  postCreateOrder,
  postPosCheckout,
} from "@/lib/adminPos/api";

import SalesTable from "@/components/admin/pos/SalesTable";
import VoidSaleModal from "@/components/admin/pos/VoidSaleModal";
import { getUnitPrice } from "@/lib/adminPos/ui";

/* =============================================================================
 * Minimal Drawer (no deps)
 * - Bottom sheet on mobile, right panel on desktop if you want
 * ========================================================================== */

function Drawer({
  open,
  onClose,
  title,
  children,
  side = "bottom",
  widthClass = "max-w-xl",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  side?: "bottom" | "right";
  widthClass?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    // Focus the panel for accessibility
    setTimeout(() => panelRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const panelPos =
    side === "bottom" ? "left-0 right-0 bottom-0" : "right-0 top-0 bottom-0";

  const panelShape = side === "bottom" ? "rounded-t-3xl" : "rounded-l-3xl";

  const panelSize =
    side === "bottom" ? "max-h-[85vh]" : `h-full w-full ${widthClass}`;

  return (
    <div className="fixed inset-0 z-60">
      {/* Overlay */}
      <button
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "absolute bg-white shadow-2xl outline-none",
          panelPos,
          panelShape,
          panelSize,
          side === "bottom"
            ? "border-t border-zinc-200"
            : "border-l border-zinc-200"
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-10 rounded-full bg-zinc-200 md:hidden" />
            {title ? (
              <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
            ) : (
              <span className="text-sm font-semibold text-zinc-900">
                Detalle
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
          >
            Cerrar
          </button>
        </div>

        <div className="h-full overflow-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/* =============================================================================
 * Small KPI bar for mobile (keeps everything visible without scrolling)
 * ========================================================================== */

function KpiBar({
  cartTotal,
  paymentsTotal,
  diff,
  canCheckout,
  deliveryNeedsData,
}: {
  cartTotal: number;
  paymentsTotal: number;
  diff: number;
  canCheckout: boolean;
  deliveryNeedsData: boolean;
}) {
  const diffKind =
    paymentsTotal <= 0
      ? "idle"
      : diff < 0
      ? "missing"
      : diff === 0
      ? "ok"
      : "change";

  const diffLabel =
    diffKind === "idle"
      ? "Ingresá pagos"
      : diffKind === "missing"
      ? `Falta $ ${Math.abs(diff).toLocaleString("es-AR")}`
      : diffKind === "ok"
      ? "Exacto"
      : `Vuelto $ ${Math.abs(diff).toLocaleString("es-AR")}`;

  return (
    <div className="grid grid-cols-3 gap-2 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="rounded-xl bg-zinc-50 px-3 py-2">
        <div className="text-[11px] font-semibold text-zinc-500">Total</div>
        <div className="text-sm font-bold text-zinc-900">
          $ {cartTotal.toLocaleString("es-AR")}
        </div>
      </div>
      <div className="rounded-xl bg-zinc-50 px-3 py-2">
        <div className="text-[11px] font-semibold text-zinc-500">Pagado</div>
        <div className="text-sm font-bold text-zinc-900">
          $ {paymentsTotal.toLocaleString("es-AR")}
        </div>
      </div>
      <div
        className={cn(
          "rounded-xl px-3 py-2",
          diffKind === "ok"
            ? "bg-emerald-50"
            : diffKind === "change"
            ? "bg-sky-50"
            : diffKind === "missing"
            ? "bg-amber-50"
            : "bg-zinc-50"
        )}
      >
        <div className="text-[11px] font-semibold text-zinc-500">
          Diferencia
        </div>
        <div
          className={cn(
            "text-sm font-bold",
            diffKind === "ok"
              ? "text-emerald-700"
              : diffKind === "change"
              ? "text-sky-700"
              : diffKind === "missing"
              ? "text-amber-700"
              : "text-zinc-900"
          )}
        >
          {diffLabel}
        </div>
        {deliveryNeedsData && (
          <div className="mt-1 text-[10px] font-semibold text-amber-700">
            Faltan datos delivery
          </div>
        )}
        {!deliveryNeedsData && canCheckout && (
          <div className="mt-1 text-[10px] font-semibold text-emerald-700">
            Listo para cobrar
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================================================================
 * Page
 * ========================================================================== */

export default function AdminPosPage() {
  const { getAccessToken, user } = useAuth();
  const roles = (user?.roles ?? []).map((r: any) => String(r).toUpperCase());
  const canUsePos =
    roles.includes("ADMIN") ||
    roles.includes("MANAGER") ||
    roles.includes("CASHIER");

  // Filters
  const [dateKey, setDateKey] = useState(todayKeyArgentina());

  // Fulfillment + customer snapshot (NO DB)
  const [fulfillment, setFulfillment] = useState<Fulfillment>("TAKEAWAY");
  const [customerSnapshot, setCustomerSnapshot] = useState<CustomerSnapshot>({
    name: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    notes: "",
  });

  // Products search
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Cart
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const cartTotal = useMemo(
    () => cart.reduce((acc, it) => acc + num(it.lineTotal), 0),
    [cart]
  );

  // Payments
  const [payments, setPayments] = useState<PosPaymentDraft[]>([
    { method: "CASH", amount: 0 },
  ]);
  const paymentsTotal = useMemo(
    () => payments.reduce((acc, p) => acc + num(p.amount), 0),
    [payments]
  );
  const diff = useMemo(
    () => paymentsTotal - cartTotal,
    [paymentsTotal, cartTotal]
  );

  // Optional: keep existing customerId (DB customer)
  const [customerId, setCustomerId] = useState<string>("");

  // Concept / category
  const [concept, setConcept] = useState("VENTA POS");
  const [note, setNote] = useState("");

  // Finance categories
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive !== false),
    [categories]
  );
  const [categoryId, setCategoryId] = useState<string>("");

  // Sales list
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // UI state
  const [busy, setBusy] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Void modal
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidSaleId, setVoidSaleId] = useState<string | null>(null);
  const [voidDefaultDateKey, setVoidDefaultDateKey] = useState<string | null>(
    null
  );

  // Drawers (mobile UX)
  const [drawerProducts, setDrawerProducts] = useState(false);
  const [drawerCart, setDrawerCart] = useState(false);
  const [drawerPayments, setDrawerPayments] = useState(false);
  const [drawerOrder, setDrawerOrder] = useState(false);

  // Search debounce
  const debounceRef = useRef<any>(null);

  // ---------------- API loaders ----------------

  async function loadFinanceCategories() {
    try {
      const cats = await fetchFinanceCategories(getAccessToken);
      setCategories(cats);
    } catch {
      setCategories([]);
    }
  }

  async function searchProducts(query: string) {
    setLoadingProducts(true);
    try {
      const rows = await fetchProducts(getAccessToken, query);
      setProducts(rows);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadSales() {
    setLoadingSales(true);
    try {
      const rows = await fetchSalesByDateKey(getAccessToken, dateKey);
      setSales(rows);
    } finally {
      setLoadingSales(false);
    }
  }

  async function loadAll() {
    setErr(null);
    setOk(null);
    setLoading(true);

    try {
      await loadFinanceCategories();
      await Promise.all([searchProducts(q), loadSales()]);
      setOk("POS listo ✔");
      setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      const msg = String(e?.message || "Error cargando POS");
      setErr(looksForbidden(msg) ? "Sin permisos para POS." : msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSales().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchProducts(q).catch((e: any) =>
        setErr(String(e?.message || "Error buscando productos"))
      );
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // ---------------- Cart actions ----------------

  function addToCart(p: Product) {
    const unitPrice = getUnitPrice(p);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return;

    setCart((prev) => {
      const ix = prev.findIndex((x) => x.productId === p.id);
      if (ix >= 0) {
        const copy = [...prev];
        const it = { ...copy[ix] };
        it.qty += 1;
        it.lineTotal = it.qty * it.unitPrice;
        copy[ix] = it;
        return copy;
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          unitPrice,
          qty: 1,
          note: null,
          lineTotal: unitPrice,
        },
      ];
    });

    // Micro feedback (no layout jump: keep short)
    setOk(`Agregado: ${p.name}`);
    setTimeout(() => setOk(null), 650);
  }

  function setCartQty(productId: string, qtyDraft: string) {
    if (!isValidNumberDraft(qtyDraft)) return;
    const qty = qtyDraft === "" ? 0 : Math.floor(Number(qtyDraft));
    setCart((prev) => {
      const copy = prev
        .map((it) => {
          if (it.productId !== productId) return it;
          const q = Math.max(0, Number.isFinite(qty) ? qty : 0);
          const lineTotal = q * it.unitPrice;
          return { ...it, qty: q, lineTotal };
        })
        .filter((it) => it.qty > 0);
      return copy;
    });
  }

  function setCartNote(productId: string, noteVal: string) {
    setCart((prev) =>
      prev.map((it) =>
        it.productId === productId
          ? { ...it, note: noteVal?.trim() || null }
          : it
      )
    );
  }

  function removeCartItem(productId: string) {
    setCart((prev) => prev.filter((it) => it.productId !== productId));
  }

  function clearCart() {
    setCart([]);
    setPayments([{ method: "CASH", amount: 0 }]);
    setNote("");
    setCustomerId("");
    setCategoryId("");
    setConcept("VENTA POS");
    setFulfillment("TAKEAWAY");
    setCustomerSnapshot({
      name: "",
      phone: "",
      addressLine1: "",
      addressLine2: "",
      notes: "",
    });
  }

  // ---------------- Payments actions ----------------

  function addPaymentLine() {
    setPayments((prev) => [
      ...prev,
      { method: "TRANSFER", amount: 0, note: null },
    ]);
  }

  function removePaymentLine(ix: number) {
    setPayments((prev) => prev.filter((_, i) => i !== ix));
  }

  function updatePayment(ix: number, patch: Partial<PosPaymentDraft>) {
    setPayments((prev) => {
      const copy = [...prev];
      copy[ix] = { ...copy[ix], ...patch };
      return copy;
    });
  }

  // UX helper: set "exact amount" into a line
  function setPayExact(ix = 0) {
    setPayments((prev) => {
      const other = prev.reduce(
        (acc, p, i) => (i === ix ? acc : acc + num(p.amount)),
        0
      );
      const need = Math.max(0, cartTotal - other);
      const copy = [...prev];
      if (!copy[ix]) return prev;
      copy[ix] = { ...copy[ix], amount: need };
      return copy;
    });
    setOk("Monto exacto aplicado ✔");
    setTimeout(() => setOk(null), 650);
  }

  const deliveryNeedsData = useMemo(() => {
    if (fulfillment !== "DELIVERY") return false;
    const nameOk = !!String(customerSnapshot.name ?? "").trim();
    const addrOk = !!String(customerSnapshot.addressLine1 ?? "").trim();
    return !(nameOk && addrOk);
  }, [fulfillment, customerSnapshot]);

  const canCreateOrder = useMemo(() => {
    if (!canUsePos) return false;
    if (!cart.length) return false;
    if (cartTotal <= 0) return false;
    if (deliveryNeedsData) return false;
    return true;
  }, [canUsePos, cart.length, cartTotal, deliveryNeedsData]);

  const canCheckout = useMemo(() => {
    if (!canUsePos) return false;
    if (!cart.length) return false;
    if (!payments.length) return false;
    if (cartTotal <= 0) return false;
    if (paymentsTotal <= 0) return false;
    if (paymentsTotal < cartTotal) return false;
    if (deliveryNeedsData) return false;
    return true;
  }, [
    canUsePos,
    cart.length,
    payments.length,
    cartTotal,
    paymentsTotal,
    deliveryNeedsData,
  ]);

  const posStatus = useMemo(() => {
    if (!canUsePos) return { kind: "blocked" as const, label: "Sin permisos" };
    if (!cart.length)
      return { kind: "idle" as const, label: "Agregá productos" };
    if (deliveryNeedsData)
      return { kind: "warn" as const, label: "Faltan datos delivery" };
    if (paymentsTotal <= 0)
      return { kind: "warn" as const, label: "Ingresá un pago" };
    if (paymentsTotal < cartTotal)
      return { kind: "warn" as const, label: "Falta dinero" };
    if (paymentsTotal === cartTotal)
      return { kind: "ok" as const, label: "Listo para cobrar" };
    return { kind: "change" as const, label: "Listo (con vuelto)" };
  }, [canUsePos, cart.length, deliveryNeedsData, paymentsTotal, cartTotal]);

  // ---------------- POS actions ----------------

  async function refreshAll() {
    setBusy(true);
    setErr(null);
    try {
      await Promise.all([searchProducts(q), loadSales()]);
      setOk("Actualizado ✔");
      setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      setErr(String(e?.message || "Error actualizando"));
    } finally {
      setBusy(false);
    }
  }

  function buildSnapshotPayload() {
    return fulfillment === "DELIVERY"
      ? {
          name: String(customerSnapshot.name ?? "").trim() || null,
          phone: String(customerSnapshot.phone ?? "").trim() || null,
          addressLine1:
            String(customerSnapshot.addressLine1 ?? "").trim() || null,
          addressLine2:
            String(customerSnapshot.addressLine2 ?? "").trim() || null,
          notes: String(customerSnapshot.notes ?? "").trim() || null,
        }
      : {
          name: String(customerSnapshot.name ?? "").trim() || null,
          phone: String(customerSnapshot.phone ?? "").trim() || null,
        };
  }

  async function createOrderOnly() {
    setErr(null);
    setOk(null);

    if (!canCreateOrder) {
      setErr(
        deliveryNeedsData
          ? "Delivery: completá al menos Nombre y Dirección."
          : "Agregá productos para crear el pedido."
      );
      return;
    }

    const snapshot = buildSnapshotPayload();

    setCreatingOrder(true);
    try {
      const res = await postCreateOrder(getAccessToken, {
        source: "POS",
        fulfillment,
        customerId: customerId?.trim() ? customerId.trim() : null,
        customerSnapshot: snapshot,
        note: note?.trim() ? note.trim() : null,
        items: cart.map((it) => ({
          productId: it.productId,
          qty: num(it.qty),
          note: it.note ?? null,
        })),
      });

      const orderId = String(
        res?.id ?? res?._id ?? res?.order?.id ?? res?.order?._id ?? ""
      );
      setOk(
        orderId ? `Pedido creado ✔ (Order: ${orderId})` : "Pedido creado ✔"
      );
      setTimeout(() => setOk(null), 1400);

      clearCart();
      window.location.href = "/admin/orders";
    } catch (e: any) {
      setErr(String(e?.message || "Error creando pedido"));
    } finally {
      setCreatingOrder(false);
    }
  }

  async function checkout() {
    setErr(null);
    setOk(null);

    if (!canCheckout) {
      setErr(
        deliveryNeedsData
          ? "Delivery: completá al menos Nombre y Dirección."
          : "Revisá carrito y pagos (pagos deben cubrir el total)."
      );
      return;
    }

    const payloadPayments = payments
      .map((p) => ({
        method: p.method,
        amount: num(p.amount),
        note: p.note ?? null,
      }))
      .filter((p) => p.amount > 0);

    if (!payloadPayments.length) {
      setErr("Ingresá al menos un pago > 0.");
      return;
    }

    const snapshot = buildSnapshotPayload();

    setBusy(true);
    try {
      const res = await postPosCheckout(getAccessToken, {
        dateKey,
        fulfillment,
        customerId: customerId?.trim() ? customerId.trim() : null,
        customerSnapshot: snapshot,
        note: note?.trim() ? note.trim() : null,
        items: cart.map((it) => ({
          productId: it.productId,
          qty: num(it.qty),
          note: it.note ?? null,
        })),
        payments: payloadPayments,
        concept: concept?.trim() ? concept.trim() : "VENTA POS",
        categoryId: categoryId || null,
      });

      setOk(
        `Venta creada ✔ (Sale: ${String(
          res?.sale?.id ?? res?.sale?._id ?? "OK"
        )})`
      );
      setTimeout(() => setOk(null), 1600);

      clearCart();
      setDrawerPayments(false); // UX: cerrar drawer al cobrar
      await loadSales();
    } catch (e: any) {
      setErr(String(e?.message || "Error en checkout"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmVoid({
    saleId,
    reason,
    dateKey,
  }: {
    saleId: string;
    reason: string;
    dateKey: string;
  }) {
    setBusy(true);
    setErr(null);
    try {
      await patchVoidSale(getAccessToken, saleId, {
        reason: reason?.trim() ? reason.trim() : null,
        dateKey: dateKey?.trim() ? dateKey.trim() : null,
      });
      setOk("Venta anulada ✔");
      setTimeout(() => setOk(null), 1400);
      await loadSales();
    } catch (e: any) {
      setErr(String(e?.message || "Error anulando venta"));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  // ---------------- Keyboard UX (POS-like) ----------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!canUsePos) return;
      if (e.key === "F2") {
        // Open products drawer on mobile
        e.preventDefault();
        setDrawerProducts(true);
      }
      if (e.key === "F8") {
        e.preventDefault();
        setDrawerPayments(true);
      }
      if (e.key === "F9") {
        e.preventDefault();
        if (canCheckout && !busy && !creatingOrder) checkout();
      }
      if (e.key === "Escape") {
        // Clear search if present, else close drawers
        if (q) setQ("");
        else {
          setDrawerProducts(false);
          setDrawerCart(false);
          setDrawerPayments(false);
          setDrawerOrder(false);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canUsePos, canCheckout, busy, creatingOrder, q]);

  // ---------------- UI helpers ----------------

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    if (!products.length) return;
    addToCart(products[0]);
  }

  const busyHard = busy || creatingOrder;

  return (
    <AdminProtected>
      <div className="min-h-dvh bg-zinc-50">
        {/* Top bar (verde como el mock) */}
        <div className="sticky top-0 z-40 h-14 bg-emerald-600 shadow-sm">
          <div className="mx-auto flex h-full max-w-350 items-center justify-between px-4">
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/20"
                onClick={refreshAll}
                disabled={busyHard}
              >
                Refresh
              </button>

              <div className="hidden md:block text-sm font-semibold text-white/90">
                POS
              </div>

              <div className="hidden lg:block text-xs text-white/80">
                {ok ? ok : err ? err : "Listo"}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden md:block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                {dateKey}
              </div>
              <button
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-extrabold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                onClick={() => {
                  if (!q) return;
                  // fuerza búsqueda inmediata
                  searchProducts(q).catch(() => {});
                }}
                disabled={busyHard}
              >
                Buscar
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="mx-auto max-w-350 px-4 py-4">
          <div className="grid h-[calc(100dvh-120px)] grid-cols-[1fr_390px] gap-4">
            {/* LEFT: catálogo */}
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              {/* barra superior catálogo */}
              <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
                <button className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
                  + ADD NEW ITEM
                </button>

                <div className="ml-auto flex w-105 items-center gap-2">
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={onSearchKeyDown}
                    placeholder="Search items here..."
                    className="h-10 w-full rounded-full border border-zinc-200 px-4 text-sm outline-none focus:border-emerald-400"
                  />
                  <button
                    className="grid h-10 w-10 place-items-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => searchProducts(q).catch(() => {})}
                    disabled={busyHard}
                    title="Buscar"
                  >
                    🔍
                  </button>
                </div>
              </div>

              {/* grilla */}
              <div className="flex-1 overflow-auto p-4">
                {loadingProducts ? (
                  <div className="text-sm text-zinc-500">Cargando…</div>
                ) : !products.length ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                    No hay productos para mostrar.
                  </div>
                ) : (
                  <div className="grid grid-cols-5 gap-4">
                    {products.map((p) => {
                      const price = getUnitPrice(p);
                      return (
                        <button
                          key={p.id}
                          onClick={() => addToCart(p)}
                          className="group rounded-xl border border-zinc-200 bg-white p-3 text-left hover:shadow-md"
                          disabled={busyHard}
                        >
                          <div className="aspect-square w-full rounded-lg bg-zinc-50">
                            {/* si tenés imágenes después lo conectamos */}
                            <div className="grid h-full w-full place-items-center text-zinc-300">
                              IMG
                            </div>
                          </div>

                          <div className="mt-2 line-clamp-2 text-sm font-semibold text-zinc-900">
                            {p.name}
                          </div>
                          <div className="mt-1 text-sm font-extrabold text-emerald-700">
                            {price.toLocaleString("es-AR", {
                              style: "currency",
                              currency: "ARS",
                            })}
                          </div>

                          <div className="mt-2 text-[11px] font-semibold text-zinc-400 opacity-0 group-hover:opacity-100">
                            Click para agregar
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* barra de categorías como mock (por ahora dummy) */}
              <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3">
                <div className="grid grid-cols-5 gap-2">
                  {["Coffee", "Beverages", "BBQ", "Snacks", "Deserts"].map(
                    (t) => (
                      <button
                        key={t}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
                        disabled={busyHard}
                      >
                        {t}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: ticket */}
            <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-100 px-4 py-3">
                <div className="text-sm font-bold text-zinc-900">Checkout</div>
                <div className="text-xs text-zinc-500">
                  {paymentsTotal <= 0
                    ? "Ingresá pagos"
                    : diff < 0
                    ? `Falta ${Math.abs(diff).toLocaleString("es-AR", {
                        style: "currency",
                        currency: "ARS",
                      })}`
                    : diff === 0
                    ? "Exacto"
                    : `Vuelto ${Math.abs(diff).toLocaleString("es-AR", {
                        style: "currency",
                        currency: "ARS",
                      })}`}
                </div>
              </div>

              {/* Datos cliente arriba del ticket */}
              <div className="border-b border-zinc-100 px-4 py-3">
                <div className="grid gap-2">
                  <div className="grid grid-cols-3 gap-2">
                    {(["TAKEAWAY", "DELIVERY", "DINEIN"] as Fulfillment[]).map(
                      (k) => (
                        <button
                          key={k}
                          onClick={() => setFulfillment(k)}
                          disabled={!canUsePos || busyHard}
                          className={cn(
                            "rounded-xl border px-3 py-2 text-xs font-semibold",
                            fulfillment === k
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
                            (!canUsePos || busyHard) && "opacity-60"
                          )}
                        >
                          {k === "TAKEAWAY"
                            ? "Takeaway"
                            : k === "DELIVERY"
                            ? "Delivery"
                            : "Dine in"}
                        </button>
                      )
                    )}
                  </div>

                  <input
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    placeholder="Cliente ID (opcional)"
                    className="h-9 rounded-xl border border-zinc-200 px-3 text-sm outline-none focus:border-emerald-400"
                    disabled={!canUsePos || busyHard}
                  />

                  <input
                    value={customerSnapshot.name ?? ""}
                    onChange={(e) =>
                      setCustomerSnapshot({
                        ...customerSnapshot,
                        name: e.target.value,
                      })
                    }
                    placeholder="Nombre"
                    className={cn(
                      "h-9 rounded-xl border px-3 text-sm outline-none focus:border-emerald-400",
                      deliveryNeedsData &&
                        !String(customerSnapshot.name ?? "").trim()
                        ? "border-amber-300"
                        : "border-zinc-200"
                    )}
                    disabled={!canUsePos || busyHard}
                  />

                  {fulfillment === "DELIVERY" && (
                    <input
                      value={customerSnapshot.addressLine1 ?? ""}
                      onChange={(e) =>
                        setCustomerSnapshot({
                          ...customerSnapshot,
                          addressLine1: e.target.value,
                        })
                      }
                      placeholder="Dirección"
                      className={cn(
                        "h-9 rounded-xl border px-3 text-sm outline-none focus:border-emerald-400",
                        deliveryNeedsData &&
                          !String(customerSnapshot.addressLine1 ?? "").trim()
                          ? "border-amber-300"
                          : "border-zinc-200"
                      )}
                      disabled={!canUsePos || busyHard}
                    />
                  )}
                </div>
              </div>

              {/* Ticket items */}
              <div className="flex-1 overflow-auto px-4 py-3">
                <div className="grid grid-cols-[1fr_120px] gap-2 text-[11px] font-semibold text-zinc-500">
                  <div>Name</div>
                  <div className="text-right">QTY</div>
                </div>

                <div className="mt-3 grid gap-3">
                  {!cart.length ? (
                    <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                      Sin items
                    </div>
                  ) : (
                    cart.map((it) => (
                      <div
                        key={it.productId}
                        className="grid grid-cols-[1fr_120px] items-center gap-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-zinc-900">
                            {it.name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {(it.lineTotal || 0).toLocaleString("es-AR", {
                              style: "currency",
                              currency: "ARS",
                            })}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              const cur = Math.floor(num(it.qty));
                              const next = Math.max(0, cur - 1);
                              if (!next) removeCartItem(it.productId);
                              else setCartQty(it.productId, String(next));
                            }}
                            disabled={busyHard}
                            className="grid h-8 w-8 place-items-center rounded-full border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                          >
                            –
                          </button>

                          <div className="w-7 text-center text-sm font-bold text-zinc-900">
                            {Math.floor(num(it.qty))}
                          </div>

                          <button
                            onClick={() => {
                              const cur = Math.floor(num(it.qty));
                              setCartQty(it.productId, String(cur + 1));
                            }}
                            disabled={busyHard}
                            className="grid h-8 w-8 place-items-center rounded-full border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Footer total + pay */}
              <div className="border-t border-zinc-100 px-4 py-3">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between text-sm text-zinc-600">
                    <span>Sub Total</span>
                    <span className="font-semibold text-zinc-900">
                      {cartTotal.toLocaleString("es-AR", {
                        style: "currency",
                        currency: "ARS",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-zinc-900">
                      Total
                    </span>
                    <span className="text-lg font-extrabold text-emerald-700">
                      {cartTotal.toLocaleString("es-AR", {
                        style: "currency",
                        currency: "ARS",
                      })}
                    </span>
                  </div>

                  <button
                    disabled={!canCheckout || busyHard}
                    onClick={checkout}
                    className={cn(
                      "mt-1 h-12 rounded-xl text-sm font-extrabold",
                      canCheckout
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-zinc-100 text-zinc-400"
                    )}
                  >
                    Pay (
                    {cartTotal.toLocaleString("es-AR", {
                      style: "currency",
                      currency: "ARS",
                    })}
                    )
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* (opcional) ventas del día abajo, si querés como pantalla secundaria */}
          <div className="mt-4">
            <SalesTable
              sales={sales}
              loadingSales={loadingSales}
              loading={loading}
              busy={busy}
              dateKey={dateKey}
              onVoidClick={(s) => {
                const voided = s.status === "VOIDED";
                if (voided) return;
                setVoidSaleId(s.id);
                setVoidDefaultDateKey(s.paidDateKey || dateKey);
                setVoidOpen(true);
              }}
            />
          </div>

          {/* Void modal */}
          {voidSaleId && (
            <VoidSaleModal
              open={voidOpen}
              onClose={() => setVoidOpen(false)}
              busy={busy}
              saleId={voidSaleId}
              defaultDateKey={voidDefaultDateKey}
              onConfirm={async ({ reason, dateKey }) => {
                await confirmVoid({ saleId: voidSaleId, reason, dateKey });
              }}
            />
          )}
        </div>
      </div>
    </AdminProtected>
  );
}
