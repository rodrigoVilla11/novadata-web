"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";
import { apiFetchAuthed } from "@/lib/apiAuthed";

import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";

import {
  RefreshCcw,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Search,
  ShoppingCart,
  CreditCard,
  Banknote,
  BadgeDollarSign,
  Truck,
  Store,
  PackageOpen,
  User,
  Phone,
  MapPin,
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

function moneyARS(n: number) {
  const v = Number(n ?? 0) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
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

/* =============================================================================
 * Types
 * ========================================================================== */

type PaymentMethod = "CASH" | "TRANSFER" | "CARD" | "OTHER";
type Fulfillment = "DINE_IN" | "TAKEAWAY" | "DELIVERY";

type Product = {
  id: string;
  name: string;
  salePrice?: number | null;
  computed?: { suggestedPrice?: number | null } | null;
  isActive?: boolean;
  sellable?: boolean;
};

type PosCartItem = {
  productId: string;
  name: string;
  unitPrice: number;
  qty: number;
  note?: string | null;
  lineTotal: number;
};

type PosPaymentDraft = {
  method: PaymentMethod;
  amount: number;
  note?: string | null;
};

type SaleRow = {
  id: string;
  status: "DRAFT" | "PENDING" | "PAID" | "VOIDED";
  total: number;
  dateKey?: string | null;
  paidDateKey?: string | null;
  createdAt: string;
  voidReason?: string | null;
};

type CheckoutResult = { order: any; sale: any };

type FinanceCategory = {
  id: string;
  name: string;
  type?: string;
  isActive?: boolean;
};

type CustomerSnapshot = {
  name?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  notes?: string | null;
};

/* =============================================================================
 * Void Sale Modal (igual que admin)
 * ========================================================================== */

function VoidSaleModal({
  open,
  onClose,
  onConfirm,
  busy,
  saleId,
  defaultDateKey,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (data: { reason: string; dateKey: string }) => Promise<void> | void;
  busy?: boolean;
  saleId: string;
  defaultDateKey?: string | null;
}) {
  // Cashier: igual permitimos setear dateKey, pero default = hoy.
  const [dateKey, setDateKey] = useState(defaultDateKey || todayKeyArgentina());
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDateKey(defaultDateKey || todayKeyArgentina());
    setReason("");
    setErr(null);
  }, [open, defaultDateKey]);

  const canSubmit = useMemo(
    () => !!dateKey && /^\d{4}-\d{2}-\d{2}$/.test(dateKey),
    [dateKey]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 md:items-center">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-xl border border-zinc-200">
        <div className="px-5 py-4 border-b border-zinc-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                <h3 className="text-lg font-semibold text-zinc-900">
                  Anular venta
                </h3>
              </div>
              <p className="mt-1 text-sm text-zinc-500">
                Si estaba <b>PAGADA</b>, genera reversa de caja + reposición de
                stock.
              </p>
              <p className="mt-1 text-xs text-zinc-400">Sale ID: {saleId}</p>
            </div>

            <Button variant="secondary" onClick={onClose} disabled={!!busy}>
              Cerrar
            </Button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {err && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {err}
            </div>
          )}

          <Field label="Fecha de caja (dateKey)">
            <Input
              type="date"
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              disabled={!!busy}
            />
          </Field>

          <Field label="Motivo (opcional)">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: error de cobro / se canceló el pedido"
              disabled={!!busy}
            />
          </Field>
        </div>

        <div className="px-5 py-4 border-t border-zinc-100 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={!!busy}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            loading={!!busy}
            disabled={!canSubmit || !!busy}
            onClick={async () => {
              try {
                setErr(null);
                await onConfirm({ reason, dateKey });
                onClose();
              } catch (e: any) {
                setErr(String(e?.message || "Error anulando"));
              }
            }}
          >
            Confirmar anulación
          </Button>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
 * Cashier POS Page
 * ========================================================================== */

export default function CashierPosPage() {
  const { getAccessToken, user } = useAuth();

  // Cashier-only (si querés permitir manager/admin también)
  const roles = (user?.roles ?? []).map((r: any) => String(r).toUpperCase());
  const canUsePos = roles.includes("CASHIER") || roles.includes("MANAGER") || roles.includes("ADMIN");

  // ✅ HOY fijo
  const todayKey = useMemo(() => todayKeyArgentina(), []);
  const [dateKey] = useState(todayKey); // no setter (solo lectura)

  // Fulfillment + customer snapshot
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

  const diff = useMemo(() => paymentsTotal - cartTotal, [paymentsTotal, cartTotal]);

  // Concept / category / note
  const [concept, setConcept] = useState("VENTA POS");
  const [note, setNote] = useState("");

  // Categories (opcional para cashier; lo dejo)
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive !== false),
    [categories]
  );
  const [categoryId, setCategoryId] = useState<string>("");

  // Sales list (✅ solo HOY)
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);

  // UI
  const [busy, setBusy] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Void modal
  const [voidOpen, setVoidOpen] = useState(false);
  const [voidSaleId, setVoidSaleId] = useState<string | null>(null);
  const [voidDefaultDateKey, setVoidDefaultDateKey] = useState<string | null>(null);

  // Search debounce
  const debounceRef = useRef<any>(null);

  // ---------------- API loaders ----------------

  async function loadFinanceCategories() {
    try {
      const cats = await apiFetchAuthed<FinanceCategory[]>(
        getAccessToken,
        "/finance/categories"
      );
      setCategories(cats);
    } catch {
      setCategories([]);
    }
  }

  async function searchProducts(query: string) {
    setLoadingProducts(true);
    try {
      const qs = new URLSearchParams();
      qs.set("onlyActive", "true");
      qs.set("sellable", "true");
      if (query.trim()) qs.set("q", query.trim());

      const rows = await apiFetchAuthed<Product[]>(
        getAccessToken,
        `/products?${qs.toString()}`
      );

      const norm = (rows ?? []).map((p: any) => ({
        id: String(p.id ?? p._id),
        name: p.name ?? "",
        salePrice: p.salePrice ?? null,
        computed: p.computed ?? null,
        isActive: p.isActive,
        sellable: p.sellable,
      }));

      setProducts(norm);
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadSalesToday() {
    setLoadingSales(true);
    try {
      const qs = new URLSearchParams();
      qs.set("dateKey", todayKey);
      qs.set("limit", "50");

      const rows = await apiFetchAuthed<SaleRow[]>(
        getAccessToken,
        `/sales?${qs.toString()}`
      );

      const norm = (rows ?? []).map((s: any) => ({
        id: String(s.id ?? s._id),
        status: s.status,
        total: num(s.total ?? s.totals?.net ?? s.amount ?? 0),
        dateKey: s.dateKey ?? null,
        paidDateKey: s.paidDateKey ?? s.paid_dateKey ?? null,
        createdAt: s.createdAt ?? s.created_at ?? new Date().toISOString(),
        voidReason: s.voidReason ?? null,
      }));

      setSales(norm);
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
      await Promise.all([searchProducts(q), loadSalesToday()]);
      setOk("POS (Caja) listo ✔");
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

  function getUnitPrice(p: Product) {
    const sale = p.salePrice != null ? num(p.salePrice) : null;
    const suggested =
      p.computed?.suggestedPrice != null ? num(p.computed.suggestedPrice) : null;
    return sale ?? suggested ?? 0;
  }

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
  }, [canUsePos, cart.length, payments.length, cartTotal, paymentsTotal, deliveryNeedsData]);

  // ---------------- POS actions ----------------

  async function refreshAll() {
    setBusy(true);
    setErr(null);
    try {
      await Promise.all([searchProducts(q), loadSalesToday()]);
      setOk("Actualizado ✔");
      setTimeout(() => setOk(null), 1200);
    } catch (e: any) {
      setErr(String(e?.message || "Error actualizando"));
    } finally {
      setBusy(false);
    }
  }

  function buildSnapshot() {
    return fulfillment === "DELIVERY"
      ? {
          name: String(customerSnapshot.name ?? "").trim() || null,
          phone: String(customerSnapshot.phone ?? "").trim() || null,
          addressLine1: String(customerSnapshot.addressLine1 ?? "").trim() || null,
          addressLine2: String(customerSnapshot.addressLine2 ?? "").trim() || null,
          notes: String(customerSnapshot.notes ?? "").trim() || null,
        }
      : {
          name: String(customerSnapshot.name ?? "").trim() || null,
          phone: String(customerSnapshot.phone ?? "").trim() || null,
        };
  }

  // ✅ Cashier: create order sin cobrar (igual)
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

    setCreatingOrder(true);
    try {
      const res = await apiFetchAuthed<any>(getAccessToken, "/orders", {
        method: "POST",
        body: JSON.stringify({
          source: "POS",
          fulfillment,
          customerId: null, // Cashier no vincula DB customer
          customerSnapshot: buildSnapshot(),
          note: note?.trim() ? note.trim() : null,
          items: cart.map((it) => ({
            productId: it.productId,
            qty: num(it.qty),
            note: it.note ?? null,
          })),
        }),
      });

      const orderId = String(res?.id ?? res?._id ?? res?.order?.id ?? res?.order?._id ?? "");
      setOk(orderId ? `Pedido creado ✔ (Order: ${orderId})` : "Pedido creado ✔");
      setTimeout(() => setOk(null), 1400);

      clearCart();

      // Cashier: normalmente te manda a orders para cobrar/confirmar
      window.location.href = "/cashier/orders";
    } catch (e: any) {
      setErr(String(e?.message || "Error creando pedido"));
    } finally {
      setCreatingOrder(false);
    }
  }

  // ✅ Cashier checkout: dateKey fijo HOY
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

    setBusy(true);
    try {
      const res = await apiFetchAuthed<CheckoutResult>(getAccessToken, "/pos/checkout", {
        method: "POST",
        body: JSON.stringify({
          dateKey: todayKey, // ✅ fijo
          fulfillment,
          customerId: null, // Cashier no vincula DB customer
          customerSnapshot: buildSnapshot(),
          note: note?.trim() ? note.trim() : null,
          items: cart.map((it) => ({
            productId: it.productId,
            qty: num(it.qty),
            note: it.note ?? null,
          })),
          payments: payloadPayments,
          concept: concept?.trim() ? concept.trim() : "VENTA POS",
          categoryId: categoryId || null,
        }),
      });

      setOk(
        `Venta creada ✔ (Sale: ${String(res?.sale?.id ?? res?.sale?._id ?? "OK")})`
      );
      setTimeout(() => setOk(null), 1600);

      clearCart();
      await loadSalesToday();
    } catch (e: any) {
      setErr(String(e?.message || "Error en checkout"));
    } finally {
      setBusy(false);
    }
  }

  async function voidSale(
    saleId: string,
    body: { reason?: string | null; dateKey?: string | null }
  ) {
    return apiFetchAuthed(getAccessToken, `/sales/${saleId}/void`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
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
      await voidSale(saleId, {
        reason: reason?.trim() ? reason.trim() : null,
        dateKey: dateKey?.trim() ? dateKey.trim() : null,
      });
      setOk("Venta anulada ✔");
      setTimeout(() => setOk(null), 1400);
      await loadSalesToday();
    } catch (e: any) {
      setErr(String(e?.message || "Error anulando venta"));
      throw e;
    } finally {
      setBusy(false);
    }
  }

  // ---------------- UI helpers ----------------

  const paymentIcon = (m: PaymentMethod) => {
    if (m === "CASH") return <Banknote className="h-4 w-4" />;
    if (m === "TRANSFER") return <BadgeDollarSign className="h-4 w-4" />;
    if (m === "CARD") return <CreditCard className="h-4 w-4" />;
    return <BadgeDollarSign className="h-4 w-4" />;
  };

  const fulfillmentMeta = (f: Fulfillment) => {
    if (f === "DINE_IN") return { label: "Salón", icon: <Store className="h-4 w-4" /> };
    if (f === "TAKEAWAY") return { label: "Take-away", icon: <PackageOpen className="h-4 w-4" /> };
    return { label: "Delivery", icon: <Truck className="h-4 w-4" /> };
  };

  const fMeta = fulfillmentMeta(fulfillment);

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    if (!products.length) return;
    addToCart(products[0]);
  }

  return (
    <AdminProtected allow={["CASHIER", "MANAGER", "ADMIN"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                POS (Caja)
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Solo ventas de <b>hoy</b>. Fecha fija: <b>{todayKey}</b>
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                <span className="inline-flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  Total: <b>{moneyARS(cartTotal)}</b>
                </span>
                <span className="text-zinc-400">·</span>
                <span>
                  Pagos: <b>{moneyARS(paymentsTotal)}</b>
                </span>
                <span className="text-zinc-400">·</span>
                <span className={cn(diff >= 0 ? "text-emerald-700" : "text-rose-700")}>
                  Dif: <b>{moneyARS(diff)}</b>
                </span>
                <span className="text-zinc-400">·</span>
                <span className="inline-flex items-center gap-2">
                  {fMeta.icon}
                  <b>{fMeta.label}</b>
                </span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" onClick={refreshAll} loading={busy || loading}>
                <RefreshCcw className="h-4 w-4" />
                Actualizar
              </Button>
            </div>
          </div>

          {(err || ok) && (
            <div className="mt-4 grid gap-2">
              {err && <Notice tone="error">{err}</Notice>}
              {!err && ok && <Notice tone="ok">{ok}</Notice>}
            </div>
          )}

          {!canUsePos && (
            <div className="mt-4">
              <Notice tone="warn">
                Tu usuario no tiene roles para usar POS (CASHIER/MANAGER/ADMIN).
              </Notice>
            </div>
          )}
        </div>

        {/* Fulfillment + Customer quick */}
        <Card>
          <CardHeader title="Pedido" subtitle="Tipo + datos rápidos (snapshot)" />
          <CardBody>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <Field label="Tipo">
                  <Select
                    value={fulfillment}
                    onChange={(e) => setFulfillment(e.target.value as Fulfillment)}
                    disabled={!canUsePos || busy}
                  >
                    <option value="DINE_IN">Salón</option>
                    <option value="TAKEAWAY">Take-away</option>
                    <option value="DELIVERY">Delivery</option>
                  </Select>
                </Field>

                <div className="mt-3 text-xs text-zinc-500">
                  Reglas:
                  <ul className="mt-1 list-disc pl-4 space-y-1">
                    <li>Crear pedido: no requiere pagos.</li>
                    <li>Delivery: nombre + dirección requeridos.</li>
                    <li>Cobrar: pagos deben cubrir el total.</li>
                    <li>Fecha de caja: fija en HOY.</li>
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-2">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Nombre">
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        className="pl-9"
                        value={String(customerSnapshot.name ?? "")}
                        onChange={(e) =>
                          setCustomerSnapshot((p) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="Ej: Cliente"
                        disabled={!canUsePos || busy}
                      />
                    </div>
                  </Field>

                  <Field label="Teléfono">
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                      <Input
                        className="pl-9"
                        value={String(customerSnapshot.phone ?? "")}
                        onChange={(e) =>
                          setCustomerSnapshot((p) => ({ ...p, phone: e.target.value }))
                        }
                        placeholder="Ej: 351..."
                        disabled={!canUsePos || busy}
                      />
                    </div>
                  </Field>
                </div>

                {fulfillment === "DELIVERY" && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Field label="Dirección (requerido)">
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        <Input
                          className={cn("pl-9", deliveryNeedsData && "ring-1 ring-rose-200")}
                          value={String(customerSnapshot.addressLine1 ?? "")}
                          onChange={(e) =>
                            setCustomerSnapshot((p) => ({ ...p, addressLine1: e.target.value }))
                          }
                          placeholder="Calle y número"
                          disabled={!canUsePos || busy}
                        />
                      </div>
                      {deliveryNeedsData && (
                        <div className="mt-1 text-xs text-rose-700">
                          Necesario para crear/cobrar delivery.
                        </div>
                      )}
                    </Field>

                    <Field label="Piso / Depto / Referencia">
                      <Input
                        value={String(customerSnapshot.addressLine2 ?? "")}
                        onChange={(e) =>
                          setCustomerSnapshot((p) => ({ ...p, addressLine2: e.target.value }))
                        }
                        placeholder="Opcional"
                        disabled={!canUsePos || busy}
                      />
                    </Field>

                    <div className="md:col-span-2">
                      <Field label="Notas (delivery)">
                        <Input
                          value={String(customerSnapshot.notes ?? "")}
                          onChange={(e) =>
                            setCustomerSnapshot((p) => ({ ...p, notes: e.target.value }))
                          }
                          placeholder="Ej: timbre roto…"
                          disabled={!canUsePos || busy}
                        />
                      </Field>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Products + Cart */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Productos" subtitle="Buscar y agregar al carrito" />
            <CardBody>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Field label="Buscar">
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      onKeyDown={onSearchKeyDown}
                      placeholder="Enter agrega el 1° resultado"
                      disabled={!canUsePos || busy}
                    />
                  </Field>
                </div>
                <div className="mt-6">
                  <Button
                    variant="secondary"
                    onClick={() => searchProducts(q)}
                    disabled={!canUsePos || busy}
                  >
                    <Search className="h-4 w-4" />
                    Buscar
                  </Button>
                </div>
              </div>

              <div className="mt-4 max-h-[420px] overflow-auto pr-1 space-y-2">
                {loadingProducts ? (
                  <div className="text-sm text-zinc-500">Buscando…</div>
                ) : products.length === 0 ? (
                  <div className="text-sm text-zinc-500">Sin resultados.</div>
                ) : (
                  products.map((p) => {
                    const price = getUnitPrice(p);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-zinc-900 truncate">
                            {p.name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Precio: <b>{moneyARS(price)}</b>
                          </div>
                        </div>

                        <Button
                          onClick={() => addToCart(p)}
                          disabled={!canUsePos || busy}
                        >
                          <PlusCircle className="h-4 w-4" />
                          Agregar
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Carrito" subtitle="Cantidades y notas" />
            <CardBody>
              {cart.length === 0 ? (
                <div className="text-sm text-zinc-500">
                  Agregá productos desde la lista.
                </div>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                  {cart.map((it) => (
                    <div
                      key={it.productId}
                      className="rounded-2xl border border-zinc-200 bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-zinc-900 truncate">
                            {it.name}
                          </div>
                          <div className="text-xs text-zinc-500">
                            Unit: <b>{moneyARS(it.unitPrice)}</b> · Línea:{" "}
                            <b>{moneyARS(it.lineTotal)}</b>
                          </div>
                        </div>

                        <Button
                          variant="danger"
                          onClick={() => removeCartItem(it.productId)}
                          disabled={!canUsePos || busy}
                        >
                          <Trash2 className="h-4 w-4" />
                          Quitar
                        </Button>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <Field label="Cantidad">
                          <Input
                            value={String(it.qty)}
                            onChange={(e) => setCartQty(it.productId, e.target.value)}
                            disabled={!canUsePos || busy}
                          />
                        </Field>

                        <Field label="Nota (item)">
                          <Input
                            value={it.note ?? ""}
                            onChange={(e) => setCartNote(it.productId, e.target.value)}
                            placeholder="Opcional"
                            disabled={!canUsePos || busy}
                          />
                        </Field>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <div className="text-xs text-zinc-500">Subtotal</div>
                          <div className="text-lg font-semibold text-zinc-900">
                            {moneyARS(it.lineTotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-zinc-600">
                  Total: <b className="text-zinc-900">{moneyARS(cartTotal)}</b>
                </div>
                <Button
                  variant="secondary"
                  onClick={clearCart}
                  disabled={!canUsePos || busy || cart.length === 0}
                >
                  Limpiar
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Payments + Checkout */}
        <Card>
          <CardHeader title="Cobro" subtitle="Pagos + checkout (HOY)" />
          <CardBody>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-3">
                {payments.map((p, ix) => (
                  <div key={ix} className="rounded-2xl border border-zinc-200 bg-white p-3">
                    <div className="grid gap-3 md:grid-cols-4">
                      <Field label="Método">
                        <Select
                          value={p.method}
                          onChange={(e) =>
                            updatePayment(ix, { method: e.target.value as PaymentMethod })
                          }
                          disabled={!canUsePos || busy}
                        >
                          <option value="CASH">Efectivo</option>
                          <option value="TRANSFER">Transferencia</option>
                          <option value="CARD">Tarjeta</option>
                          <option value="OTHER">Otro</option>
                        </Select>
                      </Field>

                      <Field label="Monto">
                        <Input
                          value={String(p.amount ?? 0)}
                          onChange={(e) => {
                            if (!isValidNumberDraft(e.target.value)) return;
                            updatePayment(ix, { amount: num(e.target.value) });
                          }}
                          disabled={!canUsePos || busy}
                        />
                      </Field>

                      <Field label="Nota (pago)">
                        <Input
                          value={p.note ?? ""}
                          onChange={(e) => updatePayment(ix, { note: e.target.value })}
                          placeholder="Opcional"
                          disabled={!canUsePos || busy}
                        />
                      </Field>

                      <div className="flex items-end justify-end gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => removePaymentLine(ix)}
                          disabled={!canUsePos || busy || payments.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                          Quitar
                        </Button>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-zinc-500 inline-flex items-center gap-2">
                      {paymentIcon(p.method)} {p.method} · {moneyARS(p.amount)}
                    </div>
                  </div>
                ))}

                <Button
                  variant="secondary"
                  onClick={addPaymentLine}
                  disabled={!canUsePos || busy}
                >
                  <PlusCircle className="h-4 w-4" />
                  Agregar pago
                </Button>

                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Concepto (caja)">
                    <Input
                      value={concept}
                      onChange={(e) => setConcept(e.target.value)}
                      disabled={!canUsePos || busy}
                    />
                  </Field>

                  <Field label="Categoría (opcional)">
                    <Select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      disabled={!canUsePos || busy}
                    >
                      <option value="">— Sin categoría —</option>
                      {activeCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Nota general (opcional)">
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={!canUsePos || busy}
                    />
                  </Field>
                </div>
              </div>

              {/* Sticky summary */}
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 lg:sticky lg:top-24 h-fit">
                <div className="text-sm text-zinc-600">
                  <div className="flex items-center justify-between">
                    <span>Total carrito</span>
                    <b className="text-zinc-900">{moneyARS(cartTotal)}</b>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Total pagos</span>
                    <b className="text-zinc-900">{moneyARS(paymentsTotal)}</b>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>Diferencia</span>
                    <b className={cn(diff >= 0 ? "text-emerald-700" : "text-rose-700")}>
                      {moneyARS(diff)}
                    </b>
                  </div>

                  <div className="h-px bg-zinc-200 my-3" />

                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2 text-zinc-500">
                      {fMeta.icon} Tipo
                    </span>
                    <b className="text-zinc-900">{fMeta.label}</b>
                  </div>

                  {fulfillment === "DELIVERY" && (
                    <div className="mt-2 text-xs">
                      <div
                        className={cn(
                          "rounded-xl border px-3 py-2",
                          deliveryNeedsData
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {deliveryNeedsData
                          ? "Falta Nombre/Dirección para Delivery."
                          : "Delivery listo ✔"}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <Button
                    variant="secondary"
                    onClick={createOrderOnly}
                    disabled={!canCreateOrder || busy || loading || creatingOrder}
                    loading={creatingOrder}
                  >
                    <PackageOpen className="h-4 w-4" />
                    Crear pedido (sin cobrar)
                  </Button>

                  <Button
                    onClick={checkout}
                    disabled={!canCheckout || busy || loading}
                    loading={busy}
                  >
                    <BadgeDollarSign className="h-4 w-4" />
                    Cobrar (Checkout)
                  </Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Sales list (HOY) + void */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">
              Ventas de hoy ({todayKey})
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              Solo muestra ventas del día actual.
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
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {(loadingSales || loading) && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-sm text-zinc-500">
                      Cargando…
                    </td>
                  </tr>
                )}

                {!loadingSales && !loading && sales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-sm text-zinc-500">
                      No hay ventas hoy.
                    </td>
                  </tr>
                )}

                {!loadingSales &&
                  !loading &&
                  sales.map((s) => {
                    const voided = s.status === "VOIDED";
                    const canVoid = !voided;

                    return (
                      <tr key={s.id} className={cn(voided ? "opacity-70" : "hover:bg-zinc-50")}>
                        <td className="px-4 py-3 text-sm text-zinc-600">
                          {new Date(s.createdAt).toLocaleString("es-AR")}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-700">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
                              s.status === "PAID"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : s.status === "VOIDED"
                                ? "border-zinc-200 bg-zinc-100 text-zinc-600"
                                : "border-amber-200 bg-amber-50 text-amber-800"
                            )}
                          >
                            {s.status}
                          </span>
                          {voided && s.voidReason ? (
                            <div className="mt-1 text-xs text-zinc-500">
                              Motivo: {s.voidReason}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                          {moneyARS(s.total)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Button
                            variant="danger"
                            disabled={busy || !canVoid}
                            onClick={() => {
                              setVoidSaleId(s.id);
                              setVoidDefaultDateKey(s.paidDateKey || todayKey);
                              setVoidOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Anular
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-zinc-100 px-5 py-4 text-xs text-zinc-500">
            Ventas hoy: <b>{sales.length}</b>
          </div>
        </div>

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
    </AdminProtected>
  );
}
