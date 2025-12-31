// src/app/admin/pos/_lib/ui.tsx
import React from "react";
import {
  Banknote,
  BadgeDollarSign,
  CreditCard,
  Truck,
  Store,
  PackageOpen,
} from "lucide-react";
import type { Fulfillment, PaymentMethod, Product } from "./types";
import { num } from "./helpers";

export function paymentIcon(m: PaymentMethod) {
  if (m === "CASH") return <Banknote className="h-4 w-4" />;
  if (m === "TRANSFER") return <BadgeDollarSign className="h-4 w-4" />;
  if (m === "CARD") return <CreditCard className="h-4 w-4" />;
  return <BadgeDollarSign className="h-4 w-4" />;
}

export function fulfillmentMeta(f: Fulfillment) {
  if (f === "DINE_IN") return { label: "Salón", icon: <Store className="h-4 w-4" /> };
  if (f === "TAKEAWAY") return { label: "Take-away", icon: <PackageOpen className="h-4 w-4" /> };
  return { label: "Delivery", icon: <Truck className="h-4 w-4" /> };
}

export function getUnitPrice(p: Product) {
  const sale = p.salePrice != null ? num(p.salePrice) : null;
  const suggested =
    p.computed?.suggestedPrice != null ? num(p.computed.suggestedPrice) : null;
  return sale ?? suggested ?? 0;
}
