// src/app/admin/pos/_lib/api.ts
import { apiFetchAuthed } from "@/lib/apiAuthed";
import type { CheckoutResult, FinanceCategory, Product, SaleRow } from "./types";
import { num } from "./helpers";

export async function fetchFinanceCategories(getAccessToken: any) {
  const cats = await apiFetchAuthed<FinanceCategory[]>(
    getAccessToken,
    "/finance/categories"
  );
  return (cats ?? []).map((c: any) => ({
    id: String(c.id ?? c._id),
    name: c.name ?? "",
    type: c.type,
    isActive: c.isActive,
  })) as FinanceCategory[];
}

export async function fetchProducts(getAccessToken: any, query: string) {
  const qs = new URLSearchParams();
  qs.set("onlyActive", "true");
  qs.set("sellable", "true");
  if (query.trim()) qs.set("q", query.trim());

  const rows = await apiFetchAuthed<Product[]>(
    getAccessToken,
    `/products?${qs.toString()}`
  );

  return (rows ?? []).map((p: any) => ({
    id: String(p.id ?? p._id),
    name: p.name ?? "",
    salePrice: p.salePrice ?? null,
    computed: p.computed ?? null,
    isActive: p.isActive,
    sellable: p.sellable,
  })) as Product[];
}

export async function fetchSalesByDateKey(getAccessToken: any, dateKey: string) {
  const qs = new URLSearchParams();
  qs.set("dateKey", dateKey);
  qs.set("limit", "50");

  const rows = await apiFetchAuthed<SaleRow[]>(
    getAccessToken,
    `/sales?${qs.toString()}`
  );

  return (rows ?? []).map((s: any) => ({
    id: String(s.id ?? s._id),
    status: s.status,
    total: num(s.total ?? s.totals?.net ?? s.amount ?? 0),
    dateKey: s.dateKey ?? null,
    paidDateKey: s.paidDateKey ?? s.paid_dateKey ?? null,
    createdAt: s.createdAt ?? s.created_at ?? new Date().toISOString(),
    voidReason: s.voidReason ?? null,
  })) as SaleRow[];
}

export async function postCreateOrder(getAccessToken: any, body: any) {
  return apiFetchAuthed<any>(getAccessToken, "/orders", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function postPosCheckout(getAccessToken: any, body: any) {
  return apiFetchAuthed<CheckoutResult>(getAccessToken, "/pos/checkout", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function patchVoidSale(
  getAccessToken: any,
  saleId: string,
  body: { reason?: string | null; dateKey?: string | null }
) {
  return apiFetchAuthed(getAccessToken, `/sales/${saleId}/void`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
