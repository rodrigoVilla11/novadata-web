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
  Truck,
  X,
  PackageSearch,
  Pencil,
  Trash2,
  Send,
  BadgeCheck,
  Ban,
  ClipboardList,
  FileText,
} from "lucide-react";

// ------------------------------------
// Suppliers (frontend types)
// ------------------------------------
type SupplierWorkMode = "IMMEDIATE" | "AGAINST_INVOICE" | "ACCOUNT" | "MIXED";
type Weekday = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

type Supplier = {
  id: string;
  name: string;
  isActive: boolean;

  contactName?: string | null;
  phone?: string | null;
  email?: string | null;

  taxId?: string | null;
  address?: string | null;

  workMode?: SupplierWorkMode;
  paymentDays?: number | null;

  orderDays?: Weekday[];
  leadTimeDays?: number | null;
  cutoffTime?: string | null;

  notes?: string | null;
};

// ------------------------------
// Ingredients (frontend types)
// ------------------------------
type IngredientLite = {
  id: string;
  name: string;
  displayName?: string | null;
  baseUnit?: string | null;
  supplierId?: string | null;
  name_for_supplier?: string | null;
  cost?: { lastCost?: number; currency?: "ARS" | "USD" };
};

// ------------------------------
// Purchase Orders (frontend types)
// ------------------------------
type PurchaseOrderStatus =
  | "DRAFT"
  | "SENT"
  | "CONFIRMED"
  | "RECEIVED_PARTIAL"
  | "RECEIVED"
  | "CANCELLED";

type PurchaseOrderItem = {
  ingredientId: string;
  ingredientName?: string;
  name_for_supplier?: string | null;
  qty: number;
  unit?: string;
  approxUnitPrice?: number;
  approxLineTotal?: number;
  realUnitPrice?: number | null;
  realLineTotal?: number | null;
  receivedQty?: number;
  note?: string | null;
};

type PurchaseOrder = {
  id: string;
  supplierId: string;
  supplierName: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDate?: string | null;
  notes?: string | null;
  totals?: {
    approxTotal: number;
    realTotal?: number | null;
    currency: "ARS" | "USD";
  };
  invoice?: {
    imageUrl?: string | null;
    invoiceNumber?: string | null;
    invoiceDate?: string | null;
  };
  items: PurchaseOrderItem[];
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
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

function money(n: number, currency: "ARS" | "USD" = "ARS") {
  const v = Number(n ?? 0) || 0;
  try {
    return v.toLocaleString("es-AR", { style: "currency", currency });
  } catch {
    return v.toLocaleString("es-AR");
  }
}

function prettyIngredientName(i: IngredientLite) {
  return (i.displayName || i.name || "").trim();
}

function isOrderClosed(status: PurchaseOrderStatus) {
  return status === "RECEIVED" || status === "CANCELLED";
}

function canReceive(status: PurchaseOrderStatus) {
  return status === "SENT" || status === "CONFIRMED" || status === "RECEIVED_PARTIAL";
}

function poStatusLabel(s: PurchaseOrderStatus) {
  switch (s) {
    case "DRAFT":
      return "Borrador";
    case "SENT":
      return "Enviado";
    case "CONFIRMED":
      return "Confirmado";
    case "RECEIVED_PARTIAL":
      return "Recibido parcial";
    case "RECEIVED":
      return "Recibido";
    case "CANCELLED":
      return "Cancelado";
    default:
      return s;
  }
}

function poStatusClasses(s: PurchaseOrderStatus) {
  switch (s) {
    case "RECEIVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "RECEIVED_PARTIAL":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "CONFIRMED":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "SENT":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "CANCELLED":
      return "border-red-200 bg-red-50 text-red-700";
    case "DRAFT":
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }
}

const WEEKDAY_LABEL: Record<Weekday, string> = {
  MON: "Lun",
  TUE: "Mar",
  WED: "Mié",
  THU: "Jue",
  FRI: "Vie",
  SAT: "Sáb",
  SUN: "Dom",
};

function workModeLabel(m?: SupplierWorkMode) {
  switch (m) {
    case "IMMEDIATE":
      return "Pago inmediato";
    case "AGAINST_INVOICE":
      return "Contra factura";
    case "ACCOUNT":
      return "Cuenta corriente";
    case "MIXED":
      return "Mixto";
    default:
      return "—";
  }
}

function formatOrderDays(days?: Weekday[]) {
  const arr = Array.isArray(days) ? days : [];
  if (!arr.length) return "—";
  return arr.map((d) => WEEKDAY_LABEL[d]).join(", ");
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Cordoba",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function numStr(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

// ------------------------------
// Supplier Edit Modal
// ------------------------------
function SupplierModal({
  open,
  onClose,
  initial,
  onSave,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  initial: Supplier | null;
  busy: boolean;
  onSave: (patch: Partial<Supplier>) => void;
}) {
  const [form, setForm] = useState<Partial<Supplier>>({});

  useEffect(() => {
    if (!open || !initial) return;
    setForm({
      name: initial.name ?? "",
      contactName: initial.contactName ?? null,
      phone: initial.phone ?? null,
      email: initial.email ?? null,
      taxId: initial.taxId ?? null,
      address: initial.address ?? null,
      workMode: (initial.workMode ?? "IMMEDIATE") as SupplierWorkMode,
      paymentDays: initial.paymentDays ?? null,
      orderDays: initial.orderDays ?? [],
      leadTimeDays: initial.leadTimeDays ?? null,
      cutoffTime: initial.cutoffTime ?? null,
      notes: initial.notes ?? null,
    });
  }, [open, initial]);

  if (!open || !initial) return null;

  const orderDays = (form.orderDays ?? []) as Weekday[];

  function toggleDay(d: Weekday) {
    const has = orderDays.includes(d);
    const next = has ? orderDays.filter((x) => x !== d) : [...orderDays, d];
    setForm((p) => ({ ...p, orderDays: next }));
  }

  const isAccount = form.workMode === "ACCOUNT";
  const paymentDaysStr = form.paymentDays == null ? "" : String(form.paymentDays);

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-10 w-[min(920px,92vw)] -translate-x-1/2 rounded-3xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-xs text-zinc-500">Editar proveedor</div>
            <div className="text-lg font-semibold text-zinc-900">{initial.name}</div>
          </div>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            <span className="inline-flex items-center gap-2">
              <X className="h-4 w-4" />
              Cerrar
            </span>
          </Button>
        </div>

        <div className="p-5 space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre">
              <Input
                value={(form.name ?? "") as string}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Distribuidora Pepe"
              />
            </Field>

            <Field label="Forma de trabajo">
              <Select
                value={(form.workMode ?? "IMMEDIATE") as string}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    workMode: e.target.value as SupplierWorkMode,
                    paymentDays: e.target.value === "IMMEDIATE" ? null : p.paymentDays ?? null,
                  }))
                }
              >
                <option value="IMMEDIATE">Pago inmediato</option>
                <option value="AGAINST_INVOICE">Contra factura</option>
                <option value="ACCOUNT">Cuenta corriente</option>
                <option value="MIXED">Mixto</option>
              </Select>
            </Field>

            <Field label="Pago a X días (solo si cuenta corriente)">
              <Input
                value={paymentDaysStr}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    paymentDays: e.target.value.trim() === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder={isAccount ? "Ej: 15 / 30 / 45" : "—"}
                inputMode="numeric"
                disabled={!isAccount}
              />
            </Field>

            <Field label="Días de pedido">
              <div className="flex flex-wrap gap-2">
                {(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as Weekday[]).map((d) => {
                  const active = orderDays.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(d)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm",
                        active
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                      )}
                    >
                      {WEEKDAY_LABEL[d]}
                    </button>
                  );
                })}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Seleccionados: <b>{formatOrderDays(orderDays)}</b>
              </div>
            </Field>

            <Field label="Hora límite (cutoff)">
              <Input
                value={(form.cutoffTime ?? "") as string}
                onChange={(e) => setForm((p) => ({ ...p, cutoffTime: e.target.value }))}
                placeholder='Ej: "12:00"'
              />
            </Field>

            <Field label="Entrega en (días)">
              <Input
                value={form.leadTimeDays == null ? "" : String(form.leadTimeDays)}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    leadTimeDays: e.target.value.trim() === "" ? null : Number(e.target.value),
                  }))
                }
                placeholder="Ej: 1 / 2 / 3"
                inputMode="numeric"
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Contacto">
              <Input
                value={(form.contactName ?? "") as string}
                onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))}
              />
            </Field>
            <Field label="Teléfono">
              <Input
                value={(form.phone ?? "") as string}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </Field>
            <Field label="Email">
              <Input
                value={(form.email ?? "") as string}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </Field>
            <Field label="CUIT / Tax ID">
              <Input
                value={(form.taxId ?? "") as string}
                onChange={(e) => setForm((p) => ({ ...p, taxId: e.target.value }))}
              />
            </Field>
            <Field label="Dirección">
              <Input
                value={(form.address ?? "") as string}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              />
            </Field>
            <Field label="Notas">
              <Input
                value={(form.notes ?? "") as string}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-2 border-t pt-4">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button
              onClick={() => onSave(form)}
              loading={busy}
              disabled={busy || !String(form.name ?? "").trim()}
            >
              Guardar cambios
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------
// Ingredient picker
// ------------------------------
function IngredientPicker({
  open,
  onClose,
  supplier,
  getAccessToken,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  supplier: Supplier;
  getAccessToken: any;
  onPick: (ing: IngredientLite) => void;
}) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<IngredientLite[]>([]);
  const [err, setErr] = useState<string | null>(null);

  async function loadList(query: string) {
    setLoading(true);
    setErr(null);
    try {
      const url = `/ingredients?limit=200&supplierId=${encodeURIComponent(
        supplier.id
      )}${query.trim() ? `&q=${encodeURIComponent(query.trim())}` : ""}`;

      const data = await apiFetchAuthed<IngredientLite[]>(getAccessToken, url);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || "Error cargando ingredientes");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setQ("");
    setItems([]);
    loadList("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, supplier.id]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => loadList(q), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-10 w-[min(920px,92vw)] -translate-x-1/2 rounded-3xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-xs text-zinc-500">Seleccionar ingrediente</div>
            <div className="text-lg font-semibold text-zinc-900">{supplier.name}</div>
          </div>
          <Button variant="secondary" onClick={onClose}>
            <span className="inline-flex items-center gap-2">
              <X className="h-4 w-4" />
              Cerrar
            </span>
          </Button>
        </div>

        <div className="p-5 space-y-4">
          <div className="relative">
            <PackageSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar ingrediente…"
              className="pl-9"
            />
          </div>

          {err && <Notice tone="error">{err}</Notice>}

          <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Ingrediente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Unidad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Últ. costo
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {loading && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-sm text-zinc-500">
                      Cargando…
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-sm text-zinc-500">
                      No hay ingredientes para este proveedor.
                    </td>
                  </tr>
                )}

                {!loading &&
                  items.map((ing) => (
                    <tr key={ing.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-zinc-900">
                          {prettyIngredientName(ing)}
                        </div>
                        {ing.name_for_supplier && (
                          <div className="text-xs text-zinc-500">
                            Prov: {ing.name_for_supplier}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {ing.baseUnit || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {money(ing.cost?.lastCost ?? 0, ing.cost?.currency ?? "ARS")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button onClick={() => onPick(ing)} variant="secondary">
                          Elegir
                        </Button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-zinc-500">
            Si tu endpoint de ingredientes no soporta <b>supplierId</b> o <b>q</b>, decime y lo adapto.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminSuppliersPage() {
  const { getAccessToken } = useAuth();

  const [items, setItems] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // create supplier (fields)
  const [name, setName] = useState("");
  const [workMode, setWorkMode] = useState<SupplierWorkMode>("IMMEDIATE");
  const [paymentDays, setPaymentDays] = useState<string>("");
  const [orderDays, setOrderDays] = useState<Weekday[]>([]);
  const [cutoffTime, setCutoffTime] = useState<string>("");
  const [leadTimeDays, setLeadTimeDays] = useState<string>("");

  // optional contact fields
  const [contactName, setContactName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [taxId, setTaxId] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // search supplier
  const [q, setQ] = useState("");

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);

  // drawer crear proveedor
  const [createOpen, setCreateOpen] = useState(false);

  function openCreate() {
    setCreateOpen(true);
    setErr(null);
    setOk(null);
  }

  function closeCreate() {
    setCreateOpen(false);
    // reset (opcional pero recomendado)
    setName("");
    setWorkMode("IMMEDIATE");
    setPaymentDays("");
    setOrderDays([]);
    setCutoffTime("");
    setLeadTimeDays("");
    setContactName("");
    setPhone("");
    setEmail("");
    setTaxId("");
    setAddress("");
    setNotes("");
  }

  // ----------------------
  // Orders drawer state
  // ----------------------
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersBusy, setOrdersBusy] = useState(false);

  // create order form
  const [poNotes, setPoNotes] = useState("");
  const [poLines, setPoLines] = useState<
    Array<{
      ingredientId: string;
      ingredientLabel?: string;
      unit?: string | null;
      lastCost?: number;
      currency?: "ARS" | "USD";
      qty: string;
    }>
  >([{ ingredientId: "", qty: "" }]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetIndex, setPickerTargetIndex] = useState<number | null>(null);

  // receive form (drafts per ingredient)
  const [receivePrices, setReceivePrices] = useState<Record<string, string>>({});
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});

  // invoice url per order (controlled locally)
  const [invoiceUrlByOrder, setInvoiceUrlByOrder] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter((s) => s.name.toLowerCase().includes(qq));
  }, [items, q]);

  const totals = useMemo(() => {
    const total = items.length;
    const active = items.filter((s) => s.isActive).length;
    return { total, active, inactive: total - active };
  }, [items]);

  function flashOk(msg: string) {
    setOk(msg);
    window.setTimeout(() => setOk(null), 1600);
  }

  async function load() {
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      const data = await apiFetchAuthed<Supplier[]>(getAccessToken, "/suppliers");
      setItems(Array.isArray(data) ? data : []);
      flashOk("Datos actualizados ✔");
    } catch (e: any) {
      setErr(e?.message || "Error cargando proveedores");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCreateDay(d: Weekday) {
    setOrderDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function create(): Promise<boolean> {
    if (!name.trim()) return false;

    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      const payload: any = {
        name: name.trim(),
        workMode,
        orderDays,
        cutoffTime: cutoffTime.trim() || null,
        leadTimeDays: leadTimeDays.trim() ? Number(leadTimeDays) : null,

        contactName: contactName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        taxId: taxId.trim() || null,
        address: address.trim() || null,
        notes: notes.trim() || null,
      };

      if (workMode === "ACCOUNT") {
        payload.paymentDays = paymentDays.trim() ? Number(paymentDays) : null;
      } else {
        payload.paymentDays = null;
      }

      await apiFetchAuthed(getAccessToken, "/suppliers", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      flashOk("Proveedor creado ✔");
      await load();
      return true;
    } catch (e: any) {
      setErr(e?.message || "Error creando proveedor");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(patch: Partial<Supplier>) {
    if (!editSupplier) return;

    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/suppliers/${editSupplier.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      flashOk("Proveedor actualizado ✔");
      setEditOpen(false);
      setEditSupplier(null);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Error actualizando proveedor");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(s: Supplier) {
    const next = !s.isActive;
    const confirmMsg = next
      ? `¿Reactivar "${s.name}"?`
      : `¿Desactivar "${s.name}"?\n\nNo aparecerá para cargar conteos.`;
    if (!window.confirm(confirmMsg)) return;

    setErr(null);
    setOk(null);
    setBusy(true);
    try {
      await apiFetchAuthed(getAccessToken, `/suppliers/${s.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: next }),
      });

      flashOk(next ? "Proveedor reactivado ✔" : "Proveedor desactivado ✔");
      await load();
    } catch (e: any) {
      setErr(e?.message || "Error actualizando proveedor");
    } finally {
      setBusy(false);
    }
  }

  // ----------------------
  // Orders helpers
  // ----------------------
  async function loadOrders(supplierId: string) {
    setOrdersLoading(true);
    setErr(null);
    try {
      const data = await apiFetchAuthed<PurchaseOrder[]>(
        getAccessToken,
        `/purchase-orders?supplierId=${encodeURIComponent(supplierId)}&limit=100`
      );
      const arr = Array.isArray(data) ? data : [];
      setOrders(arr);

      const seed: Record<string, string> = {};
      for (const o of arr) seed[o.id] = o.invoice?.imageUrl ?? "";
      setInvoiceUrlByOrder(seed);
    } catch (e: any) {
      setErr(e?.message || "Error cargando pedidos");
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }

  function openOrders(s: Supplier) {
    setSelectedSupplier(s);
    setOrdersOpen(true);
    setOrders([]);
    setPoNotes("");
    setPoLines([{ ingredientId: "", qty: "" }]);
    setReceivePrices({});
    setReceiveQtys({});
    setInvoiceUrlByOrder({});
    loadOrders(s.id);
  }

  function closeOrders() {
    setOrdersOpen(false);
    setSelectedSupplier(null);
    setOrders([]);
    setPoNotes("");
    setPoLines([{ ingredientId: "", qty: "" }]);
    setReceivePrices({});
    setReceiveQtys({});
    setInvoiceUrlByOrder({});
  }

  function addLine() {
    setPoLines((prev) => [...prev, { ingredientId: "", qty: "" }]);
  }

  function removeLine(i: number) {
    setPoLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function setLine(
    i: number,
    patch: Partial<{
      ingredientId: string;
      ingredientLabel?: string;
      unit?: string | null;
      lastCost?: number;
      currency?: "ARS" | "USD";
      qty: string;
    }>
  ) {
    setPoLines((prev) => prev.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  function openPickerForLine(i: number) {
    setPickerTargetIndex(i);
    setPickerOpen(true);
  }

  function onPickIngredient(ing: IngredientLite) {
    const i = pickerTargetIndex;
    if (i == null) return;
    setLine(i, {
      ingredientId: ing.id,
      ingredientLabel: prettyIngredientName(ing),
      unit: ing.baseUnit ?? null,
      lastCost: ing.cost?.lastCost ?? 0,
      currency: ing.cost?.currency ?? "ARS",
    });
    setPickerOpen(false);
    setPickerTargetIndex(null);
  }

  async function createOrder() {
    if (!selectedSupplier) return;

    const itemsPayload = poLines
      .map((l) => ({
        ingredientId: l.ingredientId.trim(),
        qty: Number(l.qty),
      }))
      .filter((x) => x.ingredientId && Number.isFinite(x.qty) && x.qty > 0)
      .map((x) => ({
        ingredientId: x.ingredientId,
        qty: x.qty,
      }));

    if (!itemsPayload.length) {
      setErr("Agregá al menos 1 ingrediente con cantidad > 0");
      return;
    }

    setOrdersBusy(true);
    setErr(null);
    try {
      await apiFetchAuthed(getAccessToken, "/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          supplierId: selectedSupplier.id,
          notes: poNotes.trim() || null,
          items: itemsPayload,
        }),
      });
      flashOk("Pedido creado ✔");
      await loadOrders(selectedSupplier.id);

      setPoNotes("");
      setPoLines([{ ingredientId: "", qty: "" }]);
    } catch (e: any) {
      setErr(e?.message || "Error creando pedido");
    } finally {
      setOrdersBusy(false);
    }
  }

  async function setOrderStatus(orderId: string, status: PurchaseOrderStatus) {
    setOrdersBusy(true);
    setErr(null);
    try {
      await apiFetchAuthed(getAccessToken, `/purchase-orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      flashOk("Estado actualizado ✔");
      if (selectedSupplier) await loadOrders(selectedSupplier.id);
    } catch (e: any) {
      setErr(e?.message || "Error actualizando estado");
    } finally {
      setOrdersBusy(false);
    }
  }

  async function receiveOrder(order: PurchaseOrder) {
    const payloadItems = (order.items || [])
      .map((it) => {
        const qtyStr = receiveQtys[it.ingredientId];
        const priceStr = receivePrices[it.ingredientId];

        const p: any = { ingredientId: it.ingredientId };

        if (qtyStr != null && qtyStr.trim() !== "") {
          const n = Number(qtyStr);
          if (!Number.isFinite(n) || n < 0) return null;
          p.receivedQty = n;
        }

        if (priceStr != null && priceStr.trim() !== "") {
          const n = Number(priceStr);
          if (!Number.isFinite(n) || n < 0) return null;
          p.realUnitPrice = n;
        }

        const has = p.receivedQty != null || p.realUnitPrice != null;
        return has ? p : null;
      })
      .filter(Boolean);

    if (!payloadItems.length) {
      setErr("Cargá al menos una cantidad recibida o un precio real (en algún ítem).");
      return;
    }

    setOrdersBusy(true);
    setErr(null);
    try {
      await apiFetchAuthed(getAccessToken, `/purchase-orders/${order.id}/receive`, {
        method: "PATCH",
        body: JSON.stringify({ items: payloadItems }),
      });

      flashOk("Recepción aplicada ✔ (stock actualizado)");
      setReceivePrices({});
      setReceiveQtys({});

      if (selectedSupplier) await loadOrders(selectedSupplier.id);
    } catch (e: any) {
      setErr(e?.message || "Error aplicando recepción");
    } finally {
      setOrdersBusy(false);
    }
  }

  async function attachInvoice(orderId: string) {
    const imageUrl = (invoiceUrlByOrder[orderId] ?? "").trim();
    if (!imageUrl) {
      setErr("Pegá la URL de la factura primero");
      return;
    }

    setOrdersBusy(true);
    setErr(null);
    try {
      await apiFetchAuthed(getAccessToken, `/purchase-orders/${orderId}/invoice`, {
        method: "PATCH",
        body: JSON.stringify({ imageUrl }),
      });
      flashOk("Factura adjuntada ✔");
      if (selectedSupplier) await loadOrders(selectedSupplier.id);
    } catch (e: any) {
      setErr(e?.message || "Error adjuntando factura");
    } finally {
      setOrdersBusy(false);
    }
  }

  // ----------------------
  // Derived
  // ----------------------
  const ordersStats = useMemo(() => {
    const open = orders.filter((o) => !isOrderClosed(o.status)).length;
    const drafts = orders.filter((o) => o.status === "DRAFT").length;
    const pendingReceive = orders.filter((o) => canReceive(o.status)).length;
    return { open, drafts, pendingReceive };
  }, [orders]);

  return (
    <AdminProtected>
      <div className="space-y-6">
        {/* Header */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
                Proveedores
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Creá, configurá forma de trabajo y días de pedido.
              </p>

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <span className="text-zinc-700">
                  Total: <b>{totals.total}</b>
                </span>
                <span className="text-emerald-700">
                  Activos: <b>{totals.active}</b>
                </span>
                <span className="text-zinc-600">
                  Inactivos: <b>{totals.inactive}</b>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button onClick={openCreate} disabled={busy}>
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Crear
                </span>
              </Button>

              <Button
                variant="secondary"
                onClick={load}
                loading={loading}
                disabled={busy}
              >
                <span className="inline-flex items-center gap-2">
                  <RefreshCcw className="h-4 w-4" />
                </span>
              </Button>
            </div>
          </div>
        </div>

        {/* Notices */}
        {(err || ok) && (
          <div className="grid gap-2">
            {err && <Notice tone="error">{err}</Notice>}
            {!err && ok && <Notice tone="ok">{ok}</Notice>}
          </div>
        )}

        {/* Toolbar (Search) */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar proveedor…"
                className="pl-9"
              />
            </div>

            <div className="text-sm text-zinc-500">
              {q.trim()
                ? `${filtered.length} de ${items.length}`
                : `${items.length} proveedor(es)`}
            </div>
          </div>
        </div>

        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-100 px-5 py-4">
            <h2 className="text-lg font-semibold text-zinc-900">Listado</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Tip: usá “Editar” para setear forma de trabajo y días de pedido.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Trabajo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Días pedido
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-sm text-zinc-500">
                      Cargando…
                    </td>
                  </tr>
                )}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-sm text-zinc-500">
                      No hay proveedores.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50 transition">
                      <td className="px-4 py-3 text-sm font-semibold text-zinc-900">
                        {s.name}
                        <div className="mt-1 text-xs text-zinc-500">
                          {s.phone ? `📞 ${s.phone}` : ""}{" "}
                          {s.email ? ` · ✉️ ${s.email}` : ""}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {workModeLabel(s.workMode)}
                        {s.workMode === "ACCOUNT" && s.paymentDays ? (
                          <div className="text-xs text-zinc-500">
                            {s.paymentDays} días
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3 text-sm text-zinc-700">
                        {formatOrderDays(s.orderDays)}
                        {(s.cutoffTime || s.leadTimeDays != null) && (
                          <div className="text-xs text-zinc-500">
                            {s.cutoffTime ? `Cutoff ${s.cutoffTime}` : ""}
                            {s.cutoffTime && s.leadTimeDays != null ? " · " : ""}
                            {s.leadTimeDays != null ? `Entrega ${s.leadTimeDays}d` : ""}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <StatusPill active={s.isActive} />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => openOrders(s)}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Truck className="h-4 w-4" />
                              Pedidos
                            </span>
                          </Button>

                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => {
                              setEditSupplier(s);
                              setEditOpen(true);
                            }}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Pencil className="h-4 w-4" />
                              Editar
                            </span>
                          </Button>

                          <Button
                            variant={s.isActive ? "danger" : "secondary"}
                            disabled={busy}
                            onClick={() => toggleActive(s)}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Power className="h-4 w-4" />
                              {s.isActive ? "Desactivar" : "Reactivar"}
                            </span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-zinc-100 px-5 py-4 text-xs text-zinc-500">
            Siguiente: en Stock usamos estos datos para sugerir día de pedido y cutoff automáticamente.
          </div>
        </div>

        {/* Edit Modal */}
        <SupplierModal
          open={editOpen}
          onClose={() => {
            setEditOpen(false);
            setEditSupplier(null);
          }}
          initial={editSupplier}
          busy={busy}
          onSave={saveEdit}
        />

        {/* Drawer: Crear Proveedor */}
        {createOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30" onClick={closeCreate} />

            <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <div className="text-xs text-zinc-500">Nuevo proveedor</div>
                  <div className="text-lg font-semibold text-zinc-900">Crear proveedor</div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={closeCreate} disabled={busy}>
                    <span className="inline-flex items-center gap-2">
                      <X className="h-4 w-4" />
                      Cerrar
                    </span>
                  </Button>
                </div>
              </div>

              <div className="h-[calc(100%-64px)] overflow-y-auto p-5 space-y-6">
                <div className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <div className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Field label="Nombre">
                        <div className="relative">
                          <Truck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                          <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej: Distribuidora Pepe"
                            className="pl-9"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (async () => {
                                  const created = await create();
                                  if (created) closeCreate();
                                })();
                              }
                            }}
                          />
                        </div>
                      </Field>

                      <Field label="Forma de trabajo">
                        <Select
                          value={workMode}
                          onChange={(e) => {
                            const v = e.target.value as SupplierWorkMode;
                            setWorkMode(v);
                            if (v !== "ACCOUNT") setPaymentDays("");
                          }}
                        >
                          <option value="IMMEDIATE">Pago inmediato</option>
                          <option value="AGAINST_INVOICE">Contra factura</option>
                          <option value="ACCOUNT">Cuenta corriente</option>
                          <option value="MIXED">Mixto</option>
                        </Select>
                      </Field>

                      <Field label="Pago a X días (cuenta corriente)">
                        <Input
                          value={paymentDays}
                          onChange={(e) => setPaymentDays(e.target.value)}
                          placeholder="Ej: 15 / 30 / 45"
                          inputMode="numeric"
                          disabled={workMode !== "ACCOUNT"}
                        />
                      </Field>

                      <Field label="Días de pedido">
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(WEEKDAY_LABEL) as Weekday[]).map((d) => {
                            const active = orderDays.includes(d);
                            return (
                              <button
                                key={d}
                                type="button"
                                onClick={() => toggleCreateDay(d)}
                                className={cn(
                                  "rounded-full border px-3 py-1 text-sm",
                                  active
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                                )}
                              >
                                {WEEKDAY_LABEL[d]}
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Seleccionados: <b>{formatOrderDays(orderDays)}</b>
                        </div>
                      </Field>

                      <Field label="Hora límite (cutoff)">
                        <Input
                          value={cutoffTime}
                          onChange={(e) => setCutoffTime(e.target.value)}
                          placeholder='Ej: "12:00"'
                        />
                      </Field>

                      <Field label="Entrega en (días)">
                        <Input
                          value={leadTimeDays}
                          onChange={(e) => setLeadTimeDays(e.target.value)}
                          placeholder="Ej: 1 / 2 / 3"
                          inputMode="numeric"
                        />
                      </Field>
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Contacto">
                        <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
                      </Field>
                      <Field label="Teléfono">
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                      </Field>
                      <Field label="Email">
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} />
                      </Field>
                      <Field label="CUIT / Tax ID">
                        <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
                      </Field>
                      <Field label="Dirección">
                        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                      </Field>
                      <Field label="Notas">
                        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
                      </Field>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="secondary" onClick={closeCreate} disabled={busy}>
                        Cancelar
                      </Button>

                      <Button
                        onClick={async () => {
                          const created = await create();
                          if (created) closeCreate();
                        }}
                        loading={busy}
                        disabled={busy || !name.trim()}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Crear proveedor
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-zinc-500">
                  Tip: si un proveedor no aparece en conteos, revisá que esté <b>ACTIVO</b>.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Orders Drawer */}
        {ordersOpen && selectedSupplier && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/30" onClick={closeOrders} />
            <div className="absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <div className="text-xs text-zinc-500">Pedidos a proveedor</div>
                  <div className="text-lg font-semibold text-zinc-900">
                    {selectedSupplier.name}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600">
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">
                      Abiertos: <b>{ordersStats.open}</b>
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">
                      Borrador: <b>{ordersStats.drafts}</b>
                    </span>
                    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">
                      Para recibir: <b>{ordersStats.pendingReceive}</b>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => loadOrders(selectedSupplier.id)}
                    disabled={ordersBusy}
                    loading={ordersLoading}
                  >
                    <span className="inline-flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4" />
                      Actualizar
                    </span>
                  </Button>
                  <Button variant="secondary" onClick={closeOrders}>
                    Cerrar
                  </Button>
                </div>
              </div>

              <div className="h-[calc(100%-64px)] overflow-y-auto p-5 space-y-6">
                {/* Crear pedido */}
                <Card>
                  <CardHeader title="Crear pedido" subtitle="Agregá ingredientes y cantidad" />
                  <CardBody>
                    <div className="space-y-4">
                      <Field label="Notas (opcional)">
                        <Input
                          value={poNotes}
                          onChange={(e) => setPoNotes(e.target.value)}
                          placeholder="Ej: entregar antes del mediodía..."
                        />
                      </Field>

                      <div className="rounded-2xl border border-zinc-200 overflow-hidden">
                        <table className="min-w-full">
                          <thead className="bg-zinc-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Ingrediente
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Cantidad
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Unidad
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                Últ. costo
                              </th>
                              <th className="px-4 py-3" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {poLines.map((l, idx) => (
                              <tr key={idx} className="hover:bg-zinc-50">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="secondary"
                                      onClick={() => openPickerForLine(idx)}
                                    >
                                      Elegir
                                    </Button>
                                    <div className="min-w-0">
                                      <div className="text-sm font-semibold text-zinc-900 truncate">
                                        {l.ingredientLabel || "—"}
                                      </div>
                                      <div className="text-xs text-zinc-500 truncate">
                                        {l.ingredientId ? l.ingredientId : ""}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <Input
                                    value={l.qty}
                                    onChange={(e) => setLine(idx, { qty: e.target.value })}
                                    inputMode="decimal"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-zinc-700">
                                  {l.unit || "—"}
                                </td>
                                <td className="px-4 py-3 text-sm text-zinc-700">
                                  {money(l.lastCost ?? 0, l.currency ?? "ARS")}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    variant="danger"
                                    onClick={() => removeLine(idx)}
                                    disabled={poLines.length <= 1}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <Trash2 className="h-4 w-4" />
                                    </span>
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button variant="secondary" onClick={addLine}>
                          <span className="inline-flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Agregar línea
                          </span>
                        </Button>

                        <Button onClick={createOrder} loading={ordersBusy} disabled={ordersBusy}>
                          <span className="inline-flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            Crear pedido
                          </span>
                        </Button>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                {/* Listado pedidos */}
                <Card>
                  <CardHeader title="Pedidos" subtitle="Historial y acciones" />
                  <CardBody>
                    {ordersLoading ? (
                      <div className="text-sm text-zinc-500">Cargando…</div>
                    ) : orders.length === 0 ? (
                      <div className="text-sm text-zinc-500">No hay pedidos para este proveedor.</div>
                    ) : (
                      <div className="space-y-4">
                        {orders.map((o) => (
                          <div
                            key={o.id}
                            className="rounded-2xl border border-zinc-200 bg-white p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <div className="text-sm font-semibold text-zinc-900">
                                    Pedido #{o.id.slice(-6)}
                                  </div>
                                  <span
                                    className={cn(
                                      "rounded-full border px-2.5 py-1 text-xs font-semibold",
                                      poStatusClasses(o.status)
                                    )}
                                  >
                                    {poStatusLabel(o.status)}
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-zinc-600">
                                  Fecha: <b>{fmtDate(o.orderDate)}</b>
                                  {o.expectedDate ? (
                                    <>
                                      {" "}
                                      · Esperada: <b>{fmtDate(o.expectedDate)}</b>
                                    </>
                                  ) : null}
                                </div>
                                {o.notes ? (
                                  <div className="mt-2 text-sm text-zinc-700">
                                    <b>Notas:</b> {o.notes}
                                  </div>
                                ) : null}

                                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                                  <span className="text-zinc-700">
                                    Aprox:{" "}
                                    <b>
                                      {money(o.totals?.approxTotal ?? 0, o.totals?.currency ?? "ARS")}
                                    </b>
                                  </span>
                                  <span className="text-zinc-700">
                                    Real:{" "}
                                    <b>
                                      {o.totals?.realTotal == null
                                        ? "—"
                                        : money(o.totals.realTotal, o.totals.currency)}
                                    </b>
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {!isOrderClosed(o.status) && (
                                  <>
                                    {o.status === "DRAFT" && (
                                      <Button
                                        variant="secondary"
                                        onClick={() => setOrderStatus(o.id, "SENT")}
                                        disabled={ordersBusy}
                                      >
                                        <span className="inline-flex items-center gap-2">
                                          <Send className="h-4 w-4" />
                                          Marcar Enviado
                                        </span>
                                      </Button>
                                    )}

                                    {o.status === "SENT" && (
                                      <Button
                                        variant="secondary"
                                        onClick={() => setOrderStatus(o.id, "CONFIRMED")}
                                        disabled={ordersBusy}
                                      >
                                        <span className="inline-flex items-center gap-2">
                                          <BadgeCheck className="h-4 w-4" />
                                          Confirmar
                                        </span>
                                      </Button>
                                    )}

                                    <Button
                                      variant="danger"
                                      onClick={() => {
                                        if (!window.confirm("¿Cancelar este pedido?")) return;
                                        setOrderStatus(o.id, "CANCELLED");
                                      }}
                                      disabled={ordersBusy}
                                    >
                                      <span className="inline-flex items-center gap-2">
                                        <Ban className="h-4 w-4" />
                                        Cancelar
                                      </span>
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Items */}
                            <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
                              <table className="min-w-full">
                                <thead className="bg-zinc-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                      Ingrediente
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                      Pedido
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                      Recibido
                                    </th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                      Precio real
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                  {(o.items || []).map((it) => (
                                    <tr key={it.ingredientId} className="hover:bg-zinc-50">
                                      <td className="px-3 py-2">
                                        <div className="text-sm font-semibold text-zinc-900">
                                          {it.ingredientName || it.ingredientId}
                                        </div>
                                        {it.name_for_supplier ? (
                                          <div className="text-xs text-zinc-500">
                                            Prov: {it.name_for_supplier}
                                          </div>
                                        ) : null}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-zinc-700">
                                        {it.qty} {it.unit || ""}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-zinc-700">
                                        {Number(it.receivedQty ?? 0)} {it.unit || ""}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-zinc-700">
                                        {it.realUnitPrice == null ? "—" : money(it.realUnitPrice, o.totals?.currency ?? "ARS")}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Recepción */}
                            {canReceive(o.status) && (
                              <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-sm font-semibold text-sky-900">
                                      Recepción (actualiza stock)
                                    </div>
                                    <div className="text-xs text-sky-800/80">
                                      Cargá <b>cantidad recibida</b> y/o <b>precio real</b> por ítem. No baja valores.
                                    </div>
                                  </div>
                                  <Button
                                    onClick={() => receiveOrder(o)}
                                    loading={ordersBusy}
                                    disabled={ordersBusy}
                                  >
                                    Aplicar recepción
                                  </Button>
                                </div>

                                <div className="mt-3 overflow-hidden rounded-xl border border-sky-200 bg-white">
                                  <table className="min-w-full">
                                    <thead className="bg-sky-50">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-sky-700">
                                          Ítem
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-sky-700">
                                          Nuevo recibido
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-sky-700">
                                          Precio real
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100">
                                      {(o.items || []).map((it) => (
                                        <tr key={it.ingredientId} className="hover:bg-zinc-50">
                                          <td className="px-3 py-2">
                                            <div className="text-sm font-semibold text-zinc-900">
                                              {it.ingredientName || it.ingredientId}
                                            </div>
                                            <div className="text-xs text-zinc-500">
                                              Pedido: <b>{it.qty}</b> · Actual recibido:{" "}
                                              <b>{Number(it.receivedQty ?? 0)}</b>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2">
                                            <Input
                                              value={receiveQtys[it.ingredientId] ?? ""}
                                              onChange={(e) =>
                                                setReceiveQtys((p) => ({
                                                  ...p,
                                                  [it.ingredientId]: e.target.value,
                                                }))
                                              }
                                              placeholder={numStr(it.receivedQty ?? 0)}
                                              inputMode="decimal"
                                            />
                                          </td>
                                          <td className="px-3 py-2">
                                            <Input
                                              value={receivePrices[it.ingredientId] ?? ""}
                                              onChange={(e) =>
                                                setReceivePrices((p) => ({
                                                  ...p,
                                                  [it.ingredientId]: e.target.value,
                                                }))
                                              }
                                              placeholder={it.realUnitPrice == null ? "0" : String(it.realUnitPrice)}
                                              inputMode="decimal"
                                            />
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Factura */}
                            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-zinc-900">
                                    Factura (URL)
                                  </div>
                                  <div className="text-xs text-zinc-600">
                                    Pegá URL (imagen/pdf). Se guarda en el pedido.
                                  </div>
                                </div>

                                <Button
                                  variant="secondary"
                                  onClick={() => attachInvoice(o.id)}
                                  disabled={ordersBusy}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    Adjuntar
                                  </span>
                                </Button>
                              </div>

                              <div className="mt-3">
                                <Input
                                  value={invoiceUrlByOrder[o.id] ?? ""}
                                  onChange={(e) =>
                                    setInvoiceUrlByOrder((p) => ({
                                      ...p,
                                      [o.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="https://..."
                                />
                                {o.invoice?.imageUrl ? (
                                  <div className="mt-2 text-xs text-zinc-600">
                                    Actual: <b>{o.invoice.imageUrl}</b>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Ingredient Picker Modal */}
        {pickerOpen && selectedSupplier && (
          <IngredientPicker
            open={pickerOpen}
            onClose={() => {
              setPickerOpen(false);
              setPickerTargetIndex(null);
            }}
            supplier={selectedSupplier}
            getAccessToken={getAccessToken}
            onPick={onPickIngredient}
          />
        )}
      </div>
    </AdminProtected>
  );
}
