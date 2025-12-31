import React from "react";
import {
  BadgeDollarSign,
  Banknote,
  ClipboardList,
  CreditCard,
  PackageOpen,
  Store,
  Truck,
} from "lucide-react";
import type { Fulfillment, PaymentMethod, Product } from "./types";

/* =============================================================================
 * Helpers
 * ========================================================================== */

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function moneyARS(n: number) {
  const v = Number(n ?? 0) || 0;
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
}

export function num(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function isValidNumberDraft(v: string) {
  return v === "" || /^[0-9]*([.][0-9]*)?$/.test(v);
}

export function looksForbidden(msg: string) {
  const m = (msg || "").toLowerCase();
  return (
    m.includes("forbidden") ||
    m.includes("sin permisos") ||
    m.includes("prohibido")
  );
}

export function fmtDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-AR");
  } catch {
    return String(iso);
  }
}

export function todayKeyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/* =============================================================================
 * UI helpers
 * ========================================================================== */

export function statusPillClass(status: string) {
  const s = String(status || "").toUpperCase();
  if (s.includes("DRAFT"))
    return "border-zinc-200 bg-zinc-50 text-zinc-700";
  if (s.includes("ACCEPT") || s.includes("CONFIRM"))
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s.includes("REJECT"))
    return "border-rose-200 bg-rose-50 text-rose-700";
  if (s.includes("CANCEL"))
    return "border-amber-200 bg-amber-50 text-amber-800";
  if (s.includes("DELIVER"))
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-zinc-200 bg-white text-zinc-700";
}

export function salePillClass(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (!s) return "border-zinc-200 bg-zinc-50 text-zinc-700";
  if (s === "PAID") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (s === "DRAFT") return "border-amber-200 bg-amber-50 text-amber-800";
  if (s === "VOIDED") return "border-zinc-200 bg-zinc-100 text-zinc-600";
  return "border-zinc-200 bg-white text-zinc-700";
}

export function fulfillmentMeta(f: Fulfillment | string | undefined) {
  const x = String(f || "").toUpperCase();
  if (x === "DINE_IN")
    return { label: "Salón", icon: <Store className="h-4 w-4" /> };
  if (x === "TAKEAWAY")
    return { label: "Take-away", icon: <PackageOpen className="h-4 w-4" /> };
  if (x === "DELIVERY")
    return { label: "Delivery", icon: <Truck className="h-4 w-4" /> };
  return { label: String(f || "—"), icon: <ClipboardList className="h-4 w-4" /> };
}

export function getUnitPrice(p: Product) {
  const sale = p.salePrice != null ? num(p.salePrice) : null;
  const suggested =
    p.computed?.suggestedPrice != null ? num(p.computed.suggestedPrice) : null;
  return sale ?? suggested ?? 0;
}

export function paymentIcon(m: PaymentMethod) {
  if (m === "CASH") return <Banknote className="h-4 w-4" />;
  if (m === "TRANSFER") return <BadgeDollarSign className="h-4 w-4" />;
  return <CreditCard className="h-4 w-4" />;
}
