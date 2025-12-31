"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AdminProtected } from "@/components/AdminProtected";
import { useAuth } from "@/app/providers/AuthProvider";

import type {
  CustomerSnapshot,
  FinanceCategory,
  Fulfillment,
  PaymentMethod,
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

import PosHeader from "@/components/admin/pos/PosHeader";
import OrderCard from "@/components/admin/pos/OrderCard";
import ProductsCard from "@/components/admin/pos/ProductsCard";
import CartCard from "@/components/admin/pos/CartCard";
import PaymentsCard from "@/components/admin/pos/PaymentsCard";
import SalesTable from "@/components/admin/pos/SalesTable";
import VoidSaleModal from "@/components/admin/pos/VoidSaleModal";
import { getUnitPrice } from "@/lib/adminPos/ui";

export default function AdminPosPage() {
  const { getAccessToken, user } = useAuth();
  const roles = (user?.roles ?? []).map((r: any) => String(r).toUpperCase());
  const canUsePos =
    roles.includes("ADMIN") || roles.includes("MANAGER") || roles.includes("CASHIER");

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

  const diff = useMemo(() => paymentsTotal - cartTotal, [paymentsTotal, cartTotal]);

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
  const [voidDefaultDateKey, setVoidDefaultDateKey] = useState<string | null>(null);

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
        it.productId === productId ? { ...it, note: noteVal?.trim() || null } : it
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
    setPayments((prev) => [...prev, { method: "TRANSFER", amount: 0, note: null }]);
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
          addressLine1: String(customerSnapshot.addressLine1 ?? "").trim() || null,
          addressLine2: String(customerSnapshot.addressLine2 ?? "").trim() || null,
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
      setErr(deliveryNeedsData ? "Delivery: completá al menos Nombre y Dirección." : "Agregá productos para crear el pedido.");
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

      const orderId = String(res?.id ?? res?._id ?? res?.order?.id ?? res?.order?._id ?? "");
      setOk(orderId ? `Pedido creado ✔ (Order: ${orderId})` : "Pedido creado ✔");
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
      setErr(deliveryNeedsData ? "Delivery: completá al menos Nombre y Dirección." : "Revisá carrito y pagos (pagos deben cubrir el total).");
      return;
    }

    const payloadPayments = payments
      .map((p) => ({ method: p.method, amount: num(p.amount), note: p.note ?? null }))
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
        items: cart.map((it) => ({ productId: it.productId, qty: num(it.qty), note: it.note ?? null })),
        payments: payloadPayments,
        concept: concept?.trim() ? concept.trim() : "VENTA POS",
        categoryId: categoryId || null,
      });

      setOk(`Venta creada ✔ (Sale: ${String(res?.sale?.id ?? res?.sale?._id ?? "OK")})`);
      setTimeout(() => setOk(null), 1600);

      clearCart();
      await loadSales();
    } catch (e: any) {
      setErr(String(e?.message || "Error en checkout"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmVoid({ saleId, reason, dateKey }: { saleId: string; reason: string; dateKey: string }) {
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

  // ---------------- UI helpers ----------------

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    if (!products.length) return;
    addToCart(products[0]);
  }

  return (
    <AdminProtected>
      <div className="space-y-6">
        <PosHeader
          dateKey={dateKey}
          setDateKey={setDateKey}
          cartTotal={cartTotal}
          paymentsTotal={paymentsTotal}
          diff={diff}
          fulfillment={fulfillment}
          busy={busy}
          loading={loading}
          canUsePos={canUsePos}
          err={err}
          ok={ok}
          onRefresh={refreshAll}
        />

        <OrderCard
          canUsePos={canUsePos}
          busy={busy}
          fulfillment={fulfillment}
          setFulfillment={setFulfillment}
          customerSnapshot={customerSnapshot}
          setCustomerSnapshot={setCustomerSnapshot}
          deliveryNeedsData={deliveryNeedsData}
          customerId={customerId}
          setCustomerId={setCustomerId}
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <ProductsCard
            canUsePos={canUsePos}
            busy={busy}
            q={q}
            setQ={setQ}
            products={products}
            loadingProducts={loadingProducts}
            onSearchClick={() => searchProducts(q)}
            onSearchKeyDown={onSearchKeyDown}
            onAddToCart={addToCart}
          />

          <CartCard
            canUsePos={canUsePos}
            busy={busy}
            cart={cart}
            cartTotal={cartTotal}
            onRemoveItem={removeCartItem}
            onSetQty={setCartQty}
            onSetNote={setCartNote}
            onClear={clearCart}
          />
        </div>

        <PaymentsCard
          canUsePos={canUsePos}
          busy={busy}
          loading={loading}
          creatingOrder={creatingOrder}
          payments={payments}
          onAddPaymentLine={addPaymentLine}
          onRemovePaymentLine={removePaymentLine}
          onUpdatePayment={updatePayment}
          cartTotal={cartTotal}
          paymentsTotal={paymentsTotal}
          diff={diff}
          fulfillment={fulfillment}
          deliveryNeedsData={deliveryNeedsData}
          concept={concept}
          setConcept={setConcept}
          categoryId={categoryId}
          setCategoryId={setCategoryId}
          note={note}
          setNote={setNote}
          activeCategories={activeCategories}
          canCreateOrder={canCreateOrder}
          canCheckout={canCheckout}
          onCreateOrderOnly={createOrderOnly}
          onCheckout={checkout}
        />

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
